"""
API endpoint: /api/v1/hoso/
Quản lý và thống kê dữ liệu hồ sơ hành chính theo cơ quan
"""
import json
import shutil
from pathlib import Path
from collections import Counter, defaultdict
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Form

router = APIRouter()

DATA_DIR = Path(__file__).parent.parent.parent.parent / "data"

# Registry các cơ quan đã có dữ liệu
# key: slug dùng trong URL, value: (tên hiển thị, tên file)
PHUONG_REGISTRY: dict[str, dict] = {
    "lai-thieu": {
        "label": "Phường Lái Thiêu",
        "file": "ho_so_data.json",
        "thang": "06/2026",
    },
}


def _get_data_path(phuong: str) -> Path:
    info = PHUONG_REGISTRY.get(phuong)
    if not info:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy dữ liệu cho cơ quan: {phuong}")
    path = DATA_DIR / info["file"]
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"File dữ liệu không tìm thấy: {path}")
    return path


def _load_data(phuong: str = "lai-thieu") -> list:
    path = _get_data_path(phuong)
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)
    # Hỗ trợ cả 2 cấu trúc: {"content": [...]} hoặc [...]
    return raw["content"] if isinstance(raw, dict) else raw


def _compute_stats(data: list, phuong: str) -> dict:
    """Tính toán thống kê từ danh sách hồ sơ."""
    total = len(data)
    overdue_count = sum(1 for d in data if d.get("overDueByUser", "").strip())
    on_time_count = total - overdue_count

    status_counter = Counter(d["dossierStatusName"] for d in data)
    sector_counter = Counter(d["sectorName"] for d in data)
    proc_counter = Counter(d["procedureName"] for d in data)

    # Hồ sơ theo ngày
    daily: dict = defaultdict(int)
    for d in data:
        date_str = d.get("acceptedDate", "")
        if date_str:
            try:
                dt = datetime.strptime(date_str[:10], "%d/%m/%Y")
                daily[dt.strftime("%Y-%m-%d")] += 1
            except Exception:
                pass

    # Đúng/trễ hạn theo lĩnh vực
    overdue_by_sector: dict = defaultdict(lambda: {"on_time": 0, "overdue": 0})
    for d in data:
        sector = d["sectorName"]
        if d.get("overDueByUser", "").strip():
            overdue_by_sector[sector]["overdue"] += 1
        else:
            overdue_by_sector[sector]["on_time"] += 1

    info = PHUONG_REGISTRY.get(phuong, {})

    return {
        "phuong": info.get("label", phuong),
        "thang": info.get("thang", ""),
        "total": total,
        "overdue_count": overdue_count,
        "on_time_count": on_time_count,
        "overdue_rate": round(overdue_count / total * 100, 1) if total else 0,
        "on_time_rate": round(on_time_count / total * 100, 1) if total else 0,
        "done_count": status_counter.get("Đã trả kết quả", 0),
        "waiting_count": status_counter.get("Chờ tiếp nhận", 0),
        "status_list": [{"name": n, "value": c} for n, c in status_counter.most_common()],
        "sectors": [{"name": n, "count": c} for n, c in sector_counter.most_common(6)],
        "top_procedures": [
            {"name": n[:50] + "…" if len(n) > 50 else n, "count": c}
            for n, c in proc_counter.most_common(5)
        ],
        "daily_list": [{"date": k, "count": v} for k, v in sorted(daily.items())],
        "overdue_by_sector": [
            {"name": s, "on_time": v["on_time"], "overdue": v["overdue"]}
            for s, v in sorted(
                overdue_by_sector.items(),
                key=lambda x: x[1]["on_time"] + x[1]["overdue"],
                reverse=True
            )[:6]
        ],
    }


# ── GET /co-quan — danh sách cơ quan có dữ liệu ─────────────────────────────
@router.get("/co-quan", tags=["Hồ sơ"])
def get_co_quan_list():
    """Trả về danh sách cơ quan đã có dữ liệu."""
    return [
        {"value": slug, "label": info["label"], "thang": info["thang"]}
        for slug, info in PHUONG_REGISTRY.items()
        if (DATA_DIR / info["file"]).exists()
    ]

# ── GET /list — danh sách hồ sơ có filter + phân trang ──────────────────────
@router.get("/list", tags=["Hồ sơ"])
def get_hoso_list(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    phuong: str = Query("lai-thieu"),
    linh_vuc: str = Query(""),
    ten_thu_tuc: str = Query(""),
    trang_thai: str = Query(""),
    trang_thai_nhom: str = Query(""),
):
    """Danh sách hồ sơ có phân trang và filter."""
    data = _load_data(phuong)
    filtered = data

    if linh_vuc:
        filtered = [d for d in filtered if linh_vuc.lower() in d.get("sectorName", "").lower()]
    if ten_thu_tuc:
        filtered = [d for d in filtered if ten_thu_tuc.lower() in d.get("procedureName", "").lower()]
    if trang_thai:
        filtered = [d for d in filtered if d.get("dossierStatusName", "") == trang_thai]
    if trang_thai_nhom == "tre_han":
        filtered = [d for d in filtered if d.get("overDueByUser", "").strip()]
    elif trang_thai_nhom == "dung_han":
        filtered = [d for d in filtered if not d.get("overDueByUser", "").strip()]

    total = len(filtered)
    start = (page - 1) * page_size
    page_data = filtered[start:start + page_size]

    items = []
    for i, d in enumerate(page_data):
        ngay_nop = d.get("acceptedDate", "")
        try:
            ngay_nop = datetime.strptime(ngay_nop[:10], "%d/%m/%Y").strftime("%d/%m/%Y")
        except Exception:
            pass

        han_xu_ly = d.get("appointmentDate", "") or d.get("lastModifiedDate", "")
        try:
            han_xu_ly = datetime.strptime(han_xu_ly[:10], "%d/%m/%Y").strftime("%d/%m/%Y")
        except Exception:
            han_xu_ly = "—"

        items.append({
            "id": d.get("dossierNo") or d.get("dossierId", f"HS-{start + i + 1:04d}"),
            "ten_thu_tuc": d.get("procedureName", ""),
            "trang_thai": d.get("dossierStatusName", ""),
            "linh_vuc": d.get("sectorName", ""),
            "ngay_nop": ngay_nop,
            "han_xu_ly": han_xu_ly,
            "is_overdue": bool(d.get("overDueByUser", "").strip()),
        })

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
        "items": items,
    }


# ── POST /upload — upload file dữ liệu mới ──────────────────────────────────
@router.post("/upload", tags=["Hồ sơ"])
async def upload_hoso_data(
    file: UploadFile = File(...),
    ten_co_quan: str = Form(...),
    slug: str = Form(...),
    thang: str = Form(...),
):
    """
    Upload file JSON dữ liệu hồ sơ mới cho một cơ quan.
    - file: file JSON (cấu trúc {"content": [...]} hoặc [...])
    - ten_co_quan: tên hiển thị, ví dụ "Phường Thuận Giao"
    - slug: định danh URL, ví dụ "thuan-giao"
    - thang: tháng dữ liệu, ví dụ "07/2026"
    """
    # Validate slug
    if not slug.replace("-", "").isalnum():
        raise HTTPException(status_code=400, detail="Slug chỉ được chứa chữ cái, số và dấu gạch ngang.")

    # Validate file type
    if not file.filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="Chỉ chấp nhận file JSON.")

    # Đọc và validate nội dung file
    try:
        content = await file.read()
        raw = json.loads(content)
        data = raw["content"] if isinstance(raw, dict) and "content" in raw else raw
        if not isinstance(data, list) or len(data) == 0:
            raise ValueError("File JSON phải chứa danh sách hồ sơ.")
        # Kiểm tra field bắt buộc trong record đầu tiên
        required_fields = ["dossierStatusName", "sectorName", "procedureName", "overDueByUser"]
        missing = [f for f in required_fields if f not in data[0]]
        if missing:
            raise ValueError(f"File thiếu các trường bắt buộc: {', '.join(missing)}")
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="File không đúng định dạng JSON.")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Lưu file
    filename = f"{slug}_dossiers.json"
    save_path = DATA_DIR / filename
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(save_path, "w", encoding="utf-8") as f:
        json.dump(raw, f, ensure_ascii=False, indent=2)

    # Đăng ký vào registry
    PHUONG_REGISTRY[slug] = {
        "label": ten_co_quan,
        "file": filename,
        "thang": thang,
    }

    # Tính thống kê nhanh để xác nhận
    stats = _compute_stats(data, slug)

    return {
        "success": True,
        "message": f"Upload thành công dữ liệu {ten_co_quan}",
        "slug": slug,
        "total_records": len(data),
        "preview": {
            "total": stats["total"],
            "on_time_rate": stats["on_time_rate"],
            "overdue_rate": stats["overdue_rate"],
        },
    }
# ── GET /{phuong} — thống kê tổng hợp ───────────────────────────────────────
@router.get("/{phuong}", tags=["Hồ sơ"])
def get_hoso_stats(phuong: str):
    """Trả về thống kê hồ sơ theo cơ quan."""
    data = _load_data(phuong)
    return _compute_stats(data, phuong)
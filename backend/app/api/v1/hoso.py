"""
API endpoint: /api/v1/hoso/lai-thieu
Đọc dữ liệu hồ sơ phường Lái Thiêu từ file JSON và trả về thống kê tổng hợp
"""
import json
from pathlib import Path
from collections import Counter, defaultdict
from datetime import datetime
from fastapi import APIRouter, HTTPException

router = APIRouter()

DATA_PATH = Path(__file__).parent.parent.parent.parent / "data" / "lai_thieu_motcuahcm_dossiers.json"


def _load_data():
    if not DATA_PATH.exists():
        raise HTTPException(status_code=404, detail=f"File dữ liệu không tìm thấy: {DATA_PATH}")
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)["content"]


@router.get("/lai-thieu", tags=["Hồ sơ"])
def get_lai_thieu_stats():
    """Trả về thống kê hồ sơ phường Lái Thiêu"""
    data = _load_data()

    total = len(data)
    overdue_count = sum(1 for d in data if d["overDueByUser"].strip())
    on_time_count = total - overdue_count

    # Trạng thái hồ sơ
    status_counter = Counter(d["dossierStatusName"] for d in data)
    status_list = [
        {"name": name, "value": count}
        for name, count in status_counter.most_common()
    ]

    # Hồ sơ theo lĩnh vực (top 6)
    sector_counter = Counter(d["sectorName"] for d in data)
    sectors = [
        {"name": name, "count": count}
        for name, count in sector_counter.most_common(6)
    ]

    # Top 5 thủ tục
    proc_counter = Counter(d["procedureName"] for d in data)
    top_procedures = [
        {"name": name[:50] + "…" if len(name) > 50 else name, "count": count}
        for name, count in proc_counter.most_common(5)
    ]

    # Hồ sơ theo ngày (chỉ tháng 6/2026)
    daily = defaultdict(int)
    for d in data:
        date_str = d.get("acceptedDate", "")
        if date_str:
            try:
                dt = datetime.strptime(date_str[:10], "%d/%m/%Y")
                if dt.year == 2026 and dt.month == 6:
                    daily[dt.strftime("%Y-%m-%d")] += 1
            except Exception:
                pass
    daily_list = [
        {"date": k, "count": v}
        for k, v in sorted(daily.items())
    ]

    # Đúng hạn / trễ hạn theo lĩnh vực
    overdue_by_sector = defaultdict(lambda: {"on_time": 0, "overdue": 0})
    for d in data:
        sector = d["sectorName"]
        if d["overDueByUser"].strip():
            overdue_by_sector[sector]["overdue"] += 1
        else:
            overdue_by_sector[sector]["on_time"] += 1

    overdue_sector_list = [
        {"name": sector, "on_time": v["on_time"], "overdue": v["overdue"]}
        for sector, v in sorted(
            overdue_by_sector.items(),
            key=lambda x: x[1]["on_time"] + x[1]["overdue"],
            reverse=True
        )[:6]
    ]

    return {
        "phuong": "Lái Thiêu",
        "thang": "06/2026",
        "total": total,
        "overdue_count": overdue_count,
        "on_time_count": on_time_count,
        "overdue_rate": round(overdue_count / total * 100, 1) if total else 0,
        "on_time_rate": round(on_time_count / total * 100, 1) if total else 0,
        "done_count": status_counter.get("Đã trả kết quả", 0),
        "waiting_count": status_counter.get("Chờ tiếp nhận", 0),
        "status_list": status_list,
        "sectors": sectors,
        "top_procedures": top_procedures,
        "daily_list": daily_list,
        "overdue_by_sector": overdue_sector_list,
    }
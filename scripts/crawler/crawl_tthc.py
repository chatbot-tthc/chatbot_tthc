"""
Crawler TTHC từ dichvucong.gov.vn
Flow: Crawl → Reorganize theo bộ → Restructure JSON → Download PDF
Dùng: python crawl_tthc.py
"""

import json, os, time
from pathlib import Path
from playwright.sync_api import sync_playwright
import openpyxl
import requests

# ── Cấu hình ──────────────────────────────────────────
EXCEL_FILE    = "danh-sach-tthc-NongNghiepvaMoiTruong.xlsx"   # ← đổi khi crawl bộ khác
OUTPUT_DIR    = "data/raw"
SEARCH_URL    = "https://dichvucong.gov.vn/thu-tuc-hanh-chinh"
DELAY         = 2.0
RESTART_EVERY = 30

# Excel của các bộ đã crawl từ trước (để reorganize phân loại đúng)
_LEGACY_EXCELS = {
    "bo-cong-an":         "danh-sach-tthc-BoCongAn.xlsx",
    "bo-tu-phap":         "danh-sach-tthc-BoTuPhap.xlsx",
    "ngan-hang-nha-nuoc": "danh-sach-tthc-NganhangNhanuocVietNam.xlsx",
    "bo-tai-chinh":       "danh-sach-tthc-BoTaiChinh.xlsx",
    "bo-xay-dung":        "danh-sach-tthc-BoXayDung.xlsx",
    "bo-nong-nghiep-mt":  "danh-sach-tthc-NongNghiepvaMoiTruong.xlsx",
}
# Bộ/ngành mới đăng ký qua Dashboard (POST /api/v1/agencies) — Excel được lưu vào
# data/excels/<code>.xlsx, tự phát hiện ở đây nên không cần sửa code khi thêm bộ mới.
EXCELS_DIR = Path(__file__).resolve().parent / "data" / "excels"


def _discover_all_excels() -> dict:
    merged = dict(_LEGACY_EXCELS)
    if EXCELS_DIR.exists():
        for f in sorted(EXCELS_DIR.glob("*.xlsx")):
            merged.setdefault(f.stem, str(f))
    return merged


ALL_EXCELS = _discover_all_excels()

PDF_BASE    = "data/pdf"
PDF_API_URL = "https://dichvucong.gov.vn/api/v1/configuring/formality/export-pdf-formality-detail-by-citizen"
PDF_HEADERS = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
}
# ──────────────────────────────────────────────────────

SECTIONS = [
    "Trình Tự Thực Hiện", "Cách Thức Thực Hiện", "Thành phần hồ sơ",
    "Căn cứ pháp lý", "Yêu cầu, điều kiện thực hiện", "Kết quả xử lý",
]

INFO_FIELDS = [
    ("ten_thu_tuc",           "Tên thủ tục",                   "Mã thủ tục"),
    ("so_quyet_dinh",         "Số quyết định",                 "Cấp thực hiện"),
    ("cap_thuc_hien",         "Cấp thực hiện",                 "Loại thủ tục"),
    ("loai_thu_tuc",          "Loại thủ tục",                  "Lĩnh vực"),
    ("linh_vuc",              "Lĩnh vực",                      "Đối tượng thực hiện"),
    ("doi_tuong_thuc_hien",   "Đối tượng thực hiện",           "Cơ quan có thẩm quyền"),
    ("co_quan_co_tham_quyen", "Cơ quan có thẩm quyền",        "Địa chỉ tiếp nhận HS"),
    ("dia_chi_tiep_nhan",     "Địa chỉ tiếp nhận HS",         "Cơ quan được ủy quyền"),
    ("co_quan_duoc_uy_quyen", "Cơ quan được ủy quyền",        "Cơ quan phối hợp"),
    ("co_quan_phoi_hop",      "Cơ quan phối hợp",             "Thủ tục hành chính liên quan"),
    ("thu_tuc_lien_quan",     "Thủ tục hành chính liên quan", "Trình Tự Thực Hiện"),
]

SECTION_NAMES   = [s[0] for s in [
    ("Trình Tự Thực Hiện",), ("Cách Thức Thực Hiện",), ("Thành phần hồ sơ",),
    ("Căn cứ pháp lý",), ("Cơ quan thực hiện",), ("Yêu cầu, điều kiện thực hiện",), ("Kết quả xử lý",),
]]
FOOTER_MARKERS  = ["Tìm kiếm nhiều nhất", "Cơ quan chủ quản: Trung tâm"]
SECTION_NOISE   = ["Từ khóaKhông có thông tin", "Chọn cơ quan thực hiện", "Tìm kiếm nhiều nhất"]

# ═══════════════════════════════════════════════════════
# PHẦN 1: CRAWL
# ═══════════════════════════════════════════════════════

def load_ma_so(excel_path):
    wb = openpyxl.load_workbook(excel_path)
    ws = wb.active
    codes = []
    for row in ws.iter_rows(min_row=3, values_only=True):
        if row[0]:
            codes.append(str(row[0]).strip())
    return codes

def extract_ten_thu_tuc(text):
    if "Tên thủ tục" in text:
        s = text.find("Tên thủ tục") + len("Tên thủ tục")
        e = text.find("Mã thủ tục", s)
        if e > s:
            return text[s:e].strip()
    return ""

def extract_sections_raw(text):
    result = {}
    for i, sec in enumerate(SECTIONS):
        if sec not in text:
            continue
        start = text.find(sec) + len(sec)
        end = len(text)
        for ns in SECTIONS[i+1:]:
            p = text.find(ns, start)
            if 0 < p < end:
                end = p
        content = text[start:end].strip()
        if content:
            result[sec] = content
    return result

def crawl_one(page, ma_so):
    data = {"ma_thu_tuc": ma_so}
    try:
        page.goto(SEARCH_URL, timeout=30000, wait_until="domcontentloaded")
        time.sleep(2)
    except Exception as e:
        data["error"] = f"Search page load failed: {e}"
        return data
    try:
        search_box = page.locator("input[type='text'], input[placeholder*='tìm'], input[placeholder*='Tìm'], input[placeholder*='khoá']").first
        search_box.fill(ma_so)
        search_box.press("Enter")
        time.sleep(2)
    except Exception as e:
        data["error"] = f"Search input failed: {e}"
        return data

    detail_url = None
    try:
        links = page.locator("a[href*='thu-tuc-hanh-chinh']").all()
        for link in links:
            href = link.get_attribute("href") or ""
            if href and len(href) > 40 and "thu-tuc-hanh-chinh/" in href:
                if not any(s in href for s in ["?", "trang-chu", "danh-muc"]):
                    detail_url = href if href.startswith("http") else f"https://dichvucong.gov.vn{href}"
                    break
    except Exception as e:
        data["error"] = f"Link extraction failed: {e}"
        return data

    if not detail_url:
        data["error"] = "Không tìm thấy link chi tiết"
        return data

    data["detail_url"] = detail_url

    # Bắt response API get-formality-by-citizen để lấy UUID (formality_id)
    captured = {"formality_id": None}
    def handle_response(resp):
        if "get-formality-by-citizen" in resp.url and resp.request.method == "POST":
            try:
                j = resp.json()
                d = j.get("data", {}) or {}
                if d.get("codeNotation") == ma_so or d.get("code") == ma_so:
                    captured["formality_id"] = d.get("id")
            except Exception:
                pass

    page.on("response", handle_response)
    try:
        page.goto(detail_url, timeout=30000, wait_until="networkidle")
        time.sleep(2)
    except:
        try:
            page.goto(detail_url, timeout=30000, wait_until="domcontentloaded")
            time.sleep(3)
        except Exception as e:
            page.remove_listener("response", handle_response)
            data["error"] = f"Detail page load failed: {e}"
            return data
    page.remove_listener("response", handle_response)

    data["formality_id"] = captured["formality_id"]

    try:
        body = page.locator("body").text_content(timeout=10000) or ""
        data["raw_text"] = body.strip()
    except:
        body = ""

    data["ten_thu_tuc"] = extract_ten_thu_tuc(body)
    data.update(extract_sections_raw(body))
    return data

def main(excel_file: str = EXCEL_FILE):
    Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)
    if not os.path.exists(excel_file):
        print(f"[ERROR] Không tìm thấy: {excel_file}")
        return

    ma_so_list = load_ma_so(excel_file)
    # Kiểm tra cả flat lẫn subdirs
    done = {f.stem for f in Path(OUTPUT_DIR).glob("**/*.json")}
    todo = [m for m in ma_so_list if m not in done]

    print(f"Tổng: {len(ma_so_list)} | Đã có: {len(done)} | Cần crawl: {len(todo)}")
    if not todo:
        print("Đã crawl hết!")
        return

    with sync_playwright() as p:
        browser = None
        page = None

        def new_browser():
            nonlocal browser, page
            if browser:
                try: browser.close()
                except: pass
            browser = p.chromium.launch(headless=True)
            ctx = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1280, "height": 800}
            )
            page = ctx.new_page()
            return page

        page = new_browser()
        for i, ma_so in enumerate(todo):
            if i > 0 and i % RESTART_EVERY == 0:
                print(f"  [RESTART] Khởi động lại browser...")
                page = new_browser()
            print(f"[{i+1}/{len(todo)}] {ma_so} ...", end=" ", flush=True)
            try:
                result = crawl_one(page, ma_so)
            except Exception as e:
                print(f"[CRASH] {e} — restart")
                page = new_browser()
                result = {"ma_thu_tuc": ma_so, "error": str(e)}

            out = Path(OUTPUT_DIR) / f"{ma_so}.json"
            with open(out, "w", encoding="utf-8") as f:
                json.dump(result, f, ensure_ascii=False, indent=2)
            print(f"✓ {result.get('ten_thu_tuc', result.get('error', ''))[:60]}")
            time.sleep(DELAY)

        if browser:
            try: browser.close()
            except: pass

    print(f"\n=== Crawl xong! ===")

# ═══════════════════════════════════════════════════════
# PHẦN 2: REORGANIZE
# ═══════════════════════════════════════════════════════

def reorganize():
    print("\n--- Reorganize: phân loại theo bộ ---")
    code_map = {}
    for folder, excel in ALL_EXCELS.items():
        if os.path.exists(excel):
            for code in load_ma_so(excel):
                code_map[code] = folder

    subdir_map = {}
    for folder in ALL_EXCELS:
        d = Path(OUTPUT_DIR) / folder
        d.mkdir(exist_ok=True)
        subdir_map[folder] = d
    counts = {k: 0 for k in ALL_EXCELS}
    err_n = 0

    for jf in list(Path(OUTPUT_DIR).glob("*.json")):
        with open(jf, encoding="utf-8") as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError:
                print(f"  SKIP (lỗi): {jf.name}")
                try: jf.unlink()
                except: pass
                err_n += 1
                continue

        folder = code_map.get(jf.stem)
        if not folder:
            print(f"  UNKNOWN: {jf.stem}")
            continue

        out = subdir_map[folder] / jf.name
        with open(out, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        jf.unlink()
        counts[folder] += 1

    for folder, n in counts.items():
        print(f"  {folder}: +{n} file")
    if err_n:
        print(f"  Lỗi/rỗng: {err_n} file")

# ═══════════════════════════════════════════════════════
# PHẦN 3: RESTRUCTURE
# ═══════════════════════════════════════════════════════

def _extract_between(text, start_m, end_m):
    if start_m not in text:
        return ""
    s = text.find(start_m) + len(start_m)
    if end_m and end_m in text[s:]:
        return text[s: text.find(end_m, s)].strip()
    return text[s:].strip()

def _cut_footer(text):
    for m in FOOTER_MARKERS:
        if m in text:
            text = text[:text.find(m)]
    return text.strip()

def _clean_section(text):
    for m in SECTION_NOISE:
        if m in text:
            text = text[:text.find(m)]
    return text.strip()

def _restructure_one(data):
    raw = data.get("raw_text", "")
    cut = "Chi tiết thủ tụcChi tiết thủ tục"
    if cut in raw:
        raw = raw[raw.find(cut) + len(cut):]
    raw = _cut_footer(raw)

    result = {
        "ma_thu_tuc": data.get("ma_thu_tuc", ""),
        "detail_url": data.get("detail_url", ""),
        "formality_id": data.get("formality_id", ""),
    }
    for field_key, start_m, end_m in INFO_FIELDS:
        val = _extract_between(raw, start_m, end_m)
        result[field_key] = val

    if data.get("ten_thu_tuc"):
        result["ten_thu_tuc"] = data["ten_thu_tuc"]

    sections_def = [
        ("trinh_tu_thuc_hien",  "Trình Tự Thực Hiện",            "Trình Tự Thực Hiện"),
        ("cach_thuc_thuc_hien", "Cách Thức Thực Hiện",           "Cách Thức Thực Hiện"),
        ("thanh_phan_ho_so",    "Thành phần hồ sơ",              "Thành phần hồ sơ"),
        ("can_cu_phap_ly",      "Căn cứ pháp lý",                "Căn cứ pháp lý"),
        ("co_quan_thuc_hien",   "Cơ quan thực hiện",             None),
        ("yeu_cau_dieu_kien",   "Yêu cầu, điều kiện thực hiện", "Yêu cầu, điều kiện thực hiện"),
        ("ket_qua_xu_ly",       "Kết quả xử lý",                 "Kết quả xử lý"),
    ]
    sec_names = [s[1] for s in sections_def]
    for field_key, sec_name, old_key in sections_def:
        if old_key and data.get(old_key):
            result[field_key] = _clean_section(data[old_key])
        else:
            val = _extract_between(raw, sec_name, None)
            for ns in sec_names:
                if ns != sec_name and ns in val:
                    val = val[:val.find(ns)]
            result[field_key] = _cut_footer(val)

    result["raw_text"] = raw
    if "error" in data:
        result["error"] = data["error"]
    return result

def restructure():
    print("\n--- Restructure: tái cấu trúc JSON ---")
    dirs = [Path(OUTPUT_DIR)]
    for sub in Path(OUTPUT_DIR).iterdir():
        if sub.is_dir():
            dirs.append(sub)

    total = ok = 0
    for d in dirs:
        for jf in sorted(d.glob("*.json")):
            total += 1
            with open(jf, encoding="utf-8") as f:
                data = json.load(f)
            restructured = _restructure_one(data)
            with open(jf, "w", encoding="utf-8") as f:
                json.dump(restructured, f, ensure_ascii=False, indent=2)
            ok += 1

    print(f"  Xong! {ok}/{total} file tái cấu trúc.")

# ═══════════════════════════════════════════════════════
# PHẦN 4: DOWNLOAD PDF
# ═══════════════════════════════════════════════════════

def download_pdf():
    print("\n--- Download PDF qua API ---")
    for bo in ALL_EXCELS:
        raw_dir = Path(OUTPUT_DIR) / bo
        pdf_dir = Path(PDF_BASE) / bo
        pdf_dir.mkdir(parents=True, exist_ok=True)

        json_files = sorted(raw_dir.glob("*.json"))
        print(f"\n[{bo}] {len(json_files)} file JSON")

        for jf in json_files:
            out = pdf_dir / (jf.stem + ".pdf")
            if out.exists():
                print(f"  SKIP (đã có): {jf.stem}")
                continue

            try:
                data = json.load(open(jf, encoding="utf-8"))
            except json.JSONDecodeError:
                print(f"  SKIP (lỗi JSON): {jf.stem}")
                continue

            detail_url = data.get("detail_url", "")
            if not detail_url:
                print(f"  SKIP (no detail_url): {jf.stem}")
                continue

            formality_id = data.get("formality_id")
            if not formality_id:
                print(f"  SKIP (no formality_id): {jf.stem}")
                continue

            try:
                resp = requests.post(
                    PDF_API_URL,
                    json={"formalityId": formality_id},
                    headers=PDF_HEADERS,
                    timeout=30,
                )
                if resp.content[:4] == b"%PDF":
                    out.write_bytes(resp.content)
                    print(f"  OK: {jf.stem}.pdf")
                else:
                    print(f"  FAIL (not PDF): {jf.stem} — HTTP {resp.status_code}")
            except Exception as e:
                print(f"  ERROR: {jf.stem} — {e}")

    print("\n=== Download PDF xong! ===")

# ═══════════════════════════════════════════════════════

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--bo-nganh", help="Code bộ ngành (VD bo-tu-phap) — tự tra Excel tương ứng trong ALL_EXCELS")
    parser.add_argument("--excel", help="Đường dẫn Excel tùy chỉnh (ghi đè --bo-nganh)")
    args = parser.parse_args()

    selected_excel = args.excel
    if not selected_excel and args.bo_nganh:
        selected_excel = ALL_EXCELS.get(args.bo_nganh)
        if not selected_excel:
            print(f"[ERROR] Không rõ Excel cho bộ ngành '{args.bo_nganh}'. Các bộ đã biết: {list(ALL_EXCELS)}")
            raise SystemExit(1)
    if not selected_excel:
        selected_excel = EXCEL_FILE

    main(selected_excel)
    reorganize()
    restructure()
    download_pdf()
    print("\n✅ Pipeline hoàn tất!")
import openpyxl, glob, os

ALL = {

    "bo-cong-an": "danh-sach-tthc-BoCongAn.xlsx",
    "bo-tu-phap": "danh-sach-tthc-BoTuPhap.xlsx",
    "ngan-hang-nha-nuoc": "danh-sach-tthc-NganhangNhanuocVietNam.xlsx",
    "bo-tai-chinh":       "danh-sach-tthc-BoTaiChinh.xlsx",
    "bo-xay-dung": "danh-sach-tthc-BoXayDung.xlsx",
    "bo-nong-nghiep-mt": "danh-sach-tthc-NongNghiepvaMoiTruong.xlsx",
}

for f, x in ALL.items():
    excel_codes = set(
        str(r[0]).strip()
        for r in openpyxl.load_workbook(x).active.iter_rows(min_row=3, values_only=True)
        if r[0]
    )
    have_codes = set(
        os.path.splitext(os.path.basename(p))[0]
        for p in glob.glob(f"data/raw/{f}/*.json")
    )
    print(f, "| Thieu (trong excel, chua co):", sorted(excel_codes - have_codes))
    print(f, "| Du (co file nhung khong trong excel):", sorted(have_codes - excel_codes))
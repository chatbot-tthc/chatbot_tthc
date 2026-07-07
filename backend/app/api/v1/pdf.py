"""
API endpoint: /api/v1/pdf/{bo_nganh}/{ma_thu_tuc}
Serve file PDF gốc của thủ tục hành chính
"""
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

router = APIRouter()

PDF_DIR = Path(__file__).parent.parent.parent.parent / "pdf_data"


@router.get("/{bo_nganh}/{ma_thu_tuc}", tags=["PDF"])
def get_pdf(bo_nganh: str, ma_thu_tuc: str):
    """Trả về file PDF gốc của thủ tục hành chính."""
    # Sanitize input tránh path traversal
    if ".." in bo_nganh or ".." in ma_thu_tuc:
        raise HTTPException(status_code=400, detail="Invalid path")
    
    # Thử cả 2 trường hợp: có và không có .pdf
    filename = ma_thu_tuc if ma_thu_tuc.endswith(".pdf") else f"{ma_thu_tuc}.pdf"
    pdf_path = PDF_DIR / bo_nganh / filename
    
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail=f"Không tìm thấy file PDF: {pdf_path.name}")
    
    return FileResponse(
        path=str(pdf_path),
        media_type="application/pdf",
        filename=filename,
        headers={"Content-Disposition": f"inline; filename={filename}"},
    )
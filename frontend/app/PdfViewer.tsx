"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2 } from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

interface PdfViewerProps {
  pdfUrl: string;
  highlightText: string;
  sectionTitle?: string;
}

// Map section key → heading trong PDF. Khớp đúng 7 field thật mà backend dùng
// khi build index (xem scripts/ingestion/build_index.py: SECTION_FIELDS) — đã
// xác nhận bằng cách trích xuất trực tiếp text PDF thật của nhiều bộ ngành
// (bo-tu-phap, bo-cong-an), không đoán mò.
const SECTION_HEADINGS: Record<string, string[]> = {
  trinh_tu_thuc_hien:  ["TRÌNH TỰ THỰC HIỆN", "QUY TRÌNH THỰC HIỆN"],
  cach_thuc_thuc_hien: ["CÁCH THỨC THỰC HIỆN"],
  thanh_phan_ho_so:    ["THÀNH PHẦN HỒ SƠ", "HỒ SƠ", "THÀNH PHẦN, SỐ LƯỢNG HỒ SƠ"],
  doi_tuong_thuc_hien: ["ĐỐI TƯỢNG THỰC HIỆN"],
  ket_qua_xu_ly:       ["KẾT QUẢ XỬ LÝ", "KẾT QUẢ THỰC HIỆN THỦ TỤC", "KẾT QUẢ"],
  can_cu_phap_ly:      ["CĂN CỨ PHÁP LÝ"],
  yeu_cau_dieu_kien:   ["YÊU CẦU, ĐIỀU KIỆN THỰC HIỆN", "YÊU CẦU ĐIỀU KIỆN"],
};

// Tất cả heading có thể xuất hiện trong PDF (để xác định điểm kết thúc section) —
// gồm cả các heading không phải là section được RAG index (VD "CƠ QUAN THỰC HIỆN",
// "MẪU ĐƠN TỜ KHAI") vì chúng vẫn có thể là ranh giới kết thúc của section đang tô.
const ALL_HEADINGS = [
  "TRÌNH TỰ THỰC HIỆN", "QUY TRÌNH THỰC HIỆN",
  "CÁCH THỨC THỰC HIỆN",
  "THÀNH PHẦN HỒ SƠ", "HỒ SƠ", "THÀNH PHẦN, SỐ LƯỢNG HỒ SƠ",
  "ĐỐI TƯỢNG THỰC HIỆN",
  "KẾT QUẢ XỬ LÝ", "KẾT QUẢ THỰC HIỆN THỦ TỤC", "KẾT QUẢ",
  "CĂN CỨ PHÁP LÝ",
  "YÊU CẦU, ĐIỀU KIỆN THỰC HIỆN", "YÊU CẦU ĐIỀU KIỆN",
  "CƠ QUAN THỰC HIỆN", "MẪU ĐƠN TỜ KHAI",
];

function normalizeText(text: string): string {
  return text
    .replace(/[,;:]/g, "") // bỏ dấu câu — heading cùng nghĩa có thể khác nhau giữa các bộ ngành (VD có/không dấu phẩy)
    .replace(/\s+/g, " ").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

// Heading thật trong mẫu PDF này luôn viết HOA TOÀN BỘ (VD "THÀNH PHẦN HỒ SƠ"),
// khác với nội dung (kể cả dòng ngắn cuối đoạn do PDF tự xuống dòng, VD "việc nộp hồ sơ.")
function isAllCapsLine(raw: string): boolean {
  const trimmed = raw.trim();
  return trimmed.length > 0 && trimmed === trimmed.toUpperCase() && trimmed !== trimmed.toLowerCase();
}

function getKeyPhrase(text: string): string {
  const clean = text.replace(/\.\.\.$/g, "").trim();
  const lines = clean.split("\n").map(l => l.trim()).filter(l => l.length > 10);
  const skip = ["thủ tục:", "mục:", "phần:", "section:"];
  const line = lines.find(l => !skip.some(p => l.toLowerCase().startsWith(p)))
    || lines[1] || lines[0] || clean;
  return line.split(/\s+/).slice(0, 12).join(" ");
}

// Kết quả tìm kiếm section trong PDF — section có thể trải dài qua nhiều trang
// (VD "Thành phần hồ sơ" liệt kê nhiều "Trường hợp" trải dài 4-5 trang)
interface SectionRange {
  page: number;          // trang chứa heading bắt đầu
  headingY: number;      // y-coordinate của heading (điểm bắt đầu)
  endPage: number;       // trang chứa heading kế tiếp (ranh giới kết thúc), hoặc trang cuối đã quét nếu không tìm thấy
  nextHeadingY: number;  // y-coordinate của heading kế tiếp trên endPage, -1 nếu không tìm thấy (hết tài liệu)
  headingStr: string;    // heading text đã match
}

export default function PdfViewer({ pdfUrl, highlightText, sectionTitle }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [targetPage, setTargetPage] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [searchDone, setSearchDone] = useState(false);
  const [sectionRange, setSectionRange] = useState<SectionRange | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const headingsToSearch: string[] = sectionTitle && SECTION_HEADINGS[sectionTitle]
    ? SECTION_HEADINGS[sectionTitle]
    : [];

  const keyPhrase = getKeyPhrase(highlightText);
  const normalizedPhrase = normalizeText(keyPhrase);

  const onDocumentLoadSuccess = useCallback(async ({ numPages: total }: { numPages: number }) => {
    setNumPages(total);
    setLoading(false);

    try {
      const pdf = await pdfjs.getDocument(pdfUrl).promise;
      let found = false;

      // Bước 1: Tìm section bằng heading + y-coordinate
      if (headingsToSearch.length > 0) {
        for (let pageNum = 1; pageNum <= total && !found; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const items = textContent.items as Array<{
            str: string; transform: number[]; height: number;
          }>;

          // Tìm heading trong trang này
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const normalizedStr = normalizeText(item.str);
            // Chỉ xét các dòng viết HOA toàn bộ — loại nội dung (kể cả dòng ngắn
            // cuối đoạn) vô tình chứa từ khoá chung chung như "hồ sơ", "kết quả"...
            const matchedHeading = isAllCapsLine(item.str)
              ? headingsToSearch.find(h => {
                  const normH = normalizeText(h);
                  return normalizedStr.includes(normH) ||
                    (normH.includes(normalizedStr) && normalizedStr.length > 3);
                })
              : undefined;

            if (matchedHeading) {
              // y-coordinate của heading (trong PDF, y tính từ bottom lên)
              const headingY = item.transform[5]; // transform[5] = y position

              const findNextHeadingY = (candidateItems: Array<{ str: string; transform: number[] }>, fromIndex: number) => {
                for (let j = fromIndex; j < candidateItems.length; j++) {
                  const nextStr = normalizeText(candidateItems[j].str);
                  const isNextHeading = isAllCapsLine(candidateItems[j].str) && ALL_HEADINGS.some(h => {
                    const normH = normalizeText(h);
                    return nextStr.includes(normH) ||
                      (normH.includes(nextStr) && nextStr.length > 4);
                  });
                  if (isNextHeading) return candidateItems[j].transform[5];
                }
                return null;
              };

              // Tìm heading tiếp theo để xác định điểm kết thúc section — section có
              // thể trải dài qua nhiều trang, nên nếu không thấy trong trang này thì
              // quét tiếp các trang sau cho tới khi gặp heading khác hoặc hết tài liệu
              let nextHeadingY = -1;
              let endPage = pageNum;
              const samePageNextY = findNextHeadingY(items, i + 1);
              if (samePageNextY !== null) {
                nextHeadingY = samePageNextY;
              } else {
                for (let p = pageNum + 1; p <= total; p++) {
                  const nextPage = await pdf.getPage(p);
                  const nextTextContent = await nextPage.getTextContent();
                  const nextItems = nextTextContent.items as Array<{ str: string; transform: number[] }>;
                  const y = findNextHeadingY(nextItems, 0);
                  endPage = p;
                  if (y !== null) {
                    nextHeadingY = y;
                    break;
                  }
                }
              }

              setSectionRange({
                page: pageNum,
                headingY,
                endPage,
                nextHeadingY,
                headingStr: matchedHeading,
              });
              setTargetPage(pageNum);
              setCurrentPage(pageNum);
              found = true;
              break;
            }
          }
        }
      }

      // Bước 2: Fallback theo key phrase (bắt đầu từ trang 2)
      if (!found) {
        for (let pageNum = 2; pageNum <= total; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item) => ("str" in item ? item.str : "") || "")
            .join(" ");

          if (normalizeText(pageText).includes(normalizedPhrase)) {
            setTargetPage(pageNum);
            setCurrentPage(pageNum);
            found = true;
            break;
          }
        }
      }

      setSearchDone(true);
    } catch (e) {
      console.error("Error searching PDF:", e);
      setSearchDone(true);
    }
  }, [pdfUrl, normalizedPhrase, headingsToSearch.join(",")]);

  // Scroll đến trang target
  useEffect(() => {
    if (searchDone) {
      setTimeout(() => {
        pageRefs.current[targetPage - 1]?.scrollIntoView({
          behavior: "smooth", block: "start",
        });
      }, 400);
    }
  }, [searchDone, targetPage]);

  // Update currentPage khi scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const idx = pageRefs.current.findIndex(el => el === entry.target);
            if (idx >= 0) setCurrentPage(idx + 1);
          }
        });
      },
      { root: container, threshold: 0.5 }
    );
    pageRefs.current.forEach(el => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [numPages, searchDone]);

  // Highlight text renderer — tô xuyên suốt từ trang heading (sectionRange.page)
  // tới trang chứa heading kế tiếp (sectionRange.endPage), có thể trải qua nhiều trang
  const customTextRenderer = useCallback(
    ({ str, pageIndex, transform }: { str: string; pageIndex: number; itemIndex: number; transform: number[] }) => {
      if (!str || !str.trim()) return str;
      const pageNum = pageIndex + 1;

      if (sectionRange && pageNum >= sectionRange.page && pageNum <= sectionRange.endPage) {
        const y = transform[5];

        // Tô heading — chỉ trên đúng trang bắt đầu, đúng tọa độ y đã xác định
        if (pageNum === sectionRange.page && Math.abs(y - sectionRange.headingY) < 0.5) {
          return `<mark style="background: rgba(201,151,60,0.65); border-radius: 3px; padding: 1px 4px; font-weight: 600;">${str}</mark>`;
        }

        // Trang bắt đầu: nội dung phải nằm dưới heading. Các trang sau đó: không giới hạn trên.
        const belowStart = pageNum > sectionRange.page || y < sectionRange.headingY;
        // Trang kết thúc (có heading kế tiếp): nội dung phải nằm trên heading kế tiếp đó.
        // Các trang trước đó: không giới hạn dưới.
        const aboveEnd = pageNum < sectionRange.endPage ||
          sectionRange.nextHeadingY === -1 ||
          y > sectionRange.nextHeadingY;

        if (belowStart && aboveEnd) {
          return `<mark style="background: rgba(201,151,60,0.18); border-radius: 2px;">${str}</mark>`;
        }
        return str;
      }

      if (pageNum !== targetPage) return str;

      // Fallback: highlight key phrase (không xác định được section theo heading)
      const normalizedStr = normalizeText(str);
      const words = normalizedPhrase.split(" ").filter(w => w.length > 4);
      if (words.some(w => normalizedStr.includes(w))) {
        return `<mark style="background: rgba(201,151,60,0.35); border-radius: 2px;">${str}</mark>`;
      }

      return str;
    },
    [targetPage, normalizedPhrase, sectionRange]
  );

  // Custom page renderer với highlight overlay dựa trên y-coordinate
  const renderPage = useCallback((pageNum: number) => {
    return (
      <div
        key={pageNum}
        ref={el => { pageRefs.current[pageNum - 1] = el; }}
        className="shadow-xl relative"
        style={{
          border: pageNum === targetPage ? "2px solid #C9973C" : "2px solid transparent",
          borderRadius: "4px",
        }}
      >
        <Page
          pageNumber={pageNum}
          scale={scale}
          renderTextLayer={true}
          renderAnnotationLayer={true}
          customTextRenderer={customTextRenderer}
          onRenderSuccess={() => {
            if (pageNum === targetPage && searchDone) {
              setTimeout(() => {
                pageRefs.current[pageNum - 1]?.scrollIntoView({
                  behavior: "smooth", block: "start",
                });
              }, 150);
            }
          }}
        />
      </div>
    );
  }, [scale, targetPage, searchDone, customTextRenderer]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0 border-b"
        style={{ borderColor: "rgba(201,151,60,0.2)", background: "#FDF5E6" }}>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="w-6 h-6 rounded-lg flex items-center justify-center disabled:opacity-40 transition-all hover:bg-white"
            style={{ border: "1px solid rgba(201,151,60,0.3)" }}>
            <ChevronLeft className="w-3 h-3" style={{ color: "#7B1818" }} />
          </button>
          <span className="text-[10px] font-medium px-2" style={{ color: "#5A3A1A" }}>
            {currentPage} / {numPages}
          </span>
          <button onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
            disabled={currentPage >= numPages}
            className="w-6 h-6 rounded-lg flex items-center justify-center disabled:opacity-40 transition-all hover:bg-white"
            style={{ border: "1px solid rgba(201,151,60,0.3)" }}>
            <ChevronRight className="w-3 h-3" style={{ color: "#7B1818" }} />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {searchDone && (
            <button
              onClick={() => {
                setCurrentPage(targetPage);
                setTimeout(() => {
                  pageRefs.current[targetPage - 1]?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 100);
              }}
              className="text-[9px] px-2 py-0.5 rounded-full transition-all hover:opacity-80"
              style={{ background: "rgba(201,151,60,0.15)", color: "#C9973C", border: "1px solid #E8C06A" }}>
              {sectionRange?.headingStr || "Đoạn trích dẫn"} · trang {targetPage}
            </button>
          )}
          <button onClick={() => setScale(s => Math.max(0.6, s - 0.2))}
            className="w-6 h-6 rounded-lg flex items-center justify-center transition-all hover:bg-white"
            style={{ border: "1px solid rgba(201,151,60,0.3)" }}>
            <ZoomOut className="w-3 h-3" style={{ color: "#7B1818" }} />
          </button>
          <span className="text-[10px] font-medium w-10 text-center" style={{ color: "#5A3A1A" }}>
            {Math.round(scale * 100)}%
          </span>
          <button onClick={() => setScale(s => Math.min(2.5, s + 0.2))}
            className="w-6 h-6 rounded-lg flex items-center justify-center transition-all hover:bg-white"
            style={{ border: "1px solid rgba(201,151,60,0.3)" }}>
            <ZoomIn className="w-3 h-3" style={{ color: "#7B1818" }} />
          </button>
        </div>
      </div>

      {/* PDF Content */}
      <div ref={containerRef} className="flex-1 overflow-y-auto" style={{ background: "#525659" }}>
        {loading && (
          <div className="flex items-center justify-center h-full gap-2" style={{ color: "#E8C06A" }}>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Đang tải PDF...</span>
          </div>
        )}
        <Document
          file={pdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={(err) => { console.error("PDF load error:", err); setLoading(false); }}
          loading=""
          className="flex flex-col items-center py-4 gap-4"
        >
          {Array.from({ length: numPages }, (_, i) => i + 1).map(renderPage)}
        </Document>
      </div>
    </div>
  );
}
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

// Map section key → heading trong PDF
const SECTION_HEADINGS: Record<string, string[]> = {
  le_phi:              ["LỆ PHÍ", "PHÍ, LỆ PHÍ", "CÁCH THỨC THỰC HIỆN"],
  thanh_phan_ho_so:    ["THÀNH PHẦN HỒ SƠ", "HỒ SƠ", "THÀNH PHẦN, SỐ LƯỢNG HỒ SƠ"],
  trinh_tu_thuc_hien:  ["TRÌNH TỰ THỰC HIỆN", "QUY TRÌNH THỰC HIỆN"],
  thoi_han_giai_quyet: ["THỜI HẠN GIẢI QUYẾT", "THỜI GIAN GIẢI QUYẾT"],
  doi_tuong_thuc_hien: ["ĐỐI TƯỢNG THỰC HIỆN"],
  ket_qua:             ["KẾT QUẢ THỰC HIỆN THỦ TỤC", "KẾT QUẢ"],
};

// Tất cả heading có thể xuất hiện trong PDF (để xác định điểm kết thúc section)
const ALL_HEADINGS = [
  "TRÌNH TỰ THỰC HIỆN", "QUY TRÌNH THỰC HIỆN",
  "THÀNH PHẦN HỒ SƠ", "HỒ SƠ", "THÀNH PHẦN, SỐ LƯỢNG HỒ SƠ",
  "LỆ PHÍ", "PHÍ, LỆ PHÍ", "CÁCH THỨC THỰC HIỆN",
  "THỜI HẠN GIẢI QUYẾT", "THỜI GIAN GIẢI QUYẾT",
  "ĐỐI TƯỢNG THỰC HIỆN", "KẾT QUẢ THỰC HIỆN THỦ TỤC", "KẾT QUẢ",
  "CĂN CỨ PHÁP LÝ", "YÊU CẦU ĐIỀU KIỆN", "MẪU ĐƠN TỜ KHAI",
];

function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, " ").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

function getKeyPhrase(text: string): string {
  const clean = text.replace(/\.\.\.$/g, "").trim();
  const lines = clean.split("\n").map(l => l.trim()).filter(l => l.length > 10);
  const skip = ["thủ tục:", "mục:", "phần:", "section:"];
  const line = lines.find(l => !skip.some(p => l.toLowerCase().startsWith(p)))
    || lines[1] || lines[0] || clean;
  return line.split(/\s+/).slice(0, 12).join(" ");
}

// Kết quả tìm kiếm section trong PDF
interface SectionRange {
  page: number;
  headingY: number;      // y-coordinate của heading (điểm bắt đầu)
  nextHeadingY: number;  // y-coordinate của heading tiếp theo (điểm kết thúc), -1 nếu hết trang
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
  // Lưu set các y-values nằm trong section (để so sánh trực tiếp khi render)
  const sectionYValues = useRef<Set<number>>(new Set());
  const headingYValue = useRef<number>(-1);

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
            // Heading thật là dòng ngắn (chỉ chứa mỗi cụm heading), không phải câu dài
            // vô tình chứa từ khoá chung chung như "hồ sơ", "kết quả"...
            const matchedHeading = headingsToSearch.find(h => {
              const normH = normalizeText(h);
              return (normalizedStr.length <= normH.length + 15 && normalizedStr.includes(normH)) ||
                (normH.includes(normalizedStr) && normalizedStr.length > 3);
            });

            if (matchedHeading) {
              // y-coordinate của heading (trong PDF, y tính từ bottom lên)
              const headingY = item.transform[5]; // transform[5] = y position

              // Tìm heading tiếp theo để xác định điểm kết thúc section
              let nextHeadingY = -1;
              for (let j = i + 1; j < items.length; j++) {
                const nextStr = normalizeText(items[j].str);
                const isNextHeading = ALL_HEADINGS.some(h => {
                  const normH = normalizeText(h);
                  return (nextStr.length <= normH.length + 15 && nextStr.includes(normH)) ||
                    (normH.includes(nextStr) && nextStr.length > 4);
                });
                if (isNextHeading) {
                  nextHeadingY = items[j].transform[5];
                  break;
                }
              }

              setSectionRange({
                page: pageNum,
                headingY,
                nextHeadingY,
                headingStr: matchedHeading,
              });
              setTargetPage(pageNum);
              setCurrentPage(pageNum);
              // Lưu các y-values trong vùng section
              const ySet = new Set<number>();
              ySet.add(headingY); // Thêm heading
              headingYValue.current = headingY;
              for (const item of items) {
                const y = item.transform[5];
                const inSection = nextHeadingY === -1
                  ? y <= headingY
                  : y <= headingY && y > nextHeadingY;
                if (inSection) ySet.add(y);
              }
              sectionYValues.current = ySet;
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

  // Highlight text renderer — so sánh y trực tiếp với sectionYValues
  const customTextRenderer = useCallback(
    ({ str, pageIndex, itemIndex, transform }: { str: string; pageIndex: number; itemIndex: number; transform: number[] }) => {
      if (!str || !str.trim()) return str;
      if (pageIndex + 1 !== targetPage) return str;

      const normalizedStr = normalizeText(str);

      if (sectionRange && pageIndex + 1 === sectionRange.page) {
        // Tô heading — so tọa độ y với heading đã xác định ở bước quét,
        // không so lại bằng text (dễ khớp nhầm với câu chứa từ "hồ sơ" chung chung)
        const isHeading = Math.abs(transform[5] - sectionRange.headingY) < 0.5;
        if (isHeading) {
          return `<mark style="background: rgba(201,151,60,0.65); border-radius: 3px; padding: 1px 4px; font-weight: 600;">${str}</mark>`;
        }

        // Tô nội dung section — so sánh trực tiếp y-coordinate của item này
const y = transform[5];
const { headingY, nextHeadingY } = sectionRange;
const inSection = nextHeadingY === -1
  ? y < headingY
  : y < headingY && y > nextHeadingY;
if (inSection) {
  return `<mark style="background: rgba(201,151,60,0.18); border-radius: 2px;">${str}</mark>`;
}
      } else {
        // Fallback: highlight key phrase
        const words = normalizedPhrase.split(" ").filter(w => w.length > 4);
        if (words.some(w => normalizedStr.includes(w))) {
          return `<mark style="background: rgba(201,151,60,0.35); border-radius: 2px;">${str}</mark>`;
        }
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
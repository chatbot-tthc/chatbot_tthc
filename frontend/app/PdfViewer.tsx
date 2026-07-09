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

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

// Map section_title → các heading xuất hiện trong PDF
const SECTION_HEADINGS: Record<string, string[]> = {
  "thành phần hồ sơ": ["thành phần hồ sơ", "hồ sơ bao gồm", "giấy tờ cần nộp"],
  "trình tự thực hiện": ["trình tự thực hiện", "các bước thực hiện", "quy trình"],
  "cách thức thực hiện": ["cách thức thực hiện", "hình thức nộp", "lệ phí"],
  "thời hạn giải quyết": ["thời hạn giải quyết", "thời gian giải quyết"],
  "lệ phí": ["lệ phí", "mức phí", "miễn phí"],
  "căn cứ pháp lý": ["căn cứ pháp lý", "cơ sở pháp lý", "văn bản pháp luật"],
  "kết quả thực hiện": ["kết quả thực hiện", "kết quả giải quyết"],
  "yêu cầu điều kiện": ["yêu cầu", "điều kiện"],
};

export default function PdfViewer({ pdfUrl, highlightText, sectionTitle }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [targetPage, setTargetPage] = useState<number>(0);
  const [targetSection, setTargetSection] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [searchDone, setSearchDone] = useState(false);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const onDocumentLoadSuccess = useCallback(async ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);

    try {
      const loadingTask = pdfjs.getDocument(pdfUrl);
      const pdf = await loadingTask.promise;

      // Lấy headings cần tìm dựa vào section_title
      const normalizedSection = normalizeText(sectionTitle || "");
      const headings = SECTION_HEADINGS[normalizedSection] || [normalizedSection];

      let foundPage = 0;
      let foundHeading = "";

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = normalizeText(
          textContent.items.map((item) => ("str" in item ? item.str : "") || "").join(" ")
        );

        // Tìm heading section trong trang này
        const matchedHeading = headings.find(h => pageText.includes(normalizeText(h)));
        if (matchedHeading) {
          foundPage = pageNum;
          foundHeading = matchedHeading;
          break;
        }
      }

      if (foundPage > 0) {
        setTargetPage(foundPage);
        setTargetSection(foundHeading);
        setCurrentPage(foundPage);
      }
      setSearchDone(true);
    } catch (e) {
      console.error("PDF search error:", e);
      setSearchDone(true);
    }
  }, [pdfUrl, sectionTitle]);

  // Scroll đến trang target
  useEffect(() => {
    if (searchDone && targetPage >= 1) {
      setTimeout(() => {
        pageRefs.current[targetPage - 1]?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 400);
    }
  }, [searchDone, targetPage]);

  // Highlight CHỈ đúng heading section — không tô tràn lan
  const customTextRenderer = useCallback(
    ({ str, pageIndex }: { str: string; pageIndex: number }) => {
      if (!str) return str;
      const normalizedStr = normalizeText(str);

      // Chỉ highlight ở trang target
      if (pageIndex + 1 !== targetPage) return str;

      // Highlight nếu text item là heading section
      if (targetSection && normalizedStr.includes(normalizeText(targetSection))) {
        return `<mark style="background: rgba(201,151,60,0.5); border-radius: 2px;">${str}</mark>`;
      }

      // Highlight các từ quan trọng từ chunk content — KHÔNG tô từ phổ biến
      const chunkWords = highlightText
        .replace(/\.\.\.$/g, "")
        .split(/\s+/)
        .filter(w => w.length > 6) // Chỉ từ dài > 6 ký tự = từ có nghĩa riêng biệt
        .slice(0, 5);

      const hasSpecificMatch = chunkWords.some(w => normalizedStr.includes(normalizeText(w)));
      if (hasSpecificMatch) {
        return `<mark style="background: rgba(201,151,60,0.25);">${str}</mark>`;
      }

      return str;
    },
    [targetPage, targetSection, highlightText]
  );

  const scrollToTarget = () => {
    pageRefs.current[targetPage - 1]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Track trang hiện tại khi scroll
  useEffect(() => {
    if (numPages === 0) return;
    const observers: IntersectionObserver[] = [];

    pageRefs.current.forEach((el, idx) => {
      if (!el) return;
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              setCurrentPage(idx + 1);
            }
          });
        },
        { threshold: 0.5 }
      );
      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach(o => o.disconnect());
  }, [numPages]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0 border-b"
        style={{ borderColor: "rgba(201,151,60,0.2)", background: "#FDF5E6" }}>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="w-6 h-6 rounded-lg flex items-center justify-center disabled:opacity-40 hover:bg-white"
            style={{ border: "1px solid rgba(201,151,60,0.3)" }}>
            <ChevronLeft className="w-3 h-3" style={{ color: "#7B1818" }} />
          </button>
          <span className="text-[10px] font-medium px-2" style={{ color: "#5A3A1A" }}>
            {currentPage} / {numPages || "..."}
          </span>
          <button onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
            disabled={currentPage >= numPages}
            className="w-6 h-6 rounded-lg flex items-center justify-center disabled:opacity-40 hover:bg-white"
            style={{ border: "1px solid rgba(201,151,60,0.3)" }}>
            <ChevronRight className="w-3 h-3" style={{ color: "#7B1818" }} />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {searchDone && targetPage >= 1 && (
            <button onClick={scrollToTarget}
              className="text-[9px] px-2 py-0.5 rounded-full transition-all hover:opacity-80"
              style={{ background: "rgba(201,151,60,0.2)", color: "#7B1818", border: "1px solid #E8C06A" }}>
              📌 {sectionTitle || `Trang ${targetPage}`}
            </button>
          )}
          <button onClick={() => setScale(s => Math.max(0.6, s - 0.2))}
            className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-white"
            style={{ border: "1px solid rgba(201,151,60,0.3)" }}>
            <ZoomOut className="w-3 h-3" style={{ color: "#7B1818" }} />
          </button>
          <span className="text-[10px] font-medium w-10 text-center" style={{ color: "#5A3A1A" }}>
            {Math.round(scale * 100)}%
          </span>
          <button onClick={() => setScale(s => Math.min(2.5, s + 0.2))}
            className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-white"
            style={{ border: "1px solid rgba(201,151,60,0.3)" }}>
            <ZoomIn className="w-3 h-3" style={{ color: "#7B1818" }} />
          </button>
        </div>
      </div>

      {/* PDF Content */}
      <div className="flex-1 overflow-y-auto" style={{ background: "#525659" }}>
        {loading && (
          <div className="flex items-center justify-center h-48 gap-2" style={{ color: "#E8C06A" }}>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Đang tải PDF...</span>
          </div>
        )}
        <Document
          file={pdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={() => setLoading(false)}
          loading=""
          className="flex flex-col items-center py-4 gap-4"
        >
          {Array.from({ length: numPages }, (_, i) => i + 1).map(pageNum => (
            <div key={pageNum}
              ref={el => { pageRefs.current[pageNum - 1] = el; }}
              className="shadow-xl"
              style={{
                border: pageNum === targetPage ? "2px solid #C9973C" : "2px solid transparent",
                borderRadius: "4px",
                outline: pageNum === targetPage ? "3px solid rgba(201,151,60,0.3)" : "none",
              }}>
              <Page
                pageNumber={pageNum}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                customTextRenderer={customTextRenderer}
                onRenderSuccess={() => {
                  if (pageNum === targetPage && searchDone) {
                    setTimeout(() => {
                      pageRefs.current[pageNum - 1]?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }, 200);
                  }
                }}
              />
            </div>
          ))}
        </Document>
      </div>
    </div>
  );
}

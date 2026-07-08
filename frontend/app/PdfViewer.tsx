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
  sectionTitle?: string; // "Thành phần hồ sơ", "Trình tự thực hiện", "Lệ phí"...
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

// Lấy các từ khóa quan trọng từ chunk để highlight
function getHighlightWords(text: string, sectionTitle?: string): string[] {
  const clean = text.replace(/\.\.\.$/g, "").trim();

  // Ưu tiên dùng section_title để tìm đúng vị trí trong PDF
  if (sectionTitle && sectionTitle.length > 3) {
    const sectionWords = normalizeText(sectionTitle).split(/\s+/).filter(w => w.length > 2);
    return sectionWords;
  }

  // Fallback: lấy các từ có nghĩa từ chunk (bỏ từ phổ biến)
  const stopWords = new Set(["thủ", "tục", "mục", "phần", "theo", "của", "và", "hoặc", "để", "cho", "với", "từ", "đến", "là", "có", "không", "được", "phải", "này", "đó"]);
  const allWords = normalizeText(clean).split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));

  // Lấy 8 từ có nghĩa nhất
  return allWords.slice(0, 8);
}

export default function PdfViewer({ pdfUrl, highlightText, sectionTitle }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [targetPage, setTargetPage] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [searchDone, setSearchDone] = useState(false);
  const [highlightWords, setHighlightWords] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Tính highlight words
  useEffect(() => {
    const words = getHighlightWords(highlightText, sectionTitle);
    setHighlightWords(words);
  }, [highlightText, sectionTitle]);

  const onDocumentLoadSuccess = useCallback(async ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);

    const words = getHighlightWords(highlightText, sectionTitle);
    if (words.length === 0) {
      setSearchDone(true);
      return;
    }

    try {
      const loadingTask = pdfjs.getDocument(pdfUrl);
      const pdf = await loadingTask.promise;

      let bestPage = 1;
      let bestScore = 0;

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = normalizeText(
          textContent.items.map((item) => ("str" in item ? item.str : "") || "").join(" ")
        );

        // Đếm số từ khóa match trong trang này
        const matchCount = words.filter(w => pageText.includes(w)).length;
        const score = matchCount / words.length;

        if (score > bestScore) {
          bestScore = score;
          bestPage = pageNum;
        }

        // Nếu match > 60% từ khóa → dừng tìm kiếm sớm
        if (score >= 0.6) break;
      }

      setTargetPage(bestPage);
      setCurrentPage(bestPage);
      setSearchDone(true);
    } catch (e) {
      console.error("Error searching PDF:", e);
      setSearchDone(true);
    }
  }, [pdfUrl, highlightText, sectionTitle]);

  // Scroll đến trang target
  useEffect(() => {
    if (searchDone && targetPage >= 1) {
      setTimeout(() => {
        const pageEl = pageRefs.current[targetPage - 1];
        if (pageEl) {
          pageEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 400);
    }
  }, [searchDone, targetPage]);

  // Highlight text trong PDF
  const customTextRenderer = useCallback(
    ({ str, pageIndex }: { str: string; pageIndex: number }) => {
      if (pageIndex + 1 !== targetPage) return str;
      if (!str || highlightWords.length === 0) return str;

      const normalizedStr = normalizeText(str);

      // Match nếu có ít nhất 1 từ khóa quan trọng
      const hasMatch = highlightWords.some(word => normalizedStr.includes(word));
      if (!hasMatch) return str;

      return `<mark style="background: rgba(201,151,60,0.5); border-radius: 2px; padding: 1px 0; font-weight: 600;">${str}</mark>`;
    },
    [targetPage, highlightWords]
  );

  const scrollToTarget = () => {
    const pageEl = pageRefs.current[targetPage - 1];
    if (pageEl) pageEl.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0 border-b"
        style={{ borderColor: "rgba(201,151,60,0.2)", background: "#FDF5E6" }}>

        {/* Điều hướng trang */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="w-6 h-6 rounded-lg flex items-center justify-center disabled:opacity-40 transition-all hover:bg-white"
            style={{ border: "1px solid rgba(201,151,60,0.3)" }}>
            <ChevronLeft className="w-3 h-3" style={{ color: "#7B1818" }} />
          </button>
          <span className="text-[10px] font-medium px-2" style={{ color: "#5A3A1A" }}>
            {currentPage} / {numPages || "..."}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
            disabled={currentPage >= numPages}
            className="w-6 h-6 rounded-lg flex items-center justify-center disabled:opacity-40 transition-all hover:bg-white"
            style={{ border: "1px solid rgba(201,151,60,0.3)" }}>
            <ChevronRight className="w-3 h-3" style={{ color: "#7B1818" }} />
          </button>
        </div>

        {/* Badge + Zoom */}
        <div className="flex items-center gap-1.5">
          {searchDone && targetPage >= 1 && (
            <button
              onClick={scrollToTarget}
              className="text-[9px] px-2 py-0.5 rounded-full transition-all hover:opacity-80"
              style={{ background: "rgba(201,151,60,0.2)", color: "#7B1818", border: "1px solid #E8C06A" }}
              title="Bấm để scroll đến đoạn trích dẫn">
              {sectionTitle ? `📌 ${sectionTitle}` : `📍 Trang ${targetPage}`}
            </button>
          )}
          <button
            onClick={() => setScale(s => Math.max(0.6, s - 0.2))}
            className="w-6 h-6 rounded-lg flex items-center justify-center transition-all hover:bg-white"
            style={{ border: "1px solid rgba(201,151,60,0.3)" }}>
            <ZoomOut className="w-3 h-3" style={{ color: "#7B1818" }} />
          </button>
          <span className="text-[10px] font-medium w-10 text-center" style={{ color: "#5A3A1A" }}>
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale(s => Math.min(2.5, s + 0.2))}
            className="w-6 h-6 rounded-lg flex items-center justify-center transition-all hover:bg-white"
            style={{ border: "1px solid rgba(201,151,60,0.3)" }}>
            <ZoomIn className="w-3 h-3" style={{ color: "#7B1818" }} />
          </button>
        </div>
      </div>

      {/* PDF Content — chỉ render trang hiện tại để tăng tốc */}
      <div ref={containerRef} className="flex-1 overflow-y-auto"
        style={{ background: "#525659" }}>
        {loading && (
          <div className="flex items-center justify-center h-48 gap-2" style={{ color: "#E8C06A" }}>
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
          {Array.from({ length: numPages }, (_, i) => i + 1).map(pageNum => (
            <div
              key={pageNum}
              ref={el => { pageRefs.current[pageNum - 1] = el; }}
              className="shadow-xl"
              style={{
                border: pageNum === targetPage ? "2px solid #C9973C" : "2px solid transparent",
                borderRadius: "4px",
                outline: pageNum === targetPage ? "3px solid rgba(201,151,60,0.3)" : "none",
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
                        behavior: "smooth",
                        block: "start",
                      });
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

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2 } from "lucide-react";

// Dùng worker từ CDN — không cần copy file vào public
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

interface PdfViewerProps {
  pdfUrl: string;          // URL file PDF từ backend
  highlightText: string;   // Đoạn text cần highlight (chunk content)
}

// Normalize text để so sánh — bỏ dấu cách thừa, newline
function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

// Lấy key phrase từ chunk — 10 từ đầu tiên, bỏ "..."
function getKeyPhrase(text: string): string {
  const clean = text.replace(/\.\.\.$/g, "").trim();
  const firstLine = clean.split("\n")[0].trim();
  return (firstLine || clean).split(/\s+/).slice(0, 10).join(" ");
}

export default function PdfViewer({ pdfUrl, highlightText }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [targetPage, setTargetPage] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [searchDone, setSearchDone] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  const keyPhrase = getKeyPhrase(highlightText);
  const normalizedPhrase = normalizeText(keyPhrase);

  // Sau khi document load xong, tìm trang chứa đoạn text
  const onDocumentLoadSuccess = useCallback(async ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);

    // Load từng trang để tìm đoạn text
    try {
      const loadingTask = pdfjs.getDocument(pdfUrl);
      const pdf = await loadingTask.promise;

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item) => ("str" in item ? item.str : "") || "")
          .join(" ");

        if (normalizeText(pageText).includes(normalizedPhrase)) {
          setTargetPage(pageNum);
          setCurrentPage(pageNum);
          break;
        }
      }
      setSearchDone(true);
    } catch (e) {
      console.error("Error searching PDF:", e);
      setSearchDone(true);
    }
  }, [pdfUrl, normalizedPhrase]);

  // Scroll đến trang target sau khi tìm được
  useEffect(() => {
    if (searchDone && targetPage > 1) {
      setTimeout(() => {
        const pageEl = pageRefs.current[targetPage - 1];
        if (pageEl) {
          pageEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 300);
    }
  }, [searchDone, targetPage]);

  // Custom text renderer — highlight đúng đoạn
  const customTextRenderer = useCallback(
    ({ str, pageIndex }: { str: string; pageIndex: number }) => {
      // Chỉ highlight ở trang target
      if (pageIndex + 1 !== targetPage) return str;
      if (!str) return str;

      const normalizedStr = normalizeText(str);
      const words = normalizedPhrase.split(" ").filter(w => w.length > 3);

      // Kiểm tra xem string này có chứa từ khóa không
      const hasMatch = words.some(word => normalizedStr.includes(word));
      if (!hasMatch) return str;

      // Highlight toàn bộ text item nếu match
      return `<mark style="background: rgba(201,151,60,0.45); border-radius: 2px; padding: 1px 0;">${str}</mark>`;
    },
    [targetPage, normalizedPhrase]
  );

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
            {currentPage} / {numPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
            disabled={currentPage >= numPages}
            className="w-6 h-6 rounded-lg flex items-center justify-center disabled:opacity-40 transition-all hover:bg-white"
            style={{ border: "1px solid rgba(201,151,60,0.3)" }}>
            <ChevronRight className="w-3 h-3" style={{ color: "#7B1818" }} />
          </button>
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-1.5">
          {targetPage > 0 && searchDone && (
            <span className="text-[9px] px-2 py-0.5 rounded-full"
              style={{ background: "rgba(201,151,60,0.15)", color: "#C9973C", border: "1px solid #E8C06A" }}>
              Đoạn trích dẫn ở trang {targetPage}
            </span>
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

      {/* PDF Content */}
      <div ref={containerRef} className="flex-1 overflow-y-auto"
        style={{ background: "#525659" }}>
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
          {Array.from({ length: numPages }, (_, i) => i + 1).map(pageNum => (
            <div
              key={pageNum}
              ref={el => { pageRefs.current[pageNum - 1] = el; }}
              className="shadow-xl"
              style={{
                border: pageNum === targetPage
                  ? "2px solid #C9973C"
                  : "2px solid transparent",
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
                  // Scroll sau khi trang target render xong
                  if (pageNum === targetPage && searchDone) {
                    setTimeout(() => {
                      pageRefs.current[pageNum - 1]?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    }, 100);
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

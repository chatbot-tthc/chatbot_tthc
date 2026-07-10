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
  sectionTitle?: string; // VD: "le_phi", "thanh_phan_ho_so", "trinh_tu_thuc_hien"
}

// Map section key → các heading có thể xuất hiện trong PDF
const SECTION_HEADINGS: Record<string, string[]> = {
  le_phi:              ["LỆ PHÍ", "PHÍ, LỆ PHÍ", "CÁCH THỨC THỰC HIỆN"],
  thanh_phan_ho_so:    ["THÀNH PHẦN HỒ SƠ", "HỒ SƠ", "THÀNH PHẦN, SỐ LƯỢNG HỒ SƠ"],
  trinh_tu_thuc_hien:  ["TRÌNH TỰ THỰC HIỆN", "QUY TRÌNH THỰC HIỆN"],
  thoi_han_giai_quyet: ["THỜI HẠN GIẢI QUYẾT", "THỜI GIAN GIẢI QUYẾT"],
  doi_tuong_thuc_hien: ["ĐỐI TƯỢNG THỰC HIỆN"],
  ket_qua:             ["KẾT QUẢ THỰC HIỆN THỦ TỤC", "KẾT QUẢ"],
};

function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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

export default function PdfViewer({ pdfUrl, highlightText, sectionTitle }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [targetPage, setTargetPage] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [searchDone, setSearchDone] = useState(false);
  const [matchedHeading, setMatchedHeading] = useState<string>("");
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Xác định danh sách heading cần tìm
  const headingsToSearch: string[] = sectionTitle && SECTION_HEADINGS[sectionTitle]
    ? SECTION_HEADINGS[sectionTitle]
    : [];

  // Key phrase fallback từ chunk content
  const keyPhrase = getKeyPhrase(highlightText);
  const normalizedPhrase = normalizeText(keyPhrase);

  const onDocumentLoadSuccess = useCallback(async ({ numPages: total }: { numPages: number }) => {
    setNumPages(total);
    setLoading(false);

    try {
      const pdf = await pdfjs.getDocument(pdfUrl).promise;
      let found = false;

      // Bước 1: Tìm theo section heading (ưu tiên)
      if (headingsToSearch.length > 0) {
        for (let pageNum = 1; pageNum <= total; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item) => ("str" in item ? item.str : "") || "")
            .join(" ");
          const normalizedPage = normalizeText(pageText);

          const matched = headingsToSearch.find(h =>
            normalizedPage.includes(normalizeText(h))
          );

          if (matched) {
            setTargetPage(pageNum);
            setCurrentPage(pageNum);
            setMatchedHeading(matched);
            found = true;
            break;
          }
        }
      }

      // Bước 2: Fallback — tìm theo key phrase từ chunk content (bỏ qua trang 1)
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

        // Bước 3: Nếu vẫn không tìm thấy thì thử trang 1
        if (!found) {
          const page = await pdf.getPage(1);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item) => ("str" in item ? item.str : "") || "")
            .join(" ");
          if (normalizeText(pageText).includes(normalizedPhrase)) {
            setTargetPage(1);
            setCurrentPage(1);
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
        const pageEl = pageRefs.current[targetPage - 1];
        if (pageEl) {
          pageEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
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

  // Highlight text renderer
  const customTextRenderer = useCallback(
    ({ str, pageIndex }: { str: string; pageIndex: number }) => {
      if (pageIndex + 1 !== targetPage) return str;
      if (!str) return str;

      const normalizedStr = normalizeText(str);

      // Ưu tiên highlight heading section
      if (matchedHeading) {
        const normalizedHeading = normalizeText(matchedHeading);
        const headingWords = normalizedHeading.split(" ").filter(w => w.length > 2);
        const isHeadingMatch = headingWords.length > 0 &&
          headingWords.every(w => normalizedStr.includes(w));
        if (isHeadingMatch) {
          return `<mark style="background: rgba(123,24,24,0.25); border-radius: 2px; padding: 1px 2px; font-weight: bold;">${str}</mark>`;
        }
      }

      // Fallback highlight từ key phrase
      const words = normalizedPhrase.split(" ").filter(w => w.length > 3);
      const hasMatch = words.length > 0 && words.some(w => normalizedStr.includes(w));
      if (!hasMatch) return str;

      return `<mark style="background: rgba(201,151,60,0.4); border-radius: 2px; padding: 1px 0;">${str}</mark>`;
    },
    [targetPage, normalizedPhrase, matchedHeading]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0 border-b"
        style={{ borderColor: "rgba(201,151,60,0.2)", background: "#FDF5E6" }}>
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

        <div className="flex items-center gap-1.5">
          {searchDone && targetPage > 0 && (
            <button
              onClick={() => {
                setCurrentPage(targetPage);
                setTimeout(() => {
                  pageRefs.current[targetPage - 1]?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 100);
              }}
              className="text-[9px] px-2 py-0.5 rounded-full transition-all hover:opacity-80"
              style={{ background: "rgba(201,151,60,0.15)", color: "#C9973C", border: "1px solid #E8C06A" }}>
              {matchedHeading || `Đoạn trích dẫn`} ở trang {targetPage}
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
          {Array.from({ length: numPages }, (_, i) => i + 1).map(pageNum => (
            <div
              key={pageNum}
              ref={el => { pageRefs.current[pageNum - 1] = el; }}
              className="shadow-xl"
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
                        behavior: "smooth",
                        block: "start",
                      });
                    }, 150);
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

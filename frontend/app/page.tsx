"use client";

import ReactMarkdown from "react-markdown";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import {
  Trash2, AlertTriangle, Settings, Info, X,
  Users, Car, Building2, CreditCard,
  LayoutDashboard, Sun, Moon,
  MessageSquare, Clock, ChevronRight, Star,
  FileText, ExternalLink
} from "lucide-react";
import dynamic from "next/dynamic";

// Dynamic import để tránh SSR issue với react-pdf
const PdfViewer = dynamic(() => import("./PdfViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full gap-2" style={{ color: "#E8C06A", background: "#525659" }}>
      <span className="text-sm">Đang tải PDF viewer...</span>
    </div>
  ),
});

// Gọi qua proxy same-origin (xem rewrites() trong next.config.ts) để tránh
// trình duyệt chặn mixed content (HTTPS trang -> HTTP backend).
const API_URL = "";

const BirdLogo = ({ size = 40 }: { size?: number }) => (
  <img src="/bird-logo.png" width={size} height={size} alt="logo"
    style={{ objectFit: "cover", borderRadius: "50%", display: "block" }} />
);

const PaperPlane = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
    <path d="M21.5 2.5L10 13" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M21.5 2.5L14.5 21.5L10 13L2 9L21.5 2.5Z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M10 13L12 16" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.6" />
  </svg>
);

const SUGGESTIONS = [
  { icon: Users, text: "Thủ tục đăng ký kết hôn cần giấy tờ gì?" },
  { icon: Car, text: "Thủ tục đăng ký xe máy như thế nào?" },
  { icon: CreditCard, text: "Hồ sơ cấp lại CCCD bị mất gồm những gì?" },
  { icon: Building2, text: "Thủ tục đăng ký kinh doanh hộ cá thể?" },
];

interface RetrievedChunk {
  content: string;
  document_title: string;
  ma_thu_tuc: string;
  bo_nganh?: string;
  score: number;
  pdf_content?: string;
  section?: string;
  section_title?: string;
}

interface ActionButton {
  label: string;
  url: string;
  type: "primary" | "secondary";
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  retrieved_chunks?: RetrievedChunk[];
  is_fallback?: boolean;
  response_time_ms?: number;
  action_buttons?: ActionButton[];
}

function ChunkModal({ chunk, onClose }: { chunk: RetrievedChunk; onClose: () => void }) {
  const highlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Scroll đến đoạn highlight sau khi render
  useEffect(() => {
    if (highlightRef.current) {
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
  }, []);

  const scorePercent = Math.round(chunk.score * 100);
  const scoreTextColor = scorePercent >= 70 ? "#86efac" : scorePercent >= 50 ? "#fcd34d" : "#fca5a5";

  // Tìm và highlight đoạn chunk trong pdf_content
  const renderPdfWithHighlight = () => {
    if (!chunk.pdf_content) return null;

    // Lấy key phrase từ chunk content (bỏ "..." ở cuối)
    const cleanChunk = chunk.content.replace(/\.\.\.$/g, "").trim();
    // Thử match từng dòng đầu của chunk
    const firstLine = cleanChunk.split("\n")[0].trim();
    const keyPhrase = firstLine.length > 20 ? firstLine.slice(0, 80) : cleanChunk.slice(0, 80);

    const pdfText = chunk.pdf_content;
    const idx = pdfText.indexOf(keyPhrase);

    if (idx === -1) {
      // Không tìm thấy vị trí chính xác — hiện toàn bộ text bình thường
      return (
        <div className="whitespace-pre-wrap text-xs leading-relaxed" style={{ color: "#3D1A0E" }}>
          {pdfText}
        </div>
      );
    }

    // Tìm điểm bắt đầu và kết thúc của đoạn cần highlight
    // Mở rộng để highlight toàn bộ chunk (không chỉ keyPhrase)
    const highlightStart = idx;
    const highlightEnd = Math.min(idx + cleanChunk.length + 50, pdfText.length);

    const before = pdfText.slice(0, highlightStart);
    const highlighted = pdfText.slice(highlightStart, highlightEnd);
    const after = pdfText.slice(highlightEnd);

    return (
      <div className="whitespace-pre-wrap text-xs leading-relaxed" style={{ color: "#3D1A0E" }}>
        {before}
        <span
          ref={highlightRef}
          style={{
            background: "linear-gradient(135deg, rgba(201,151,60,0.35), rgba(232,192,106,0.25))",
            borderLeft: "3px solid #C9973C",
            borderRadius: "2px",
            padding: "2px 6px",
            fontWeight: 600,
            color: "#5A3A1A",
            boxDecorationBreak: "clone",
            WebkitBoxDecorationBreak: "clone",
          }}
        >
          {highlighted}
        </span>
        {after}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        style={{
          background: "#FFFBF5",
          border: "1.5px solid rgba(201,151,60,0.3)",
          maxHeight: "90vh",
          maxWidth: (chunk.pdf_content || chunk.bo_nganh) ? "900px" : "520px",
          width: "100%",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-5 py-4 flex items-start justify-between shrink-0"
          style={{ background: "linear-gradient(135deg,#7B1818,#9B2020)", borderBottom: "1px solid rgba(201,151,60,0.2)" }}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(255,255,255,0.15)" }}>
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm truncate">
                {chunk.document_title || "Tài liệu tham khảo"}
              </p>
              {chunk.ma_thu_tuc && (
                <p className="text-xs mt-0.5" style={{ color: "rgba(232,192,106,0.8)" }}>
                  Mã: {chunk.ma_thu_tuc}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 ml-3 shrink-0">
            <div className="px-2.5 py-1 rounded-full text-xs font-bold"
              style={{ background: "rgba(255,255,255,0.15)", color: "#E8C06A" }}>
              Độ liên quan: <span style={{ color: scoreTextColor }}>{scorePercent}%</span>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-white/20"
              style={{ background: "rgba(255,255,255,0.12)" }}>
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex" style={{ minHeight: 0 }}>
          {(chunk.pdf_content || chunk.bo_nganh) ? (
            // Layout 2 cột khi có PDF
            <>
              {/* Cột trái: Đoạn trích */}
              <div className="w-64 shrink-0 flex flex-col border-r"
                style={{ borderColor: "rgba(201,151,60,0.2)", background: "#FDF5E6" }}>
                <div className="px-4 py-3 shrink-0 border-b" style={{ borderColor: "rgba(201,151,60,0.2)" }}>
                  <p className="text-[10px] font-bold tracking-widest" style={{ color: "#C9973C" }}>
                    ĐOẠN TRÍCH DẪN
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-3">
                  <div className="rounded-xl p-3 text-xs leading-relaxed whitespace-pre-wrap"
                    style={{
                      background: "white",
                      border: "1.5px solid #E8C06A",
                      color: "#3D1A0E",
                      lineHeight: "1.7",
                    }}>
                    {chunk.content}
                  </div>
                  <p className="text-[9px] mt-3 text-center" style={{ color: "#B8956A" }}>
                    Đoạn văn bản chatbot đã dùng để trả lời
                  </p>
                </div>
              </div>

              {/* Cột phải: react-pdf viewer với highlight + scroll */}
              <div className="flex-1 flex flex-col min-w-0">
                <div className="px-4 py-2 shrink-0 border-b flex items-center justify-between"
                  style={{ borderColor: "rgba(201,151,60,0.2)", background: "white" }}>
                  <p className="text-[10px] font-bold tracking-widest" style={{ color: "#7B1818" }}>
                    TÀI LIỆU PDF GỐC
                  </p>
                  {chunk.bo_nganh && chunk.ma_thu_tuc && (
                    <a
                      href={`${API_URL}/api/v1/pdf/${chunk.bo_nganh}/${chunk.ma_thu_tuc}.pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[9px] px-2 py-1 rounded-full transition-all hover:opacity-80"
                      style={{ background: "#FFF5E6", color: "#C9973C", border: "1px solid #E8C06A" }}>
                      <ExternalLink className="w-3 h-3" />
                      Mở tab mới
                    </a>
                  )}
                </div>
                <div className="flex-1 min-w-0 overflow-hidden">
                  {chunk.bo_nganh && chunk.ma_thu_tuc ? (
                    <PdfViewer
                      pdfUrl={`${API_URL}/api/v1/pdf/${chunk.bo_nganh}/${chunk.ma_thu_tuc}.pdf`}
                      highlightText={chunk.content}
                      sectionTitle={chunk.section}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-sm" style={{ color: "#B8956A" }}>
                      Không có file PDF cho tài liệu này
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            // Layout 1 cột khi không có PDF
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <p className="text-xs font-bold tracking-widest mb-3" style={{ color: "#C9973C" }}>
                NỘI DUNG ĐOẠN VĂN BẢN
              </p>
              <div className="rounded-2xl p-4 text-sm leading-relaxed whitespace-pre-wrap"
                style={{
                  background: "rgba(255,255,255,0.8)",
                  border: "1px solid rgba(201,151,60,0.2)",
                  color: "#3D1A0E",
                  lineHeight: "1.7",
                }}>
                {chunk.content}
              </div>
              <p className="text-xs mt-3 text-center" style={{ color: "#B8956A" }}>
                Nhấn bên ngoài hoặc phím Esc để đóng
              </p>
            </div>
          )}
        </div>

        {(chunk.pdf_content || chunk.bo_nganh) && (
          <div className="px-5 py-2 shrink-0 text-center"
            style={{ background: "#FDF5E6", borderTop: "1px solid rgba(201,151,60,0.15)" }}>
            <p className="text-[9px]" style={{ color: "#B8956A" }}>
              Nhấn bên ngoài hoặc phím Esc để đóng
            </p>
          </div>
        )}
      </div>
    </div>
  );
}


function ChunkChip({ chunk }: { chunk: RetrievedChunk }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full text-[11px] px-2.5 py-1 transition-all hover:scale-105 cursor-pointer"
        style={{
          background: "#FDF6EC",
          color: "#7B1818",
          border: "1px solid #E8C06A",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        }}
        title="Bấm để xem nội dung tài liệu"
      >
        <FileText className="w-3 h-3 opacity-60 shrink-0" />
        <span className="truncate max-w-[160px]">
          {chunk.document_title || chunk.ma_thu_tuc}
        </span>
      </button>

      {open && <ChunkModal chunk={chunk} onClose={() => setOpen(false)} />}
    </>
  );
}

export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const s = localStorage.getItem("tthc_session_id");
    const m = localStorage.getItem("tthc_messages");
    if (s) {
      setSessionId(s);
      if (m) {
        try {
          setMessages(JSON.parse(m));
        } catch {}
      }
      return;
    }
    fetch(`${API_URL}/api/v1/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })
      .then((r) => r.json())
      .then((d) => {
        setSessionId(d.id);
        localStorage.setItem("tthc_session_id", d.id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem("tthc_messages", JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!loading) inputRef.current?.focus();
  }, [loading]);

  const sendMessage = async (preset?: string) => {
    const q = (preset ?? input).trim();
    if (!q || loading) return;
    setMessages((p) => [...p, { role: "user", content: q }]);
    setInput("");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId || null, question: q }),
      });
      if (!res.ok) {
        let msg = "Không thể kết nối tới server.";
        try {
          const errData = await res.json();
          const detail = errData?.detail || "";
          if (res.status === 429 || detail.includes("429")) {
            msg = "Hệ thống đang quá tải, vui lòng thử lại sau ít phút.";
          } else if (res.status === 503) {
            msg = "Server đang khởi động lại, vui lòng thử lại sau.";
          } else if (res.status === 500) {
            msg = "Lỗi server nội bộ, vui lòng thử lại.";
          } else if (detail) {
            msg = `Lỗi: ${detail}`;
          }
        } catch {}
        throw new Error(msg);
      }
      const d = await res.json();
      if (!sessionId && d.session_id) {
        const sid = String(d.session_id);
        setSessionId(sid);
        localStorage.setItem("tthc_session_id", sid);
      }
      setMessages((p) => [
        ...p,
        {
          role: "assistant",
          content: d.answer,
          retrieved_chunks: d.retrieved_chunks,
          is_fallback: d.is_fallback,
          response_time_ms: d.response_time_ms,
          action_buttons: d.action_buttons,
        },
      ]);
    } catch (e: any) {
      setError(e.message || "Không thể kết nối tới server.");
      setMessages((p) => p.slice(0, -1));
      setInput(q);
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = () => {
    localStorage.removeItem("tthc_session_id");
    localStorage.removeItem("tthc_messages");
    setMessages([]);
    setSessionId(null);
    setError(null);
    fetch(`${API_URL}/api/v1/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })
      .then((r) => r.json())
      .then((d) => {
        setSessionId(d.id);
        localStorage.setItem("tthc_session_id", d.id);
      })
      .catch(() => {});
  };

  return (
    <div
      className="h-screen w-full flex flex-col overflow-hidden"
      style={{
        backgroundImage: "url('/bg-lotus.png')",
        backgroundSize: "cover",
        backgroundPosition: "center top",
        backgroundAttachment: "fixed",
      }}
    >
      <header
        className="shrink-0 flex items-center justify-between px-6 py-3 relative z-20"
        style={{
          background: "linear-gradient(135deg,#5C1010 0%,#8B1A1A 55%,#6B1414 100%)",
          boxShadow: "0 2px 20px rgba(0,0,0,0.45)",
        }}
      >
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: "url('/bg-vietnam.jpg')",
            backgroundSize: "120%",
            backgroundPosition: "right center",
            mixBlendMode: "luminosity",
          }}
        />

        <div className="flex items-center gap-4 relative z-10">
          <div
            className="w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center shadow-lg"
            style={{
              background: "linear-gradient(135deg,#B8852A,#E8C06A)",
              boxShadow: "0 0 0 2px rgba(232,192,106,0.4),0 4px 16px rgba(0,0,0,0.3)",
            }}
          >
            <BirdLogo size={56} />
          </div>
          <div>
            <h1 className="text-white font-bold text-xl tracking-widest drop-shadow">TRỢ LÝ ẢO TTHC</h1>
            <p className="text-xs tracking-wider" style={{ color: "#E8C06A" }}>
              VNPT TP.HCM — Tra cứu thủ tục hành chính công
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 relative z-10" ref={settingsRef}>
          {(
            [
              { icon: Info, label: "Thông tin", action: () => setInfoOpen(true) },
              { icon: Trash2, label: "Xóa lịch sử", action: clearHistory },
              { icon: Settings, label: "Cài đặt", action: () => setSettingsOpen((v) => !v) },
            ] as const
          ).map(({ icon: Icon, label, action }) => (
            <button
              key={label}
              onClick={action}
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-white transition-all hover:bg-white/15"
              style={{ minWidth: "60px" }}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.12)" }}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}

          {settingsOpen && (
            <div className="absolute right-0 top-20 w-56 rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden z-50">
              <div className="p-3 border-b border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Hiển thị</p>
                <button
                  onClick={() => {
                    const n = !darkMode;
                    setDarkMode(n);
                    document.documentElement.classList.toggle("dark", n);
                  }}
                  className="w-full flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-gray-50 text-sm text-gray-700"
                >
                  {darkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                  {darkMode ? "Chế độ tối" : "Chế độ sáng"}
                </button>
              </div>
              <Link
                href="/dashboard"
                onClick={() => setSettingsOpen(false)}
                className="flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
              >
                <LayoutDashboard className="w-4 h-4" /> Xem Dashboard
              </Link>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside
          className="w-64 shrink-0 hidden md:flex flex-col m-3 mr-0 rounded-2xl overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.93)",
            backdropFilter: "blur(16px)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
          }}
        >
          <div
            className="flex items-center gap-2 px-4 py-3 shrink-0"
            style={{ background: "linear-gradient(135deg,#7B1818,#9B2020)" }}
          >
            <Star className="w-4 h-4" style={{ color: "#E8C06A" }} />
            <span className="text-xs font-bold tracking-widest" style={{ color: "#E8C06A" }}>
              DANH MỤC HỖ TRỢ
            </span>
          </div>

          <nav className="flex-1 p-3 space-y-2">
            <div
              className="flex items-center gap-3 p-3 rounded-xl cursor-default"
              style={{
                background: "linear-gradient(135deg,#7B1818,#9B2020)",
                boxShadow: "0 4px 12px rgba(123,24,24,0.35)",
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "rgba(255,255,255,0.2)" }}
              >
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">Trợ lý AI Chat</p>
                <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.7)" }}>
                  Tra cứu thủ tục hành chính
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-white opacity-60 shrink-0" />
            </div>

            <Link
              href="/dashboard"
              className="flex items-center gap-3 p-3 rounded-xl transition-all"
              style={{ border: "1.5px solid rgba(212,168,67,0.25)" }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "rgba(245,232,213,0.8)";
                el.style.borderColor = "#C9973C";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "transparent";
                el.style.borderColor = "rgba(212,168,67,0.25)";
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "linear-gradient(135deg,#F5E8D5,#EDD9B8)" }}
              >
                <LayoutDashboard className="w-5 h-5" style={{ color: "#C9973C" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: "#3D1A0E" }}>Dashboard Chatbot</p>
                <p className="text-xs truncate" style={{ color: "#9B7B5A" }}>Hiệu suất phản hồi & thống kê</p>
              </div>
              <ChevronRight className="w-4 h-4 shrink-0 opacity-40" style={{ color: "#C9973C" }} />
            </Link>

            <Link
              href="/dashboard/hoso"
              className="flex items-center gap-3 p-3 rounded-xl transition-all"
              style={{ border: "1.5px solid rgba(212,168,67,0.25)" }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "rgba(245,232,213,0.8)";
                el.style.borderColor = "#C9973C";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "transparent";
                el.style.borderColor = "rgba(212,168,67,0.25)";
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "linear-gradient(135deg,#F5E8D5,#EDD9B8)" }}
              >
                <FileText className="w-5 h-5" style={{ color: "#C9973C" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: "#3D1A0E" }}>Dashboard Hồ Sơ</p>
                <p className="text-xs truncate" style={{ color: "#9B7B5A" }}>Luồng công việc & xử lý hồ sơ</p>
              </div>
              <ChevronRight className="w-4 h-4 shrink-0 opacity-40" style={{ color: "#C9973C" }} />
            </Link>

            <Link
              href="/dashboard/bo-nganh"
              className="flex items-center gap-3 p-3 rounded-xl transition-all"
              style={{ border: "1.5px solid rgba(212,168,67,0.25)" }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "rgba(245,232,213,0.8)";
                el.style.borderColor = "#C9973C";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "transparent";
                el.style.borderColor = "rgba(212,168,67,0.25)";
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "linear-gradient(135deg,#F5E8D5,#EDD9B8)" }}
              >
                <Building2 className="w-5 h-5" style={{ color: "#C9973C" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: "#3D1A0E" }}>Quản lý Bộ/Ngành</p>
                <p className="text-xs truncate" style={{ color: "#9B7B5A" }}>Bật/tắt & cập nhật dữ liệu nguồn</p>
              </div>
              <ChevronRight className="w-4 h-4 shrink-0 opacity-40" style={{ color: "#C9973C" }} />
            </Link>
          </nav>

          <div
            className="m-3 p-4 rounded-2xl shrink-0"
            style={{
              background: "linear-gradient(135deg,#FDF5E6,#FAE8C8)",
              border: "1.5px solid #E8C06A",
              boxShadow: "0 2px 8px rgba(212,168,67,0.15)",
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,#C9973C,#E8A020)" }}
              >
                <Clock className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs font-bold tracking-wider" style={{ color: "#7B1818" }}>
                GIỜ LÀM VIỆC
              </span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium" style={{ color: "#5A3A1A" }}>
                  Thứ 2 - Thứ 6
                </span>
                <span className="text-xs font-bold" style={{ color: "#7B1818" }}>
                  07:30 - 17:00
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium" style={{ color: "#5A3A1A" }}>
                  Thứ 7
                </span>
                <span className="text-xs font-bold" style={{ color: "#7B1818" }}>
                  07:30 - 11:30
                </span>
              </div>
            </div>
          </div>
        </aside>

        <main
          className="flex-1 flex flex-col overflow-hidden m-3 rounded-2xl"
          style={{
            background: "rgba(255,250,244,0.72)",
            backdropFilter: "blur(4px)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.1)",
          }}
        >
          {error && (
            <div className="mx-4 mt-3 shrink-0 rounded-2xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {messages.length === 0 && (
              <div className="min-h-full flex flex-col items-center justify-center px-8 py-10">
                <div className="flex flex-col items-center w-full">
                  <div className="mb-6 relative">
                    <div
                      className="absolute inset-0 rounded-full pointer-events-none"
                      style={{
                        background: "radial-gradient(circle,rgba(232,192,106,0.55),transparent)",
                        transform: "scale(2.2)",
                        filter: "blur(18px)",
                      }}
                    />
                    <div
                      className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center relative shadow-xl"
                      style={{
                        background: "linear-gradient(135deg,#B8852A,#E8C06A)",
                        boxShadow: "0 0 0 4px rgba(232,192,106,0.35),0 8px 32px rgba(184,133,42,0.45)",
                      }}
                    >
                      <BirdLogo size={96} />
                    </div>
                  </div>

                  <h2
                    className="text-3xl font-bold mb-2 text-center"
                    style={{ color: "#5C1010", textShadow: "0 2px 8px rgba(92,16,16,0.15)" }}
                  >
                    Xin chào! Tôi có thể giúp gì cho bạn?
                  </h2>
                  <p className="text-sm text-center mb-1 font-medium" style={{ color: "#8B5A2B" }}>
                    Trợ lý AI hỗ trợ tra cứu thủ tục hành chính công 24/7
                  </p>
                  <p className="text-xs text-center mb-7 flex items-center gap-2" style={{ color: "#B8956A" }}>
                    <span>Nhanh chóng</span>
                    <span className="w-1 h-1 rounded-full inline-block" style={{ background: "#C9973C" }} />
                    <span>Chính xác</span>
                    <span className="w-1 h-1 rounded-full inline-block" style={{ background: "#C9973C" }} />
                    <span>Thuận tiện</span>
                  </p>

                  <div className="flex flex-col gap-2.5 w-full max-w-xl">
                    {SUGGESTIONS.map(({ icon: Icon, text }) => (
                      <button
                        key={text}
                        onClick={() => sendMessage(text)}
                        disabled={loading}
                        className="flex items-center gap-4 px-5 py-3.5 rounded-2xl text-left transition-all duration-200 disabled:opacity-50"
                        style={{
                          background: "rgba(255,255,255,0.88)",
                          border: "1.5px solid rgba(212,168,67,0.3)",
                          boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
                        }}
                        onMouseEnter={(e) => {
                          const el = e.currentTarget as HTMLElement;
                          el.style.background = "rgba(255,255,255,1)";
                          el.style.borderColor = "#C9973C";
                          el.style.boxShadow = "0 4px 20px rgba(201,151,60,0.22)";
                          el.style.transform = "translateX(4px)";
                        }}
                        onMouseLeave={(e) => {
                          const el = e.currentTarget as HTMLElement;
                          el.style.background = "rgba(255,255,255,0.88)";
                          el.style.borderColor = "rgba(212,168,67,0.3)";
                          el.style.boxShadow = "0 2px 10px rgba(0,0,0,0.06)";
                          el.style.transform = "translateX(0)";
                        }}
                      >
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: "linear-gradient(135deg,#F5E8D5,#EDD9B8)" }}
                        >
                          <Icon className="w-5 h-5" style={{ color: "#C9973C" }} />
                        </div>
                        <span className="flex-1 text-sm font-medium" style={{ color: "#3D1A0E" }}>
                          {text}
                        </span>
                        <ChevronRight className="w-4 h-4 shrink-0 opacity-30" style={{ color: "#C9973C" }} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.length > 0 && (
              <div className="px-5 py-5 space-y-5">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex items-end gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "assistant" && (
                      <div
                        className="w-9 h-9 rounded-full overflow-hidden shrink-0 shadow-md mb-0.5"
                        style={{ background: "linear-gradient(135deg,#B8852A,#E8C06A)" }}
                      >
                        <BirdLogo size={36} />
                      </div>
                    )}
                    <div
                      className={`max-w-[78%] rounded-3xl px-5 py-3.5 shadow-sm ${
                        msg.role === "user" ? "rounded-br-lg" : "rounded-bl-lg"
                      }`}
                      style={
                        msg.role === "user"
                          ? { background: "linear-gradient(135deg,#7B1818,#A02020)", color: "white" }
                          : {
                              background: "rgba(255,255,255,0.93)",
                              color: "#2D1A0A",
                              border: "1px solid rgba(212,168,67,0.25)",
                            }
                      }
                    >
                      {msg.role === "assistant" ? (
                        <div className="text-sm leading-relaxed [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-1.5">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-sm leading-relaxed">{msg.content}</p>
                      )}

                      {msg.role === "assistant" && msg.is_fallback && (
                        <div
                          className="mt-2 flex items-start gap-1.5 text-xs italic rounded-xl px-3 py-2"
                          style={{ background: "#FFF8E7", color: "#B7791F" }}
                        >
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          Không tìm thấy thông tin chính xác, đây là câu trả lời tổng quát.
                        </div>
                      )}

                      {msg.role === "assistant" &&
                        msg.retrieved_chunks &&
                        msg.retrieved_chunks.length > 0 &&
                        !msg.is_fallback && (
                          <details className="mt-3" open>
                            <summary
                              className="cursor-pointer text-xs font-bold select-none flex items-center gap-1.5"
                              style={{ color: "#C9973C" }}
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Nguồn tham khảo — bấm vào để xem nội dung
                            </summary>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {(() => {
                                // Dedup: mỗi ma_thu_tuc chỉ giữ 1 chip (score cao nhất)
                                const seen = new Map<string, RetrievedChunk>();
                                msg.retrieved_chunks!.forEach(c => {
                                  const key = c.ma_thu_tuc || c.document_title;
                                  if (!seen.has(key) || c.score > seen.get(key)!.score) {
                                    seen.set(key, c);
                                  }
                                });
                                return Array.from(seen.values()).map((c, j) => (
                                  <ChunkChip key={j} chunk={c} />
                                ));
                              })()}
                            </div>
                          </details>
                        )}

                      {msg.role === "assistant" &&
                        msg.action_buttons &&
                        msg.action_buttons.length > 0 &&
                        !msg.is_fallback && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {msg.action_buttons.map((btn, k) => (
                              <a
                                key={k}
                                href={btn.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all hover:scale-105"
                                style={
                                  btn.type === "primary"
                                    ? {
                                        background: "linear-gradient(135deg,#7B1818,#A02020)",
                                        color: "white",
                                        boxShadow: "0 2px 8px rgba(123,24,24,0.3)",
                                      }
                                    : {
                                        background: "linear-gradient(135deg,#F5E8D5,#EDD9B8)",
                                        color: "#7B1818",
                                        border: "1px solid #E8C06A",
                                      }
                                }
                              >
                                <ExternalLink className="w-3 h-3" />
                                {btn.label}
                              </a>
                            ))}
                          </div>
                        )}

                      {msg.role === "assistant" && msg.response_time_ms !== undefined && (
                        <p className="mt-1.5 text-[10px]" style={{ color: "#C0A888" }}>
                          {(msg.response_time_ms / 1000).toFixed(1)}s
                        </p>
                      )}
                    </div>
                    {msg.role === "user" && (
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-md mb-0.5 text-white text-sm font-bold"
                        style={{ background: "linear-gradient(135deg,#9B2020,#6B1414)" }}
                      >
                        U
                      </div>
                    )}
                  </div>
                ))}

                {loading && (
                  <div className="flex items-end gap-3">
                    <div
                      className="w-9 h-9 rounded-full overflow-hidden shrink-0 shadow-md mb-0.5"
                      style={{ background: "linear-gradient(135deg,#B8852A,#E8C06A)" }}
                    >
                      <BirdLogo size={36} />
                    </div>
                    <div
                      className="rounded-3xl rounded-bl-lg px-5 py-3.5 shadow-sm flex items-center gap-3"
                      style={{ background: "rgba(255,255,255,0.93)", border: "1px solid rgba(212,168,67,0.25)" }}
                    >
                      <span className="text-sm" style={{ color: "#8B5A2B" }}>
                        Đang tra cứu...
                      </span>
                      <div className="flex gap-1">
                        {["-0.3s", "-0.15s", "0s"].map((d) => (
                          <span
                            key={d}
                            className="w-2 h-2 rounded-full animate-bounce"
                            style={{ background: "#C9973C", animationDelay: d }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          <div
            className="shrink-0 px-5 py-4"
            style={{
              background: "rgba(255,251,245,0.88)",
              borderTop: "1px solid rgba(212,168,67,0.2)",
              boxShadow: "0 -2px 16px rgba(0,0,0,0.05)",
            }}
          >
            <div className="flex items-center gap-3">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendMessage();
                }}
                placeholder="Nhập câu hỏi về thủ tục hành chính..."
                disabled={loading}
                className="flex-1 rounded-full px-6 py-3.5 text-sm outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.95)",
                  border: "1.5px solid #E8D8C0",
                  color: "#3D1A0E",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#C9973C";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(201,151,60,0.18)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#E8D8C0";
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.05)";
                }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all disabled:opacity-40"
                style={{ background: "linear-gradient(135deg,#C9973C,#E8A020)" }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.transform = "scale(1.1)";
                  el.style.boxShadow = "0 6px 20px rgba(201,151,60,0.5)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.transform = "scale(1)";
                  el.style.boxShadow = "";
                }}
              >
                <PaperPlane />
              </button>
            </div>
            <p className="mt-2 text-center text-[10px]" style={{ color: "#B8956A" }}>
              ✦ Thông tin chỉ mang tính tham khảo · Vui lòng đối chiếu với cơ quan có thẩm quyền
            </p>
          </div>
        </main>
      </div>

      {infoOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-md px-4"
          onClick={() => setInfoOpen(false)}
        >
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base flex items-center gap-2" style={{ color: "#7B1818" }}>
                <Info className="w-5 h-5" />
                Giới thiệu
              </h3>
              <button
                onClick={() => setInfoOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm leading-relaxed text-gray-700 mb-3">
              <strong>Trợ lý ảo TTHC</strong> hỗ trợ tra cứu thủ tục hành chính công: hồ sơ cần chuẩn bị, trình tự
              thực hiện, thời hạn giải quyết — dựa trên nghị định và thông tư hiện hành.
            </p>
            <p className="text-xs text-gray-400">Thông tin chỉ mang tính tham khảo.</p>
          </div>
        </div>
      )}
    </div>
  );
}
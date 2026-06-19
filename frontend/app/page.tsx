"use client";

import ReactMarkdown from "react-markdown";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import {
  Trash2, AlertTriangle, Settings, Info, X,
  Users, Car, Building2, Zap, CheckCircle, Heart,
  CreditCard, LayoutDashboard, Sun, Moon
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const BirdLogo = ({ size = 40 }: { size?: number }) => (
  <img src="/bird-logo.png" width={size} height={size} alt="logo"
    style={{ objectFit: "contain" }} />
);

const PaperPlane = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg" fill="none">
    <path d="M21.5 2.5L10 13" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
    <path d="M21.5 2.5L14.5 21.5L10 13L2 9L21.5 2.5Z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M10 13L12 16" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.6"/>
  </svg>
);

const SUGGESTIONS = [
  { icon: Users, text: "Thủ tục đăng ký kết hôn cần giấy tờ gì?" },
  { icon: Car, text: "Thủ tục đăng ký xe máy như thế nào?" },
  { icon: CreditCard, text: "Hồ sơ cấp lại CCCD bị mất gồm những gì?" },
  { icon: Building2, text: "Thủ tục đăng ký kinh doanh hộ cá thể?" },
];

const BADGES = [
  { icon: Zap, text: "Nhanh chóng" },
  { icon: CheckCircle, text: "Chính xác" },
  { icon: Heart, text: "Thuận tiện" },
];

interface RetrievedChunk {
  content: string;
  document_title: string;
  ma_thu_tuc: string;
  score: number;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  retrieved_chunks?: RetrievedChunk[];
  is_fallback?: boolean;
  response_time_ms?: number;
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
    const savedSession = localStorage.getItem("tthc_session_id");
    const savedMessages = localStorage.getItem("tthc_messages");
    if (savedSession) {
      setSessionId(savedSession);
      if (savedMessages) {
        try { setMessages(JSON.parse(savedMessages)); } catch { }
      }
      return;
    }
    fetch(`${API_URL}/api/v1/sessions`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
    })
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((data) => { setSessionId(data.id); localStorage.setItem("tthc_session_id", data.id); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setSettingsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (messages.length > 0) localStorage.setItem("tthc_messages", JSON.stringify(messages));
  }, [messages]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  useEffect(() => { if (!loading) inputRef.current?.focus(); }, [loading]);

  const sendMessage = async (presetQuestion?: string) => {
    const question = (presetQuestion ?? input).trim();
    if (!question || loading) return;
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId || null, question }),
      });
      if (!res.ok) throw new Error(`Lỗi ${res.status}`);
      const data = await res.json();
      if (!sessionId && data.session_id) {
        const sid = String(data.session_id);
        setSessionId(sid);
        localStorage.setItem("tthc_session_id", sid);
      }
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: data.answer,
        retrieved_chunks: data.retrieved_chunks,
        is_fallback: data.is_fallback,
        response_time_ms: data.response_time_ms,
      }]);
    } catch {
      setError("Không thể kết nối tới server. Vui lòng thử lại.");
      setMessages((prev) => prev.slice(0, -1));
      setInput(question);
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = () => {
    localStorage.removeItem("tthc_session_id");
    localStorage.removeItem("tthc_messages");
    setMessages([]); setSessionId(null); setError(null);
    fetch(`${API_URL}/api/v1/sessions`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
    }).then((r) => r.json()).then((d) => {
      setSessionId(d.id); localStorage.setItem("tthc_session_id", d.id);
    }).catch(() => {});
  };

  return (
    /* Nền lotus phủ toàn màn hình */
    <div className="h-screen w-full flex flex-col"
      style={{
        backgroundImage: "url('/bg-lotus.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}>

      {/* HEADER */}
      <header className="shrink-0 flex items-center justify-between px-6 py-3 relative"
        style={{
          background: "linear-gradient(135deg, #6B1414 0%, #8B1A1A 60%, #7B1818 100%)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
        }}>
        <div className="flex items-center gap-3">
          <BirdLogo size={52} />
          <div>
            <h1 className="text-white font-bold text-lg tracking-wider">TRỢ LÝ ẢO TTHC</h1>
            <p className="text-xs" style={{ color: "#E8C06A" }}>VNPT TP.HCM — Tra cứu thủ tục hành chính công</p>
          </div>
        </div>

        <div className="flex items-center gap-1" ref={settingsRef}>
          {[
            { icon: Info, label: "Thông tin", action: () => setInfoOpen(true) },
            { icon: Trash2, label: "Xóa lịch sử", action: clearHistory },
            { icon: Settings, label: "Cài đặt", action: () => setSettingsOpen(v => !v) },
          ].map(({ icon: Icon, label, action }) => (
            <button key={label} onClick={action}
              className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-colors text-white hover:bg-white/10">
              <Icon className="w-5 h-5" />
              <span className="text-[10px]">{label}</span>
            </button>
          ))}

          {settingsOpen && (
            <div className="absolute right-6 top-16 w-52 rounded-xl bg-white shadow-xl border border-gray-100 overflow-hidden z-50">
              <div className="p-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Chế độ hiển thị</p>
                <button onClick={() => { const n = !darkMode; setDarkMode(n); document.documentElement.classList.toggle("dark", n); }}
                  className="w-full flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-gray-50 text-sm text-gray-700">
                  {darkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                  {darkMode ? "Chế độ tối" : "Chế độ sáng"}
                </button>
              </div>
              <Link href="/dashboard" onClick={() => setSettingsOpen(false)}
                className="flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50">
                <LayoutDashboard className="w-4 h-4" /> Xem Dashboard
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* BODY — card trắng mờ giữa màn hình, nền lotus thấy xung quanh */}
      <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto my-3 rounded-2xl overflow-hidden"
        style={{
          background: "rgba(255, 251, 245, 0.88)",
          backdropFilter: "blur(8px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
        }}>

        {error && (
          <div className="mx-4 mt-3 rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700 flex items-center gap-2 shrink-0">
            <AlertTriangle className="w-4 h-4 shrink-0" />{error}
          </div>
        )}

        {/* MESSAGES */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* WELCOME */}
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <BirdLogo size={96} />

              <h2 className="text-2xl font-bold mt-4 mb-2" style={{ color: "#7B1818" }}>
                Xin chào! Tôi có thể giúp gì cho bạn?
              </h2>
              <p className="text-sm mb-6" style={{ color: "#7B5A3A" }}>
                Trợ lý AI hỗ trợ tra cứu thủ tục hành chính 24/7
              </p>

              <div className="flex gap-3 mb-8 flex-wrap justify-center">
                {BADGES.map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                    style={{ background: "#F5E8D5", color: "#7B1818", border: "1px solid #E8C06A" }}>
                    <Icon className="w-3 h-3" style={{ color: "#C9973C" }} />{text}
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2 w-full max-w-lg">
                {SUGGESTIONS.map(({ icon: Icon, text }) => (
                  <button key={text} onClick={() => sendMessage(text)} disabled={loading}
                    className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all disabled:opacity-50"
                    style={{ background: "white", border: "1.5px solid #E8D8C0", color: "#3D1A0E", boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#C9973C"; (e.currentTarget as HTMLElement).style.boxShadow = "0 3px 12px rgba(201,151,60,0.2)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#E8D8C0"; (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 6px rgba(0,0,0,0.06)"; }}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#F5E8D5" }}>
                      <Icon className="w-4 h-4" style={{ color: "#C9973C" }} />
                    </div>
                    <span className="text-sm flex-1 font-medium">{text}</span>
                    <span className="text-sm opacity-30" style={{ color: "#C9973C" }}>›</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* CHAT MESSAGES */}
          {messages.map((msg, i) => (
            <div key={i} className={`flex items-start gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 shadow-sm">
                  <BirdLogo size={36} />
                </div>
              )}

              <div className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${msg.role === "user" ? "rounded-br-sm" : "rounded-bl-sm"}`}
                style={msg.role === "user"
                  ? { background: "linear-gradient(135deg, #7B1818, #9B2020)", color: "white" }
                  : { background: "white", color: "#3D1A0E", border: "1px solid #E8D8C0" }}>

                {msg.role === "assistant" ? (
                  <div className="text-sm leading-relaxed [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-1">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm">{msg.content}</p>
                )}

                {msg.role === "assistant" && msg.is_fallback && (
                  <div className="mt-2 flex items-start gap-1.5 text-xs italic rounded-lg px-2.5 py-1.5"
                    style={{ background: "#FFF8E7", color: "#B7791F" }}>
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    Không tìm thấy thông tin chính xác, đây là câu trả lời tổng quát.
                  </div>
                )}

                {msg.role === "assistant" && msg.retrieved_chunks && msg.retrieved_chunks.length > 0 && !msg.is_fallback && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-medium select-none" style={{ color: "#C9973C" }}>
                      ▼ Nguồn tham khảo ({msg.retrieved_chunks.length})
                    </summary>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {msg.retrieved_chunks.map((c, j) => (
                        <span key={j} className="inline-flex items-center rounded-full text-[11px] px-2.5 py-1"
                          style={{ background: "#FDF6EC", color: "#7B1818", border: "1px solid #E8C06A" }}>
                          {c.document_title || c.ma_thu_tuc}{c.score > 0 ? ` · ${(c.score * 100).toFixed(0)}%` : ""}
                        </span>
                      ))}
                    </div>
                  </details>
                )}

                {msg.role === "assistant" && msg.response_time_ms !== undefined && (
                  <p className="mt-1.5 text-[10px]" style={{ color: "#B0A090" }}>{(msg.response_time_ms / 1000).toFixed(1)}s</p>
                )}
              </div>

              {msg.role === "user" && (
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-sm text-white text-sm font-bold"
                  style={{ background: "linear-gradient(135deg, #9B2020, #7B1818)" }}>U</div>
              )}
            </div>
          ))}

          {/* LOADING */}
          {loading && (
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full overflow-hidden shrink-0">
                <BirdLogo size={36} />
              </div>
              <div className="rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex items-center gap-2"
                style={{ background: "white", border: "1px solid #E8D8C0" }}>
                <span className="text-sm" style={{ color: "#9B7B5A" }}>Đang tra cứu thông tin...</span>
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full animate-bounce [animation-delay:-0.3s]" style={{ background: "#C9973C" }} />
                  <span className="w-2 h-2 rounded-full animate-bounce [animation-delay:-0.15s]" style={{ background: "#C9973C" }} />
                  <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: "#C9973C" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* INPUT */}
        <div className="shrink-0 px-6 py-4 border-t" style={{ borderColor: "#E8D8C0" }}>
          <div className="flex items-center gap-3">
            <input ref={inputRef} type="text" value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
              placeholder="Nhập câu hỏi về thủ tục hành chính..."
              disabled={loading}
              className="flex-1 rounded-full px-5 py-3 text-sm outline-none transition-all"
              style={{ background: "white", border: "1.5px solid #E8D8C0", color: "#3D1A0E" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#C9973C"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(201,151,60,0.15)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "#E8D8C0"; e.currentTarget.style.boxShadow = "none"; }}
            />
            <button onClick={() => sendMessage()} disabled={loading || !input.trim()}
              className="w-11 h-11 rounded-full flex items-center justify-center shadow-md transition-all disabled:opacity-40 hover:scale-105"
              style={{ background: "linear-gradient(135deg, #C9973C, #E8A020)" }}>
              <PaperPlane />
            </button>
          </div>
          <p className="mt-2 text-center text-[10px]" style={{ color: "#B0A090" }}>
            ✦ Thông tin chỉ mang tính tham khảo, vui lòng đối chiếu với cơ quan có thẩm quyền để được hướng dẫn chính xác.
          </p>
        </div>
      </div>

      {/* INFO MODAL */}
      {infoOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={() => setInfoOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-base flex items-center gap-2" style={{ color: "#7B1818" }}>
                <Info className="w-4 h-4" />Giới thiệu
              </h3>
              <button onClick={() => setInfoOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm leading-relaxed mb-2 text-gray-700">
              <strong>Trợ lý ảo TTHC</strong> hỗ trợ tra cứu thủ tục hành chính công: hồ sơ cần chuẩn bị, trình tự thực hiện, thời hạn giải quyết — dựa trên các nghị định, thông tư hiện hành.
            </p>
            <p className="text-xs text-gray-500">Lưu ý: thông tin chỉ mang tính tham khảo.</p>
          </div>
        </div>
      )}
    </div>
  );
}
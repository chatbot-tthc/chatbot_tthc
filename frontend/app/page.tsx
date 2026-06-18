"use client";

import ReactMarkdown from "react-markdown";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import {
  Bot,
  User,
  Send,
  Trash2,
  AlertTriangle,
  Settings,
  Sun,
  Moon,
  LayoutDashboard,
  Info,
  X,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const THEME = {
  bgLight: "from-amber-50 via-orange-50 to-yellow-50",
  bgDark: "dark:from-slate-950 dark:via-slate-900 dark:to-orange-950",
  header: "from-red-800 to-red-900",
  avatar: "from-red-700 to-red-900",
  userBubble: "from-red-700 to-red-900",
  sendBtn: "from-yellow-500 to-amber-600",
  ring: "focus:ring-red-700",
  accentText: "text-red-700 dark:text-red-400",
  suggestionHover: "hover:border-yellow-400 hover:text-red-800",
  citation:
    "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-100 dark:border-red-900",
};

const VietnamEmblem = ({ size = 40 }: { size?: number }) => (
  <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" width={size} height={size}>
    <circle cx="20" cy="20" r="20" fill="#DA0000" />
    <polygon
      points="20,5 23.5,14.5 34,14.5 25.5,20.5 29,30 20,24 11,30 14.5,20.5 6,14.5 16.5,14.5"
      fill="#FFDD00"
    />
  </svg>
);

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

const SUGGESTIONS = [
  "Thủ tục đăng ký kết hôn cần giấy tờ gì?",
  "Thủ tục đăng ký xe máy như thế nào?",
  "Hồ sơ cấp lại CCCD bị mất gồm những gì?",
  "Thủ tục đăng ký kinh doanh hộ cá thể?",
];

export default function Home() {
  const preset = THEME;

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
        try { setMessages(JSON.parse(savedMessages)); } catch { /* bỏ qua */ }
      }
      return;
    }
    fetch(`${API_URL}/api/v1/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((data) => { setSessionId(data.id); localStorage.setItem("tthc_session_id", data.id); })
      .catch(() => { console.warn("Không tạo được session trước, sẽ tạo khi gửi tin nhắn."); });
  }, []);

  useEffect(() => {
    const savedDark = localStorage.getItem("tthc_dark_mode");
    if (savedDark === "true") { setDarkMode(true); document.documentElement.classList.add("dark"); }
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

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("tthc_dark_mode", String(next));
  };

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
      if (!res.ok) throw new Error(`Server trả về lỗi ${res.status}`);
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
      setError("Không thể kết nối tới server. Vui lòng kiểm tra backend đã chạy chưa và thử lại.");
      setMessages((prev) => prev.slice(0, -1));
      setInput(question);
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
      body: JSON.stringify({}),
    })
      .then((res) => res.json())
      .then((data) => { setSessionId(data.id); localStorage.setItem("tthc_session_id", data.id); })
      .catch(() => {});
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") sendMessage();
  };

  return (
    <div
      className="min-h-screen w-full"
      style={{ backgroundImage: "url('/bg-vietnam.jpg')", backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" }}
    >
      <div className="flex flex-col h-screen max-w-3xl w-full mx-auto bg-white/80 dark:bg-slate-950/85 backdrop-blur-sm">

        {/* Header */}
        <header className={`bg-gradient-to-r ${preset.header} text-white px-4 sm:px-6 py-4 shadow-lg flex items-center justify-between shrink-0 relative`}>
          <div
            className="absolute inset-0 opacity-15"
            style={{ backgroundImage: "url('/bg-vietnam.jpg')", backgroundSize: "cover", backgroundPosition: "center left" }}
          />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm shrink-0 overflow-hidden">
              <VietnamEmblem size={40} />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold leading-tight tracking-wide">TRỢ LÝ ẢO TTHC</h1>
              <p className="text-xs text-white/80">VNPT TP.HCM — Tra cứu thủ tục hành chính công</p>
            </div>
          </div>

          <div className="flex items-center gap-2 relative z-10" ref={settingsRef}>
            <button onClick={() => setInfoOpen(true)} title="Giới thiệu"
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
              <Info className="w-4 h-4" />
            </button>
            <button onClick={clearHistory} title="Xóa lịch sử chat"
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={() => setSettingsOpen((v) => !v)} title="Cài đặt"
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
              <Settings className="w-4 h-4" />
            </button>

            {settingsOpen && (
              <div className="absolute right-0 top-12 w-56 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 shadow-xl text-zinc-800 dark:text-zinc-100 overflow-hidden z-20">
                <div className="p-3 border-b border-zinc-100 dark:border-zinc-800">
                  <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-2">Chế độ hiển thị</p>
                  <button onClick={toggleDarkMode}
                    className="w-full flex items-center justify-between rounded-xl px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-sm">
                    <span className="flex items-center gap-2">
                      {darkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                      {darkMode ? "Chế độ tối" : "Chế độ sáng"}
                    </span>
                    <span className={`w-9 h-5 rounded-full p-0.5 transition-colors ${darkMode ? "bg-zinc-700" : "bg-zinc-200"}`}>
                      <span className={`block w-4 h-4 rounded-full bg-white shadow transform transition-transform ${darkMode ? "translate-x-4" : "translate-x-0"}`} />
                    </span>
                  </button>
                </div>
                <Link href="/dashboard" onClick={() => setSettingsOpen(false)}
                  className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                  <LayoutDashboard className="w-4 h-4" />
                  Xem Dashboard
                </Link>
              </div>
            )}
          </div>
        </header>

        {error && (
          <div className="mx-4 mt-3 rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700 dark:bg-red-950/50 dark:border-red-900 dark:text-red-300 flex items-center gap-2 shrink-0">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          {messages.length === 0 && (
            <div
              className="h-full flex flex-col items-center justify-center text-center px-4 relative rounded-lg overflow-hidden"
              style={{ backgroundImage: "url('/bg-vietnam.jpg')", backgroundSize: "cover", backgroundPosition: "center" }}
            >
              <div className="absolute inset-0 bg-black/50" />
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-lg mb-4 border-2 border-yellow-400 overflow-hidden">
                  <VietnamEmblem size={80} />
                </div>
                <h2 className="text-lg font-semibold text-white mb-1">Xin chào! Tôi có thể giúp gì cho bạn?</h2>
                <p className="text-sm text-white/80 mb-6 max-w-sm">
                  Hỏi tôi về thủ tục hành chính: giấy tờ cần chuẩn bị, trình tự thực hiện, thời hạn giải quyết...
                </p>
                <div className="flex flex-wrap gap-2 justify-center max-w-md">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => sendMessage(s)} disabled={loading}
                      className="text-xs sm:text-sm px-3 py-2 rounded-full bg-white/20 backdrop-blur-sm border border-white/40 text-white shadow-sm hover:bg-white/30 hover:border-yellow-400 transition-all disabled:opacity-50">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex items-start gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${preset.avatar} flex items-center justify-center shrink-0 shadow-sm`}>
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}
              <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 shadow-sm ${
                msg.role === "user"
                  ? `bg-gradient-to-br ${preset.userBubble} text-white whitespace-pre-wrap rounded-br-md`
                  : "bg-white/95 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-100 dark:border-zinc-700 rounded-bl-md"
              }`}>
                {msg.role === "assistant" ? (
                  <div className="text-sm leading-relaxed space-y-2 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_h1]:text-base [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-bold [&_h3]:text-sm [&_h3]:font-bold [&_p]:mb-1">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm">{msg.content}</p>
                )}
                {msg.role === "assistant" && msg.is_fallback && (
                  <div className="mt-2 flex items-start gap-1.5 text-xs italic text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 rounded-lg px-2.5 py-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    Không tìm thấy thông tin chính xác trong dữ liệu, đây là câu trả lời tổng quát.
                  </div>
                )}
                {msg.role === "assistant" && msg.retrieved_chunks && msg.retrieved_chunks.length > 0 && !msg.is_fallback && (
                  <details className="mt-2 group">
                    <summary className={`cursor-pointer text-xs font-medium select-none ${preset.accentText}`}>
                      ▼ Nguồn tham khảo ({msg.retrieved_chunks.length})
                    </summary>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {msg.retrieved_chunks.map((c, j) => (
                        <span key={j} className={`inline-flex items-center rounded-full text-[11px] px-2.5 py-1 border ${preset.citation}`}>
                          {c.document_title || c.ma_thu_tuc}
                          {c.score > 0 ? ` · ${(c.score * 100).toFixed(0)}%` : ""}
                        </span>
                      ))}
                    </div>
                  </details>
                )}
                {msg.role === "assistant" && msg.response_time_ms !== undefined && (
                  <p className="mt-1.5 text-[10px] text-zinc-400 dark:text-zinc-500">{(msg.response_time_ms / 1000).toFixed(1)}s</p>
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center shrink-0 shadow-sm">
                  <User className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-start gap-2.5">
              <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${preset.avatar} flex items-center justify-center shrink-0 shadow-sm`}>
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-white/95 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 shadow-sm flex items-center gap-2">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">Đang tra cứu thông tin...</span>
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-zinc-300 dark:bg-zinc-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 bg-zinc-300 dark:bg-zinc-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 bg-zinc-300 dark:bg-zinc-600 rounded-full animate-bounce" />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-red-200/50 dark:border-zinc-800 bg-white/70 dark:bg-zinc-950/80 backdrop-blur-md p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nhập câu hỏi về thủ tục hành chính..."
              disabled={loading}
              className={`flex-1 rounded-full border border-zinc-200 dark:border-zinc-700 px-4 py-2.5 text-sm sm:text-base outline-none focus:ring-2 ${preset.ring} focus:border-transparent bg-white/90 dark:bg-zinc-900 dark:text-zinc-100 transition-all`}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br ${preset.sendBtn} text-white flex items-center justify-center shadow-md hover:shadow-lg disabled:opacity-40 disabled:shadow-none transition-all shrink-0`}
            >
              <Send className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-zinc-400 dark:text-zinc-500">
            Thông tin chỉ mang tính tham khảo, vui lòng đối chiếu với cơ quan có thẩm quyền để được hướng dẫn chính xác.
          </p>
        </div>
      </div>

      {infoOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={() => setInfoOpen(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl max-w-sm w-full p-5 text-zinc-800 dark:text-zinc-100" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-base flex items-center gap-2"><Info className="w-4 h-4" />Giới thiệu</h3>
              <button onClick={() => setInfoOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm leading-relaxed mb-2">
              <strong>Trợ lý ảo TTHC</strong> hỗ trợ tra cứu thủ tục hành chính công: hồ sơ cần chuẩn bị, trình tự thực hiện, thời hạn giải quyết — dựa trên các nghị định, thông tư hiện hành.
            </p>
            <p className="text-sm leading-relaxed mb-2">
              Mỗi câu trả lời kèm phần &quot;Nguồn tham khảo&quot; trích từ văn bản pháp lý gốc để bạn đối chiếu.
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Lưu ý: thông tin chỉ mang tính tham khảo, vui lòng đối chiếu với cơ quan có thẩm quyền để được hướng dẫn chính xác nhất.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
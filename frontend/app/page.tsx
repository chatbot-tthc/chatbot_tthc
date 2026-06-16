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
  Check,
  LayoutDashboard,
  Info,
  X,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const THEME_PRESETS = {
  "blue-purple": {
    name: "Xanh - Tím",
    swatch: "from-blue-600 to-purple-600",
    bgLight: "from-blue-50 via-indigo-50 to-purple-50",
    bgDark: "dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950",
    header: "from-blue-600 via-indigo-600 to-purple-600",
    avatar: "from-blue-500 to-purple-600",
    userBubble: "from-blue-600 to-indigo-600",
    sendBtn: "from-blue-600 to-indigo-600",
    ring: "focus:ring-blue-500",
    accentText: "text-blue-600 dark:text-blue-400",
    suggestionHover: "hover:border-blue-300 hover:text-blue-600",
    citation:
      "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-900",
  },
  vnpt: {
    name: "Xanh - Đỏ (VNPT)",
    swatch: "from-blue-700 to-red-600",
    bgLight: "from-blue-50 via-sky-50 to-red-50",
    bgDark: "dark:from-slate-950 dark:via-slate-900 dark:to-red-950",
    header: "from-blue-700 via-blue-600 to-red-600",
    avatar: "from-blue-600 to-red-600",
    userBubble: "from-blue-700 to-red-600",
    sendBtn: "from-blue-700 to-red-600",
    ring: "focus:ring-red-500",
    accentText: "text-red-600 dark:text-red-400",
    suggestionHover: "hover:border-red-300 hover:text-red-600",
    citation:
      "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-100 dark:border-red-900",
  },
  "green-teal": {
    name: "Xanh lá - Ngọc",
    swatch: "from-emerald-600 to-teal-600",
    bgLight: "from-emerald-50 via-teal-50 to-cyan-50",
    bgDark: "dark:from-slate-950 dark:via-slate-900 dark:to-teal-950",
    header: "from-emerald-600 via-teal-600 to-cyan-600",
    avatar: "from-emerald-500 to-teal-600",
    userBubble: "from-emerald-600 to-teal-600",
    sendBtn: "from-emerald-600 to-teal-600",
    ring: "focus:ring-emerald-500",
    accentText: "text-emerald-600 dark:text-emerald-400",
    suggestionHover: "hover:border-emerald-300 hover:text-emerald-600",
    citation:
      "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900",
  },
} as const;

type ThemeKey = keyof typeof THEME_PRESETS;

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
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [colorScheme, setColorScheme] = useState<ThemeKey>("blue-purple");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const preset = THEME_PRESETS[colorScheme];

  useEffect(() => {
    const savedSession = localStorage.getItem("tthc_session_id");
    const savedMessages = localStorage.getItem("tthc_messages");

    if (savedSession) {
      setSessionId(savedSession);
      if (savedMessages) {
        try {
          setMessages(JSON.parse(savedMessages));
        } catch {
          // bỏ qua nếu dữ liệu lưu bị lỗi
        }
      }
      return;
    }

    fetch(`${API_URL}/api/v1/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Không thể tạo session");
        return res.json();
      })
      .then((data) => {
        setSessionId(data.id);
        localStorage.setItem("tthc_session_id", data.id);
      })
      .catch((err) => {
        console.error("Lỗi tạo session:", err);
        setError("Không thể kết nối tới server. Vui lòng kiểm tra backend đã chạy chưa.");
      });
  }, []);

  // Tải cài đặt giao diện (sáng/tối + màu chủ đề) đã lưu
  useEffect(() => {
    const savedDark = localStorage.getItem("tthc_dark_mode");
    const savedScheme = localStorage.getItem("tthc_color_scheme");

    if (savedDark === "true") {
      setDarkMode(true);
      document.documentElement.classList.add("dark");
    }
    if (savedScheme && savedScheme in THEME_PRESETS) {
      setColorScheme(savedScheme as ThemeKey);
    }
  }, []);

  // Đóng menu cài đặt khi click ra ngoài
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
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
    if (sessionId && !loading) inputRef.current?.focus();
  }, [sessionId, loading]);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("tthc_dark_mode", String(next));
  };

  const selectColorScheme = (key: ThemeKey) => {
    setColorScheme(key);
    localStorage.setItem("tthc_color_scheme", key);
  };

  const sendMessage = async (presetQuestion?: string) => {
    const question = (presetQuestion ?? input).trim();
    if (!question || !sessionId || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, question }),
      });

      if (!res.ok) {
        throw new Error(`Server trả về lỗi ${res.status}`);
      }

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer,
          retrieved_chunks: data.retrieved_chunks,
          is_fallback: data.is_fallback,
          response_time_ms: data.response_time_ms,
        },
      ]);
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
    setError(null);

    fetch(`${API_URL}/api/v1/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
      .then((res) => res.json())
      .then((data) => {
        setSessionId(data.id);
        localStorage.setItem("tthc_session_id", data.id);
      })
      .catch(() => {
        setError("Không thể tạo session mới. Vui lòng kiểm tra backend.");
      });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") sendMessage();
  };

  return (
    <div className={`min-h-screen w-full bg-gradient-to-br ${preset.bgLight} ${preset.bgDark}`}>
      <div className="flex flex-col h-screen max-w-3xl w-full mx-auto">
        {/* Header */}
        <header className={`bg-gradient-to-r ${preset.header} text-white px-4 sm:px-6 py-4 shadow-lg flex items-center justify-between shrink-0`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold leading-tight">Trợ lý ảo TTHC</h1>
              <p className="text-xs text-white/80">VNPT TP.HCM — Tra cứu thủ tục hành chính</p>
            </div>
          </div>

          <div className="flex items-center gap-2 relative" ref={settingsRef}>
            <button
              onClick={() => setInfoOpen(true)}
              title="Giới thiệu"
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <Info className="w-4 h-4" />
            </button>
            <button
              onClick={clearHistory}
              title="Xóa lịch sử chat"
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setSettingsOpen((v) => !v)}
              title="Cài đặt"
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>

            {settingsOpen && (
              <div className="absolute right-0 top-12 w-64 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 shadow-xl text-zinc-800 dark:text-zinc-100 overflow-hidden z-20">
                <div className="p-3 border-b border-zinc-100 dark:border-zinc-800">
                  <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-2">
                    Chế độ hiển thị
                  </p>
                  <button
                    onClick={toggleDarkMode}
                    className="w-full flex items-center justify-between rounded-xl px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-sm"
                  >
                    <span className="flex items-center gap-2">
                      {darkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                      {darkMode ? "Chế độ tối" : "Chế độ sáng"}
                    </span>
                    <span className={`w-9 h-5 rounded-full p-0.5 transition-colors ${darkMode ? "bg-zinc-700" : "bg-zinc-200"}`}>
                      <span className={`block w-4 h-4 rounded-full bg-white shadow transform transition-transform ${darkMode ? "translate-x-4" : "translate-x-0"}`} />
                    </span>
                  </button>
                </div>

                <div className="p-3 border-b border-zinc-100 dark:border-zinc-800">
                  <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-2">
                    Màu chủ đề
                  </p>
                  <div className="flex items-center gap-3">
                    {Object.entries(THEME_PRESETS).map(([key, t]) => (
                      <button
                        key={key}
                        onClick={() => selectColorScheme(key as ThemeKey)}
                        title={t.name}
                        className={`relative w-8 h-8 rounded-full bg-gradient-to-br ${t.swatch} flex items-center justify-center ring-2 transition-all ${
                          colorScheme === key ? "ring-zinc-400 dark:ring-zinc-300 scale-110" : "ring-transparent"
                        }`}
                      >
                        {colorScheme === key && <Check className="w-4 h-4 text-white" />}
                      </button>
                    ))}
                  </div>
                </div>

                <Link
                  href="/dashboard"
                  onClick={() => setSettingsOpen(false)}
                  className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Xem Dashboard
                </Link>
              </div>
            )}
          </div>
        </header>

        {/* Error banner */}
        {error && (
          <div className="mx-4 mt-3 rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700 dark:bg-red-950/50 dark:border-red-900 dark:text-red-300 flex items-center gap-2 shrink-0">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <div className={`w-16 h-16 rounded-3xl bg-gradient-to-br ${preset.avatar} flex items-center justify-center shadow-lg mb-4`}>
                <Bot className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100 mb-1">
                Xin chào! Tôi có thể giúp gì cho bạn?
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 max-w-sm">
                Hỏi tôi về thủ tục hành chính: giấy tờ cần chuẩn bị, trình tự thực hiện, thời hạn giải quyết...
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-md">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    disabled={!sessionId || loading}
                    className={`text-xs sm:text-sm px-3 py-2 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 shadow-sm hover:shadow-md transition-all disabled:opacity-50 ${preset.suggestionHover}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex items-start gap-2.5 ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.role === "assistant" && (
                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${preset.avatar} flex items-center justify-center shrink-0 shadow-sm`}>
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}

              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 shadow-sm ${
                  msg.role === "user"
                    ? `bg-gradient-to-br ${preset.userBubble} text-white whitespace-pre-wrap rounded-br-md`
                    : "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-100 dark:border-zinc-700 rounded-bl-md"
                }`}
              >
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

                {msg.role === "assistant" &&
                  msg.retrieved_chunks &&
                  msg.retrieved_chunks.length > 0 &&
                  !msg.is_fallback && (
                    <details className="mt-2 group">
                      <summary className={`cursor-pointer text-xs font-medium select-none ${preset.accentText}`}>
                        Nguồn tham khảo ({msg.retrieved_chunks.length})
                      </summary>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {msg.retrieved_chunks.map((c, j) => (
                          <span
                            key={j}
                            className={`inline-flex items-center rounded-full text-[11px] px-2.5 py-1 border ${preset.citation}`}
                          >
                            {c.document_title || c.ma_thu_tuc} · {(c.score * 100).toFixed(0)}%
                          </span>
                        ))}
                      </div>
                    </details>
                  )}

                {msg.role === "assistant" && msg.response_time_ms !== undefined && (
                  <p className="mt-1.5 text-[10px] text-zinc-400 dark:text-zinc-500">
                    {(msg.response_time_ms / 1000).toFixed(1)}s
                  </p>
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
              <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 shadow-sm flex items-center gap-2">
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
        <div className="shrink-0 border-t border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur p-3 sm:p-4">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nhập câu hỏi về thủ tục hành chính..."
              disabled={!sessionId || loading}
              className={`flex-1 rounded-full border border-zinc-200 dark:border-zinc-700 px-4 py-2.5 text-sm sm:text-base outline-none focus:ring-2 ${preset.ring} focus:border-transparent bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-100 transition-all`}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!sessionId || loading || !input.trim()}
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

      {/* Popup Giới thiệu */}
      {infoOpen && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={() => setInfoOpen(false)}
        >
          <div
            className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl max-w-sm w-full p-5 text-zinc-800 dark:text-zinc-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <Info className="w-4 h-4" />
                Giới thiệu
              </h3>
              <button
                onClick={() => setInfoOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm leading-relaxed mb-2">
              <strong>Trợ lý ảo TTHC</strong> hỗ trợ tra cứu thủ tục hành chính
              công: hồ sơ cần chuẩn bị, trình tự thực hiện, thời hạn giải
              quyết — dựa trên các nghị định, thông tư hiện hành.
            </p>
            <p className="text-sm leading-relaxed mb-2">
              Mỗi câu trả lời kèm phần &quot;Nguồn tham khảo&quot; trích từ
              văn bản pháp lý gốc để bạn đối chiếu.
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Lưu ý: thông tin chỉ mang tính tham khảo, vui lòng đối chiếu với
              cơ quan có thẩm quyền để được hướng dẫn chính xác nhất.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
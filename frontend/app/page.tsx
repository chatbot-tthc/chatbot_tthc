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
  <img src="/bird-logo.png" width={size} height={size} alt="logo" style={{ objectFit: "contain" }} />
);

const PaperPlane = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M21.5 2.5L10 13" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
    <path d="M21.5 2.5L14.5 21.5L10 13L2 9L21.5 2.5Z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M10 13L12 16" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.6"/>
  </svg>
);

const SUGGESTIONS = [
  { icon: Users,    text: "Thủ tục đăng ký kết hôn cần giấy tờ gì?" },
  { icon: Car,      text: "Thủ tục đăng ký xe máy như thế nào?" },
  { icon: CreditCard, text: "Hồ sơ cấp lại CCCD bị mất gồm những gì?" },
  { icon: Building2, text: "Thủ tục đăng ký kinh doanh hộ cá thể?" },
];

const BADGES = [
  { icon: Zap,          text: "Nhanh chóng" },
  { icon: CheckCircle,  text: "Chính xác"   },
  { icon: Heart,        text: "Thuận tiện"  },
];

interface RetrievedChunk {
  content: string; document_title: string; ma_thu_tuc: string; score: number;
}
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  retrieved_chunks?: RetrievedChunk[];
  is_fallback?: boolean;
  response_time_ms?: number;
}

export default function Home() {
  const [sessionId,   setSessionId]   = useState<string | null>(null);
  const [messages,    setMessages]    = useState<ChatMessage[]>([]);
  const [input,       setInput]       = useState("");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [darkMode,    setDarkMode]    = useState(false);
  const [settingsOpen,setSettingsOpen]= useState(false);
  const [infoOpen,    setInfoOpen]    = useState(false);
  const bottomRef   = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLInputElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const s = localStorage.getItem("tthc_session_id");
    const m = localStorage.getItem("tthc_messages");
    if (s) { setSessionId(s); if (m) try { setMessages(JSON.parse(m)); } catch {} return; }
    fetch(`${API_URL}/api/v1/sessions`, { method:"POST", headers:{"Content-Type":"application/json"}, body:"{}" })
      .then(r=>r.json()).then(d=>{ setSessionId(d.id); localStorage.setItem("tthc_session_id",d.id); }).catch(()=>{});
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setSettingsOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => { if (messages.length > 0) localStorage.setItem("tthc_messages", JSON.stringify(messages)); }, [messages]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages, loading]);
  useEffect(() => { if (!loading) inputRef.current?.focus(); }, [loading]);

  const sendMessage = async (preset?: string) => {
    const q = (preset ?? input).trim();
    if (!q || loading) return;
    setMessages(p => [...p, { role:"user", content:q }]);
    setInput(""); setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/chat`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ session_id: sessionId||null, question:q }),
      });
      if (!res.ok) throw new Error();
      const d = await res.json();
      if (!sessionId && d.session_id) { const sid=String(d.session_id); setSessionId(sid); localStorage.setItem("tthc_session_id",sid); }
      setMessages(p => [...p, { role:"assistant", content:d.answer, retrieved_chunks:d.retrieved_chunks, is_fallback:d.is_fallback, response_time_ms:d.response_time_ms }]);
    } catch {
      setError("Không thể kết nối tới server.");
      setMessages(p => p.slice(0,-1)); setInput(q);
    } finally { setLoading(false); }
  };

  const clearHistory = () => {
    localStorage.removeItem("tthc_session_id"); localStorage.removeItem("tthc_messages");
    setMessages([]); setSessionId(null); setError(null);
    fetch(`${API_URL}/api/v1/sessions`, { method:"POST", headers:{"Content-Type":"application/json"}, body:"{}" })
      .then(r=>r.json()).then(d=>{ setSessionId(d.id); localStorage.setItem("tthc_session_id",d.id); }).catch(()=>{});
  };

  return (
    <div className="h-screen w-full flex flex-col" style={{
      backgroundImage: "url('/bg-lotus.png')",
      backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed",
    }}>

      {/* ── HEADER ── */}
      <header className="shrink-0 flex items-center justify-between px-6 py-3"
        style={{ background:"linear-gradient(135deg,#6B1414,#8B1A1A,#7B1818)", boxShadow:"0 2px 16px rgba(0,0,0,0.35)" }}>

        <div className="flex items-center gap-3">
          <BirdLogo size={50} />
          <div>
            <h1 className="text-white font-bold text-lg tracking-widest">TRỢ LÝ ẢO TTHC</h1>
            <p className="text-[11px] tracking-wide" style={{ color:"#E8C06A" }}>VNPT TP.HCM — Tra cứu thủ tục hành chính công</p>
          </div>
        </div>

        <div className="flex items-center gap-1 relative" ref={settingsRef}>
          {([
            { icon:Info,     label:"Thông tin",   action:()=>setInfoOpen(true) },
            { icon:Trash2,   label:"Xóa lịch sử", action:clearHistory },
            { icon:Settings, label:"Cài đặt",      action:()=>setSettingsOpen(v=>!v) },
          ] as const).map(({icon:Icon,label,action})=>(
            <button key={label} onClick={action}
              className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-white transition-all hover:bg-white/15">
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}

          {settingsOpen && (
            <div className="absolute right-0 top-14 w-52 rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden z-50">
              <div className="p-3 border-b border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Hiển thị</p>
                <button onClick={()=>{ const n=!darkMode; setDarkMode(n); document.documentElement.classList.toggle("dark",n); }}
                  className="w-full flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-gray-50 text-sm text-gray-700">
                  {darkMode?<Moon className="w-4 h-4"/>:<Sun className="w-4 h-4"/>}
                  {darkMode?"Chế độ tối":"Chế độ sáng"}
                </button>
              </div>
              <Link href="/dashboard" onClick={()=>setSettingsOpen(false)}
                className="flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50">
                <LayoutDashboard className="w-4 h-4"/> Xem Dashboard
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* ── BODY ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Error */}
        {error && (
          <div className="mx-auto mt-3 w-full max-w-2xl px-4">
            <div className="rounded-2xl bg-red-50/90 border border-red-200 px-4 py-2.5 text-sm text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0"/>{error}
            </div>
          </div>
        )}

        {/* ── MESSAGES ── */}
        <div className="flex-1 overflow-y-auto">

          {/* WELCOME SCREEN */}
          {messages.length === 0 && (
            <div className="min-h-full flex flex-col items-center justify-center text-center px-4 py-12">

              {/* Avatar */}
              <div className="mb-6 drop-shadow-xl">
                <BirdLogo size={110} />
              </div>

              <h2 className="text-3xl font-bold mb-2 drop-shadow-sm" style={{ color:"#6B1414" }}>
                Xin chào! Tôi có thể giúp gì cho bạn?
              </h2>
              <p className="text-sm mb-1 font-medium" style={{ color:"#8B5A2B" }}>
                Trợ lý AI hỗ trợ tra cứu thủ tục hành chính 24/7
              </p>
              <p className="text-xs mb-7" style={{ color:"#AA8060" }}>
                Hỏi tôi về thủ tục hành chính: giấy tờ cần chuẩn bị, trình tự thực hiện, thời hạn giải quyết...
              </p>

              {/* Badges */}
              <div className="flex gap-3 mb-8 flex-wrap justify-center">
                {BADGES.map(({icon:Icon,text})=>(
                  <div key={text} className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold shadow-sm"
                    style={{ background:"rgba(255,255,255,0.85)", color:"#7B1818", border:"1.5px solid #D4A843" }}>
                    <Icon className="w-3.5 h-3.5" style={{color:"#C9973C"}}/>{text}
                  </div>
                ))}
              </div>

              {/* Suggestions */}
              <div className="flex flex-col gap-3 w-full max-w-xl">
                {SUGGESTIONS.map(({icon:Icon,text})=>(
                  <button key={text} onClick={()=>sendMessage(text)} disabled={loading}
                    className="flex items-center gap-4 px-5 py-4 rounded-2xl text-left transition-all duration-200 disabled:opacity-50 group"
                    style={{ background:"rgba(255,255,255,0.82)", border:"1.5px solid rgba(212,168,67,0.4)", color:"#3D1A0E", backdropFilter:"blur(4px)", boxShadow:"0 2px 12px rgba(0,0,0,0.08)" }}
                    onMouseEnter={e=>{ const el=e.currentTarget as HTMLElement; el.style.background="rgba(255,255,255,0.96)"; el.style.borderColor="#C9973C"; el.style.boxShadow="0 4px 20px rgba(201,151,60,0.25)"; el.style.transform="translateY(-1px)"; }}
                    onMouseLeave={e=>{ const el=e.currentTarget as HTMLElement; el.style.background="rgba(255,255,255,0.82)"; el.style.borderColor="rgba(212,168,67,0.4)"; el.style.boxShadow="0 2px 12px rgba(0,0,0,0.08)"; el.style.transform="translateY(0)"; }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background:"linear-gradient(135deg,#F5E8D5,#EDD9B8)" }}>
                      <Icon className="w-5 h-5" style={{color:"#C9973C"}}/>
                    </div>
                    <span className="flex-1 text-sm font-medium">{text}</span>
                    <span className="text-lg opacity-25 group-hover:opacity-60 transition-opacity" style={{color:"#C9973C"}}>›</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* CHAT MESSAGES */}
          {messages.length > 0 && (
            <div className="max-w-3xl mx-auto w-full px-4 py-6 space-y-5">
              {messages.map((msg,i)=>(
                <div key={i} className={`flex items-end gap-3 ${msg.role==="user"?"justify-end":"justify-start"}`}>

                  {msg.role==="assistant" && (
                    <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 shadow-md mb-1">
                      <BirdLogo size={36}/>
                    </div>
                  )}

                  <div className={`max-w-[78%] rounded-3xl px-5 py-3.5 shadow-md ${msg.role==="user"?"rounded-br-lg":"rounded-bl-lg"}`}
                    style={msg.role==="user"
                      ?{ background:"linear-gradient(135deg,#7B1818,#A02020)", color:"white" }
                      :{ background:"rgba(255,255,255,0.95)", color:"#2D1A0A", border:"1px solid rgba(212,168,67,0.3)", backdropFilter:"blur(4px)" }}>

                    {msg.role==="assistant"
                      ?<div className="text-sm leading-relaxed [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-1.5">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      :<p className="text-sm leading-relaxed">{msg.content}</p>
                    }

                    {msg.role==="assistant" && msg.is_fallback && (
                      <div className="mt-2.5 flex items-start gap-1.5 text-xs italic rounded-xl px-3 py-2"
                        style={{ background:"#FFF8E7", color:"#B7791F" }}>
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5"/>
                        Không tìm thấy thông tin chính xác, đây là câu trả lời tổng quát.
                      </div>
                    )}

                    {msg.role==="assistant" && msg.retrieved_chunks && msg.retrieved_chunks.length>0 && !msg.is_fallback && (
                      <details className="mt-2.5">
                        <summary className="cursor-pointer text-xs font-semibold select-none" style={{color:"#C9973C"}}>
                          ▼ Nguồn tham khảo ({msg.retrieved_chunks.length})
                        </summary>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {msg.retrieved_chunks.map((c,j)=>(
                            <span key={j} className="inline-flex items-center rounded-full text-[11px] px-2.5 py-1"
                              style={{ background:"#FDF6EC", color:"#7B1818", border:"1px solid #E8C06A" }}>
                              {c.document_title||c.ma_thu_tuc}{c.score>0?` · ${(c.score*100).toFixed(0)}%`:""}
                            </span>
                          ))}
                        </div>
                      </details>
                    )}

                    {msg.role==="assistant" && msg.response_time_ms!==undefined && (
                      <p className="mt-1.5 text-[10px]" style={{color:"#C0A888"}}>{(msg.response_time_ms/1000).toFixed(1)}s</p>
                    )}
                  </div>

                  {msg.role==="user" && (
                    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-md mb-1 text-white text-sm font-bold"
                      style={{ background:"linear-gradient(135deg,#9B2020,#6B1414)" }}>U</div>
                  )}
                </div>
              ))}

              {/* Loading */}
              {loading && (
                <div className="flex items-end gap-3">
                  <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 shadow-md mb-1"><BirdLogo size={36}/></div>
                  <div className="rounded-3xl rounded-bl-lg px-5 py-3.5 shadow-md flex items-center gap-3"
                    style={{ background:"rgba(255,255,255,0.95)", border:"1px solid rgba(212,168,67,0.3)" }}>
                    <span className="text-sm" style={{color:"#8B5A2B"}}>Đang tra cứu thông tin...</span>
                    <div className="flex gap-1">
                      {["-0.3s","-0.15s","0s"].map(d=>(
                        <span key={d} className="w-2 h-2 rounded-full animate-bounce"
                          style={{ background:"#C9973C", animationDelay:d }}/>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef}/>
            </div>
          )}
        </div>

        {/* ── INPUT BAR ── */}
        <div className="shrink-0 px-4 py-4"
          style={{ background:"rgba(255,251,245,0.85)", backdropFilter:"blur(12px)", borderTop:"1px solid rgba(212,168,67,0.3)" }}>
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <input ref={inputRef} type="text" value={input}
              onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter") sendMessage(); }}
              placeholder="Nhập câu hỏi về thủ tục hành chính..."
              disabled={loading}
              className="flex-1 rounded-full px-6 py-3.5 text-sm outline-none transition-all"
              style={{ background:"rgba(255,255,255,0.95)", border:"1.5px solid #E8D8C0", color:"#3D1A0E", boxShadow:"0 2px 8px rgba(0,0,0,0.06)" }}
              onFocus={e=>{ e.currentTarget.style.borderColor="#C9973C"; e.currentTarget.style.boxShadow="0 0 0 3px rgba(201,151,60,0.18)"; }}
              onBlur={e=>{ e.currentTarget.style.borderColor="#E8D8C0"; e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,0.06)"; }}
            />
            <button onClick={()=>sendMessage()} disabled={loading||!input.trim()}
              className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all disabled:opacity-40"
              style={{ background:"linear-gradient(135deg,#C9973C,#E8A020)" }}
              onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.transform="scale(1.08)"; (e.currentTarget as HTMLElement).style.boxShadow="0 4px 16px rgba(201,151,60,0.5)"; }}
              onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.transform="scale(1)"; (e.currentTarget as HTMLElement).style.boxShadow=""; }}>
              <PaperPlane/>
            </button>
          </div>
          <p className="mt-2 text-center text-[10px]" style={{color:"#B8956A"}}>
            ✦ Thông tin chỉ mang tính tham khảo, vui lòng đối chiếu với cơ quan có thẩm quyền để được hướng dẫn chính xác.
          </p>
        </div>
      </div>

      {/* ── INFO MODAL ── */}
      {infoOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={()=>setInfoOpen(false)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base flex items-center gap-2" style={{color:"#7B1818"}}>
                <Info className="w-5 h-5"/>Giới thiệu
              </h3>
              <button onClick={()=>setInfoOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-500">
                <X className="w-4 h-4"/>
              </button>
            </div>
            <p className="text-sm leading-relaxed text-gray-700 mb-3">
              <strong>Trợ lý ảo TTHC</strong> hỗ trợ tra cứu thủ tục hành chính công: hồ sơ cần chuẩn bị, trình tự thực hiện, thời hạn giải quyết — dựa trên các nghị định, thông tư hiện hành.
            </p>
            <p className="text-xs text-gray-400">Lưu ý: thông tin chỉ mang tính tham khảo.</p>
          </div>
        </div>
      )}
    </div>
  );
}
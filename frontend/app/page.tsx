"use client";

import ReactMarkdown from "react-markdown";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import {
  Trash2, AlertTriangle, Settings, Info, X,
  Users, Car, Building2, CreditCard,
  LayoutDashboard, Sun, Moon, Zap, CheckCircle, Heart
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const BirdLogo = ({ size = 40 }: { size?: number }) => (
  <img src="/bird-logo.png" width={size} height={size} alt="logo" style={{ objectFit:"contain" }} />
);

const PaperPlane = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
    <path d="M21.5 2.5L10 13" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
    <path d="M21.5 2.5L14.5 21.5L10 13L2 9L21.5 2.5Z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M10 13L12 16" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.6"/>
  </svg>
);

const SUGGESTIONS = [
  { icon: Users,     text: "Thủ tục đăng ký kết hôn",     sub: "Giấy tờ & hồ sơ cần chuẩn bị" },
  { icon: Car,       text: "Đăng ký xe máy",               sub: "Trình tự và thủ tục thực hiện" },
  { icon: CreditCard,text: "Cấp lại CCCD bị mất",          sub: "Hồ sơ & nơi nộp đơn" },
  { icon: Building2, text: "Đăng ký hộ kinh doanh",        sub: "Điều kiện & thủ tục đăng ký" },
];

interface RetrievedChunk { content:string; document_title:string; ma_thu_tuc:string; score:number; }
interface ChatMessage {
  role: "user"|"assistant"; content:string;
  retrieved_chunks?: RetrievedChunk[]; is_fallback?:boolean; response_time_ms?:number;
}

export default function Home() {
  const [sessionId,    setSessionId]    = useState<string|null>(null);
  const [messages,     setMessages]     = useState<ChatMessage[]>([]);
  const [input,        setInput]        = useState("");
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string|null>(null);
  const [darkMode,     setDarkMode]     = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [infoOpen,     setInfoOpen]     = useState(false);
  const bottomRef   = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLInputElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const s = localStorage.getItem("tthc_session_id");
    const m = localStorage.getItem("tthc_messages");
    if (s) { setSessionId(s); if (m) try { setMessages(JSON.parse(m)); } catch {} return; }
    fetch(`${API_URL}/api/v1/sessions`,{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"})
      .then(r=>r.json()).then(d=>{setSessionId(d.id);localStorage.setItem("tthc_session_id",d.id);}).catch(()=>{});
  },[]);

  useEffect(()=>{
    const h=(e:MouseEvent)=>{ if(settingsRef.current&&!settingsRef.current.contains(e.target as Node)) setSettingsOpen(false); };
    document.addEventListener("mousedown",h); return()=>document.removeEventListener("mousedown",h);
  },[]);

  useEffect(()=>{ if(messages.length>0) localStorage.setItem("tthc_messages",JSON.stringify(messages)); },[messages]);
  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages,loading]);
  useEffect(()=>{ if(!loading) inputRef.current?.focus(); },[loading]);

  const sendMessage = async (preset?:string) => {
    const q=(preset??input).trim(); if(!q||loading) return;
    setMessages(p=>[...p,{role:"user",content:q}]);
    setInput(""); setLoading(true); setError(null);
    try {
      const res=await fetch(`${API_URL}/api/v1/chat`,{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({session_id:sessionId||null,question:q}),
      });
      if(!res.ok) throw new Error();
      const d=await res.json();
      if(!sessionId&&d.session_id){const sid=String(d.session_id);setSessionId(sid);localStorage.setItem("tthc_session_id",sid);}
      setMessages(p=>[...p,{role:"assistant",content:d.answer,retrieved_chunks:d.retrieved_chunks,is_fallback:d.is_fallback,response_time_ms:d.response_time_ms}]);
    } catch { setError("Không thể kết nối tới server."); setMessages(p=>p.slice(0,-1)); setInput(q); }
    finally { setLoading(false); }
  };

  const clearHistory=()=>{
    localStorage.removeItem("tthc_session_id"); localStorage.removeItem("tthc_messages");
    setMessages([]); setSessionId(null); setError(null);
    fetch(`${API_URL}/api/v1/sessions`,{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"})
      .then(r=>r.json()).then(d=>{setSessionId(d.id);localStorage.setItem("tthc_session_id",d.id);}).catch(()=>{});
  };

  return (
    <div className="h-screen w-full flex flex-col"
      style={{backgroundImage:"url('/bg-lotus.png')",backgroundSize:"cover",backgroundPosition:"center",backgroundAttachment:"fixed"}}>

      {/* HEADER */}
      <header className="shrink-0 flex items-center justify-between px-8 py-4"
        style={{background:"linear-gradient(135deg,#5C1010 0%,#8B1A1A 50%,#6B1414 100%)",boxShadow:"0 4px 24px rgba(0,0,0,0.4)"}}>
        <div className="flex items-center gap-4">
          <div className="rounded-2xl overflow-hidden shadow-lg" style={{background:"rgba(255,255,255,0.1)",padding:"4px"}}>
            <BirdLogo size={48}/>
          </div>
          <div>
            <h1 className="text-white font-bold text-xl tracking-widest" style={{textShadow:"0 2px 8px rgba(0,0,0,0.3)"}}>
              TRỢ LÝ ẢO TTHC
            </h1>
            <p className="text-xs tracking-wider font-medium" style={{color:"#E8C06A"}}>
              VNPT TP.HCM  ·  Tra cứu thủ tục hành chính công
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 relative" ref={settingsRef}>
          {([
            {icon:Info,    label:"Thông tin",   action:()=>setInfoOpen(true)},
            {icon:Trash2,  label:"Xóa lịch sử", action:clearHistory},
            {icon:Settings,label:"Cài đặt",      action:()=>setSettingsOpen(v=>!v)},
          ] as const).map(({icon:Icon,label,action})=>(
            <button key={label} onClick={action}
              className="flex flex-col items-center gap-0.5 px-4 py-2.5 rounded-xl text-white transition-all hover:bg-white/15 active:bg-white/25">
              <Icon className="w-5 h-5"/>
              <span className="text-[10px] font-medium tracking-wide">{label}</span>
            </button>
          ))}
          {settingsOpen&&(
            <div className="absolute right-0 top-16 w-56 rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden z-50">
              <div className="p-3 border-b border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Hiển thị</p>
                <button onClick={()=>{const n=!darkMode;setDarkMode(n);document.documentElement.classList.toggle("dark",n);}}
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

      {/* BODY */}
      <div className="flex-1 flex flex-col overflow-hidden"
        style={{background:"rgba(255,250,244,0.72)",backdropFilter:"blur(1px)"}}>

        {error&&(
          <div className="mx-auto mt-3 max-w-2xl w-full px-4 shrink-0">
            <div className="rounded-2xl bg-red-50/90 border border-red-200 px-4 py-2.5 text-sm text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0"/>{error}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">

          {/* WELCOME */}
          {messages.length===0&&(
            <div className="h-full flex flex-col items-center justify-center px-6 py-8">

              {/* Logo */}
              <div className="mb-5 relative">
                <div className="absolute inset-0 rounded-full blur-2xl opacity-40"
                  style={{background:"radial-gradient(circle,#E8C06A,transparent)",transform:"scale(1.5)"}}/>
                <BirdLogo size={96}/>
              </div>

              {/* Title */}
              <h2 className="text-3xl font-bold mb-2 text-center"
                style={{color:"#5C1010",textShadow:"0 1px 4px rgba(92,16,16,0.15)"}}>
                Xin chào! Tôi có thể giúp gì cho bạn?
              </h2>
              <p className="text-sm text-center mb-1" style={{color:"#8B5A2B"}}>
                Trợ lý AI hỗ trợ tra cứu thủ tục hành chính công 24/7
              </p>
              <p className="text-xs text-center mb-6" style={{color:"#B8956A"}}>
                Giấy tờ cần chuẩn bị · Trình tự thực hiện · Thời hạn giải quyết
              </p>

              {/* Badges */}
              <div className="flex gap-3 mb-8 flex-wrap justify-center">
                {[{icon:Zap,text:"Nhanh chóng"},{icon:CheckCircle,text:"Chính xác"},{icon:Heart,text:"Thuận tiện"}].map(({icon:Icon,text})=>(
                  <div key={text} className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold"
                    style={{background:"rgba(255,255,255,0.9)",color:"#7B1818",border:"1.5px solid #D4A843",boxShadow:"0 2px 8px rgba(212,168,67,0.2)"}}>
                    <Icon className="w-3.5 h-3.5" style={{color:"#C9973C"}}/>{text}
                  </div>
                ))}
              </div>

              {/* Suggestions — 2×2 grid */}
              <div className="grid grid-cols-2 gap-3 w-full max-w-2xl">
                {SUGGESTIONS.map(({icon:Icon,text,sub})=>(
                  <button key={text} onClick={()=>sendMessage(text+"?")} disabled={loading}
                    className="flex items-start gap-3 p-4 rounded-2xl text-left transition-all duration-200 disabled:opacity-50 group"
                    style={{background:"rgba(255,255,255,0.88)",border:"1.5px solid rgba(212,168,67,0.35)",backdropFilter:"blur(4px)",boxShadow:"0 2px 12px rgba(0,0,0,0.07)"}}
                    onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.background="rgba(255,255,255,0.98)";el.style.borderColor="#C9973C";el.style.boxShadow="0 6px 20px rgba(201,151,60,0.25)";el.style.transform="translateY(-2px)";}}
                    onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.background="rgba(255,255,255,0.88)";el.style.borderColor="rgba(212,168,67,0.35)";el.style.boxShadow="0 2px 12px rgba(0,0,0,0.07)";el.style.transform="translateY(0)";}}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                      style={{background:"linear-gradient(135deg,#F5E8D5,#EDD9B8)"}}>
                      <Icon className="w-5 h-5" style={{color:"#C9973C"}}/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold mb-0.5 leading-snug" style={{color:"#3D1A0E"}}>{text}</p>
                      <p className="text-xs leading-snug" style={{color:"#9B7B5A"}}>{sub}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* CHAT */}
          {messages.length>0&&(
            <div className="max-w-3xl mx-auto w-full px-4 py-6 space-y-5">
              {messages.map((msg,i)=>(
                <div key={i} className={`flex items-end gap-3 ${msg.role==="user"?"justify-end":"justify-start"}`}>
                  {msg.role==="assistant"&&(
                    <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 shadow-md mb-1">
                      <BirdLogo size={36}/>
                    </div>
                  )}
                  <div className={`max-w-[78%] rounded-3xl px-5 py-3.5 shadow-md ${msg.role==="user"?"rounded-br-lg":"rounded-bl-lg"}`}
                    style={msg.role==="user"
                      ?{background:"linear-gradient(135deg,#7B1818,#A02020)",color:"white"}
                      :{background:"rgba(255,255,255,0.95)",color:"#2D1A0A",border:"1px solid rgba(212,168,67,0.3)"}}>
                    {msg.role==="assistant"
                      ?<div className="text-sm leading-relaxed [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-1.5">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      :<p className="text-sm leading-relaxed">{msg.content}</p>
                    }
                    {msg.role==="assistant"&&msg.is_fallback&&(
                      <div className="mt-2.5 flex items-start gap-1.5 text-xs italic rounded-xl px-3 py-2"
                        style={{background:"#FFF8E7",color:"#B7791F"}}>
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5"/>
                        Không tìm thấy thông tin chính xác, đây là câu trả lời tổng quát.
                      </div>
                    )}
                    {msg.role==="assistant"&&msg.retrieved_chunks&&msg.retrieved_chunks.length>0&&!msg.is_fallback&&(
                      <details className="mt-2.5">
                        <summary className="cursor-pointer text-xs font-semibold select-none" style={{color:"#C9973C"}}>
                          ▼ Nguồn tham khảo ({msg.retrieved_chunks.length})
                        </summary>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {msg.retrieved_chunks.map((c,j)=>(
                            <span key={j} className="inline-flex items-center rounded-full text-[11px] px-2.5 py-1"
                              style={{background:"#FDF6EC",color:"#7B1818",border:"1px solid #E8C06A"}}>
                              {c.document_title||c.ma_thu_tuc}{c.score>0?` · ${(c.score*100).toFixed(0)}%`:""}
                            </span>
                          ))}
                        </div>
                      </details>
                    )}
                    {msg.role==="assistant"&&msg.response_time_ms!==undefined&&(
                      <p className="mt-1.5 text-[10px]" style={{color:"#C0A888"}}>{(msg.response_time_ms/1000).toFixed(1)}s</p>
                    )}
                  </div>
                  {msg.role==="user"&&(
                    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-md mb-1 text-white text-sm font-bold"
                      style={{background:"linear-gradient(135deg,#9B2020,#6B1414)"}}>U</div>
                  )}
                </div>
              ))}

              {loading&&(
                <div className="flex items-end gap-3">
                  <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 shadow-md mb-1"><BirdLogo size={36}/></div>
                  <div className="rounded-3xl rounded-bl-lg px-5 py-3.5 shadow-md flex items-center gap-3"
                    style={{background:"rgba(255,255,255,0.95)",border:"1px solid rgba(212,168,67,0.3)"}}>
                    <span className="text-sm" style={{color:"#8B5A2B"}}>Đang tra cứu thông tin...</span>
                    <div className="flex gap-1">
                      {["-0.3s","-0.15s","0s"].map(d=>(
                        <span key={d} className="w-2 h-2 rounded-full animate-bounce"
                          style={{background:"#C9973C",animationDelay:d}}/>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef}/>
            </div>
          )}
        </div>

        {/* INPUT */}
        <div className="shrink-0 px-6 py-4"
          style={{background:"rgba(255,251,245,0.92)",backdropFilter:"blur(16px)",borderTop:"1px solid rgba(212,168,67,0.25)",boxShadow:"0 -4px 24px rgba(0,0,0,0.06)"}}>
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <input ref={inputRef} type="text" value={input}
              onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter") sendMessage();}}
              placeholder="Nhập câu hỏi về thủ tục hành chính..."
              disabled={loading}
              className="flex-1 rounded-full px-6 py-3.5 text-sm outline-none transition-all"
              style={{background:"rgba(255,255,255,0.95)",border:"1.5px solid #E8D8C0",color:"#3D1A0E",boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}
              onFocus={e=>{e.currentTarget.style.borderColor="#C9973C";e.currentTarget.style.boxShadow="0 0 0 3px rgba(201,151,60,0.18)";}}
              onBlur={e=>{e.currentTarget.style.borderColor="#E8D8C0";e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,0.06)";}}
            />
            <button onClick={()=>sendMessage()} disabled={loading||!input.trim()}
              className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all disabled:opacity-40"
              style={{background:"linear-gradient(135deg,#C9973C,#E8A020)"}}
              onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.transform="scale(1.1)";el.style.boxShadow="0 6px 20px rgba(201,151,60,0.5)";}}
              onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.transform="scale(1)";el.style.boxShadow="";}}>
              <PaperPlane/>
            </button>
          </div>
          <p className="mt-2 text-center text-[10px]" style={{color:"#B8956A"}}>
            ✦ Thông tin chỉ mang tính tham khảo · Vui lòng đối chiếu với cơ quan có thẩm quyền
          </p>
        </div>
      </div>

      {/* INFO MODAL */}
      {infoOpen&&(
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-md px-4"
          onClick={()=>setInfoOpen(false)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base flex items-center gap-2" style={{color:"#7B1818"}}>
                <Info className="w-5 h-5"/>Giới thiệu
              </h3>
              <button onClick={()=>setInfoOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-500">
                <X className="w-4 h-4"/>
              </button>
            </div>
            <p className="text-sm leading-relaxed text-gray-700 mb-3">
              <strong>Trợ lý ảo TTHC</strong> hỗ trợ tra cứu thủ tục hành chính công: hồ sơ cần chuẩn bị, trình tự thực hiện, thời hạn giải quyết — dựa trên nghị định và thông tư hiện hành.
            </p>
            <p className="text-xs text-gray-400">Thông tin chỉ mang tính tham khảo.</p>
          </div>
        </div>
      )}
    </div>
  );
}
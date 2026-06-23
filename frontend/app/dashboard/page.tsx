"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import {
  ArrowLeft, RefreshCw, MessageSquare,
  Users, AlertTriangle, Clock,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, Label, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line,
} from "recharts";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface StatsData {
  total_sessions: number;
  total_questions: number;
  fallback_count: number;
  fallback_rate: number;
  avg_response_time_ms: number;
  top_thu_tuc: { ten_thu_tuc: string; count: number }[];
  daily_questions: { date: string; count: number }[];
}

function KpiCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; accent: string;
}) {
  return (
    <div className="rounded-2xl p-5 flex items-center gap-4"
      style={{ background:"rgba(255,255,255,0.92)", border:`1.5px solid rgba(201,151,60,0.25)`, boxShadow:"0 2px 12px rgba(0,0,0,0.07)" }}>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: accent }}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium" style={{ color:"#9B7B5A" }}>{label}</p>
        <p className="text-2xl font-bold" style={{ color:"#3D1A0E" }}>{value}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color:"#B8956A" }}>{sub}</p>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData]               = useState<StatsData | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const fetchStats = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/stats`);
      if (!res.ok) throw new Error(`Lỗi ${res.status}`);
      setData(await res.json());
      setLastUpdated(new Date().toLocaleTimeString("vi-VN"));
    } catch {
      setError("Không thể tải dữ liệu. Kiểm tra backend đã chạy chưa.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const pieData = data ? [
    { name:"Trả lời thành công", value: data.total_questions - data.fallback_count },
    { name:"Fallback",            value: data.fallback_count },
  ] : [];
  const PIE_COLORS = ["#7B1818","#C9973C"];
  const avgSeconds = data ? (data.avg_response_time_ms / 1000).toFixed(1) : "—";

  const tooltipStyle = { borderRadius:"12px", border:"1px solid #E8C06A", fontSize:"12px" };

  return (
    <div className="min-h-screen"
      style={{ backgroundImage:"url('/bg-lotus.png')", backgroundSize:"cover",
               backgroundPosition:"center top", backgroundAttachment:"fixed" }}>

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-3"
        style={{ background:"linear-gradient(135deg,#5C1010 0%,#8B1A1A 55%,#6B1414 100%)",
                 boxShadow:"0 2px 20px rgba(0,0,0,0.45)" }}>
        <div className="absolute inset-0 opacity-15 pointer-events-none"
          style={{ backgroundImage:"url('/bg-vietnam.jpg')", backgroundSize:"120%",
                   backgroundPosition:"right center", mixBlendMode:"luminosity" }}/>

        <div className="flex items-center gap-3 relative z-10">
          <Link href="/"
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-white/15"
            style={{ background:"rgba(255,255,255,0.12)" }}>
            <ArrowLeft className="w-4 h-4 text-white"/>
          </Link>
          <div>
            <h1 className="text-white font-bold text-lg tracking-widest drop-shadow">
              DASHBOARD HIỆU SUẤT
            </h1>
            <p className="text-xs tracking-wider" style={{ color:"#E8C06A" }}>
              VNPT TP.HCM — Phân tích xử lý hồ sơ & chatbot
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 relative z-10">
          {lastUpdated && (
            <span className="text-xs" style={{ color:"rgba(232,192,106,0.7)" }}>
              Cập nhật: {lastUpdated}
            </span>
          )}
          <button onClick={fetchStats} disabled={loading}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-white/15 disabled:opacity-50"
            style={{ background:"rgba(255,255,255,0.12)" }}>
            <RefreshCw className={`w-4 h-4 text-white ${loading?"animate-spin":""}`}/>
          </button>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-5">

        {error && (
          <div className="rounded-2xl px-4 py-3 text-sm flex items-center gap-2"
            style={{ background:"rgba(255,248,240,0.95)", border:"1.5px solid #E8C06A", color:"#7B1818" }}>
            <AlertTriangle className="w-4 h-4 shrink-0"/>{error}
          </div>
        )}

        {loading && !data && (
          <div className="text-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color:"#C9973C" }}/>
            <p className="text-sm font-medium" style={{ color:"#B8956A" }}>Đang tải dữ liệu...</p>
          </div>
        )}

        {data && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard icon={<Users className="w-5 h-5 text-white"/>}
                accent="linear-gradient(135deg,#7B1818,#9B2020)"
                label="Tổng phiên làm việc" value={data.total_sessions.toString()} sub="sessions"/>
              <KpiCard icon={<MessageSquare className="w-5 h-5 text-white"/>}
                accent="linear-gradient(135deg,#C9973C,#E8A020)"
                label="Tổng câu hỏi" value={data.total_questions.toString()} sub="lượt hỏi"/>
              <KpiCard icon={<AlertTriangle className="w-5 h-5 text-white"/>}
                accent="linear-gradient(135deg,#9B6020,#C9973C)"
                label="Tỷ lệ Fallback" value={`${data.fallback_rate}%`}
                sub={`${data.fallback_count} câu không tìm được`}/>
              <KpiCard icon={<Clock className="w-5 h-5 text-white"/>}
                accent="linear-gradient(135deg,#6B1414,#8B1A1A)"
                label="Thời gian phản hồi TB" value={`${avgSeconds}s`} sub="trung bình mỗi câu"/>
            </div>

            {/* Pie + Line */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="rounded-2xl p-5"
                style={{ background:"rgba(255,255,255,0.92)", border:"1.5px solid rgba(201,151,60,0.2)",
                         boxShadow:"0 2px 12px rgba(0,0,0,0.07)" }}>
                <h2 className="text-sm font-bold tracking-wide mb-4" style={{ color:"#7B1818" }}>
                  TỶ LỆ TRẢ LỜI THÀNH CÔNG / FALLBACK
                </h2>
                {data.total_questions === 0
                  ? <p className="text-sm text-center py-10" style={{ color:"#B8956A" }}>Chưa có dữ liệu</p>
                  : (
                    <ResponsiveContainer width="100%" height={230}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={65} outerRadius={95}
                          paddingAngle={3} dataKey="value">
                          {pieData.map((_,i)=><Cell key={i} fill={PIE_COLORS[i]}/>)}
                          <Label value={`${(100-data.fallback_rate).toFixed(1)}%`} position="center"
                            fill="#7B1818" fontSize={28} fontWeight="bold"/>
                        </Pie>
                        <Tooltip formatter={(v:unknown)=>[`${Number(v)||0} câu`,""]}
                          contentStyle={tooltipStyle}/>
                      </PieChart>
                    </ResponsiveContainer>
                  )
                }
                <div className="flex items-center justify-center gap-6 mt-2">
                  {pieData.map((d,i)=>(
                    <div key={i} className="flex items-center gap-1.5 text-xs" style={{ color:"#7B5A2B" }}>
                      <span className="w-3 h-3 rounded-full" style={{ background:PIE_COLORS[i] }}/>
                      {d.name} ({d.value})
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl p-5"
                style={{ background:"rgba(255,255,255,0.92)", border:"1.5px solid rgba(201,151,60,0.2)",
                         boxShadow:"0 2px 12px rgba(0,0,0,0.07)" }}>
                <h2 className="text-sm font-bold tracking-wide mb-4" style={{ color:"#7B1818" }}>
                  LƯỢNG CÂU HỎI THEO NGÀY (7 NGÀY GẦN NHẤT)
                </h2>
                {data.daily_questions.length === 0
                  ? <p className="text-sm text-center py-10" style={{ color:"#B8956A" }}>Chưa có dữ liệu</p>
                  : (
                    <ResponsiveContainer width="100%" height={230}>
                      <LineChart data={data.daily_questions}
                        margin={{ top:5, right:20, left:0, bottom:5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F5E8D5"/>
                        <XAxis dataKey="date" tick={{ fontSize:11, fill:"#9B7B5A" }}
                          tickFormatter={v=>v.slice(5)}/>
                        <YAxis tick={{ fontSize:11, fill:"#9B7B5A" }} allowDecimals={false}/>
                        <Tooltip labelFormatter={v=>`Ngày ${v}`}
                          formatter={(v:unknown)=>[`${Number(v)||0} câu hỏi`,""]}
                          contentStyle={tooltipStyle}/>
                        <Line type="monotone" dataKey="count" stroke="#C9973C" strokeWidth={2.5}
                          dot={{ r:4, fill:"#C9973C", strokeWidth:0 }}
                          activeDot={{ r:6, fill:"#7B1818" }} name="Câu hỏi"/>
                      </LineChart>
                    </ResponsiveContainer>
                  )
                }
              </div>
            </div>

            {/* Bar Chart */}
            <div className="rounded-2xl p-5"
              style={{ background:"rgba(255,255,255,0.92)", border:"1.5px solid rgba(201,151,60,0.2)",
                       boxShadow:"0 2px 12px rgba(0,0,0,0.07)" }}>
              <h2 className="text-sm font-bold tracking-wide mb-4" style={{ color:"#7B1818" }}>
                THỦ TỤC HÀNH CHÍNH ĐƯỢC HỎI NHIỀU NHẤT
              </h2>
              {data.top_thu_tuc.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-sm" style={{ color:"#B8956A" }}>
                    Dữ liệu sẽ xuất hiện sau khi có thêm câu hỏi mới.
                  </p>
                  <p className="text-xs mt-1" style={{ color:"#C9AA80" }}>
                    (Dữ liệu cũ trước 16/06 chưa lưu tên thủ tục)
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.top_thu_tuc.slice(0,8)} layout="vertical"
                    margin={{ left:20, right:40, top:5, bottom:5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5E8D5"/>
                    <XAxis type="number" tick={{ fontSize:11, fill:"#9B7B5A" }} allowDecimals={false}/>
                    <YAxis type="category" dataKey="ten_thu_tuc" width={210}
                      tick={{ fontSize:11, fill:"#5A3A1A" }}
                      tickFormatter={(v:string)=>v.length>34?v.slice(0,34)+"…":v}/>
                    <Tooltip formatter={(v:unknown)=>[`${Number(v)||0} lượt`,"Số lần hỏi"]}
                      contentStyle={tooltipStyle}/>
                    <Bar dataKey="count" radius={[0,6,6,0]} fill="#C9973C" name="Lượt hỏi"/>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <p className="text-center text-xs pb-4" style={{ color:"#B8956A" }}>
              ✦ Dữ liệu cập nhật theo thời gian thực từ hệ thống chatbot TTHC — VNPT TP.HCM
            </p>
          </>
        )}
      </main>
    </div>
  );
}
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, RefreshCw, MessageSquare, Users, AlertTriangle,
  Clock, Target, LayoutDashboard,
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

function KpiCard({ icon, label, value, sub, accent, color }: {
  icon: React.ReactNode; label: string; value: string | number;
  sub?: string; accent?: string; color?: string;
}) {
  return (
    <div className="rounded-2xl flex items-center gap-3 p-4 transition-all hover:shadow-lg hover:-translate-y-0.5 duration-200"
      style={{ background: "rgba(255,255,255,0.92)", border: "1.5px solid rgba(201,151,60,0.2)", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: accent || "linear-gradient(135deg,#7B1818,#9B2020)" }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "#9B7B5A" }}>{label}</p>
        <p className="text-2xl font-bold" style={{ color: color || "#3D1A0E" }}>{value}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color: "#B8956A" }}>{sub}</p>}
      </div>
    </div>
  );
}

const tooltipStyle = {
  borderRadius: "12px", border: "1px solid #E8C06A",
  fontSize: "11px", background: "white", boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
};

export default function DashboardChatbotPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`${API_URL}/api/v1/stats`);
      if (!r.ok) throw new Error(`Lỗi ${r.status}`);
      setStats(await r.json());
      setLastUpdated(new Date().toLocaleTimeString("vi-VN"));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Không thể tải dữ liệu.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const avgSeconds = stats ? (stats.avg_response_time_ms / 1000).toFixed(1) : "—";
  const pieData = stats ? [
    { name: "Thành công", value: stats.total_questions - stats.fallback_count },
    { name: "Fallback", value: stats.fallback_count },
  ] : [];
  const PIE_COLORS = ["#7B1818", "#C9973C"];

  return (
    <div className="min-h-screen"
      style={{ backgroundImage: "url('/bg-lotus.png')", backgroundSize: "cover", backgroundPosition: "center top", backgroundAttachment: "fixed" }}>

      {/* HEADER */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-3"
        style={{ background: "linear-gradient(135deg,#5C1010 0%,#8B1A1A 55%,#6B1414 100%)", boxShadow: "0 2px 20px rgba(0,0,0,0.45)" }}>
        <div className="absolute inset-0 opacity-15 pointer-events-none"
          style={{ backgroundImage: "url('/bg-vietnam.jpg')", backgroundSize: "120%", backgroundPosition: "right center", mixBlendMode: "luminosity" }} />
        <div className="flex items-center gap-3 relative z-10">
          <Link href="/" className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-white/15"
            style={{ background: "rgba(255,255,255,0.12)" }}>
            <ArrowLeft className="w-4 h-4 text-white" />
          </Link>
          <div>
            <h1 className="text-white font-bold text-lg tracking-widest drop-shadow">DASHBOARD CHATBOT AI</h1>
            <p className="text-[10px] tracking-wider" style={{ color: "#E8C06A" }}>Hiệu suất phản hồi & thống kê tra cứu — VNPT TP.HCM</p>
          </div>
        </div>
        <div className="flex items-center gap-3 relative z-10">
          <Link href="/dashboard/hoso"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all hover:bg-white/20"
            style={{ background: "rgba(255,255,255,0.12)", color: "#E8C06A" }}>
            <LayoutDashboard className="w-3.5 h-3.5" />
            Dashboard Hồ Sơ
          </Link>
          {lastUpdated && <span className="text-[10px]" style={{ color: "rgba(232,192,106,0.7)" }}>Cập nhật: {lastUpdated}</span>}
          <button onClick={fetchData} disabled={loading}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-white/15 disabled:opacity-50"
            style={{ background: "rgba(255,255,255,0.12)" }}>
            <RefreshCw className={`w-4 h-4 text-white ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        {error && (
          <div className="rounded-2xl px-4 py-3 text-sm flex items-center gap-2"
            style={{ background: "rgba(255,248,240,0.95)", border: "1.5px solid #E8C06A", color: "#7B1818" }}>
            <AlertTriangle className="w-4 h-4 shrink-0" />{error}
          </div>
        )}
        {loading && !stats && (
          <div className="text-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: "#C9973C" }} />
            <p className="text-sm font-medium" style={{ color: "#B8956A" }}>Đang tải dữ liệu...</p>
          </div>
        )}

        {stats && (
          <>
            {/* KPI */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <KpiCard icon={<Users className="w-5 h-5 text-white" />}
                accent="linear-gradient(135deg,#7B1818,#9B2020)" label="Phiên chat"
                value={stats.total_sessions} sub="tổng sessions" />
              <KpiCard icon={<MessageSquare className="w-5 h-5 text-white" />}
                accent="linear-gradient(135deg,#C9973C,#E8A020)" label="Câu hỏi"
                value={stats.total_questions} sub="tổng lượt hỏi" />
              <KpiCard icon={<Target className="w-5 h-5 text-white" />}
                accent="linear-gradient(135deg,#1B8A4A,#2BAD6B)" label="Độ chính xác"
                value={`${(100 - stats.fallback_rate).toFixed(1)}%`}
                sub={`${stats.fallback_count} fallback`} color="#1B8A4A" />
              <KpiCard icon={<Clock className="w-5 h-5 text-white" />}
                accent="linear-gradient(135deg,#4A4A8A,#6B6BA8)" label="Thời gian TB"
                value={`${avgSeconds}s`} sub="mỗi câu trả lời" />
            </div>

            {/* TỶ LỆ THÀNH CÔNG + LƯỢNG CÂU HỎI THEO NGÀY */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="rounded-2xl p-5"
                style={{ background: "rgba(255,255,255,0.92)", border: "1.5px solid rgba(201,151,60,0.2)", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
                <h3 className="text-xs font-bold tracking-wide mb-4" style={{ color: "#7B1818" }}>TỶ LỆ TRẢ LỜI THÀNH CÔNG / FALLBACK</h3>
                {stats.total_questions === 0 ? (
                  <p className="text-sm text-center py-10" style={{ color: "#B8956A" }}>Chưa có dữ liệu</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                          {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                          <Label value={`${(100 - stats.fallback_rate).toFixed(1)}%`} position="center" fill="#7B1818" fontSize={22} fontWeight="bold" />
                        </Pie>
                        <Tooltip formatter={(v: unknown) => [`${Number(v) || 0} câu`, ""]} contentStyle={tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex items-center justify-center gap-6 mt-2">
                      {pieData.map((d, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs" style={{ color: "#5A3A1A" }}>
                          <span className="w-3 h-3 rounded-full" style={{ background: PIE_COLORS[i] }} />
                          {d.name} ({d.value})
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="rounded-2xl p-5"
                style={{ background: "rgba(255,255,255,0.92)", border: "1.5px solid rgba(201,151,60,0.2)", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
                <h3 className="text-xs font-bold tracking-wide mb-4" style={{ color: "#7B1818" }}>LƯỢNG CÂU HỎI THEO NGÀY (7 NGÀY GẦN NHẤT)</h3>
                {stats.daily_questions.length === 0 ? (
                  <p className="text-sm text-center py-10" style={{ color: "#B8956A" }}>Chưa có dữ liệu</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={stats.daily_questions} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F5E8D5" />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#9B7B5A" }} tickFormatter={v => v.slice(5)} />
                      <YAxis tick={{ fontSize: 9, fill: "#9B7B5A" }} allowDecimals={false} />
                      <Tooltip labelFormatter={v => `Ngày ${v}`} formatter={(v: unknown) => [`${Number(v) || 0} câu hỏi`, ""]} contentStyle={tooltipStyle} />
                      <Line type="monotone" dataKey="count" stroke="#C9973C" strokeWidth={2}
                        dot={{ r: 3, fill: "#C9973C", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#7B1818" }} name="Câu hỏi" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* TOP THỦ TỤC ĐƯỢC HỎI NHIỀU */}
            <div className="rounded-2xl p-5"
              style={{ background: "rgba(255,255,255,0.92)", border: "1.5px solid rgba(201,151,60,0.2)", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
              <h3 className="text-xs font-bold tracking-wide mb-4" style={{ color: "#7B1818" }}>THỦ TỤC HÀNH CHÍNH ĐƯỢC HỎI NHIỀU NHẤT</h3>
              {stats.top_thu_tuc.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: "#B8956A" }}>Dữ liệu sẽ xuất hiện sau khi có thêm câu hỏi mới.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={stats.top_thu_tuc.slice(0, 8)} layout="vertical" margin={{ left: 20, right: 50, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5E8D5" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "#9B7B5A" }} allowDecimals={false} />
                    <YAxis type="category" dataKey="ten_thu_tuc" width={220} tick={{ fontSize: 10, fill: "#5A3A1A" }}
                      tickFormatter={(v: string) => v.length > 36 ? v.slice(0, 36) + "…" : v} />
                    <Tooltip formatter={(v: unknown) => [`${Number(v) || 0} lượt`, "Số lần hỏi"]} contentStyle={tooltipStyle} />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]} fill="#C9973C" name="Lượt hỏi" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <p className="text-center text-[9px] pb-2" style={{ color: "#B8956A" }}>
              ✦ Dữ liệu thời gian thực — VNPT TP.HCM
            </p>
          </>
        )}
      </main>
    </div>
  );
}

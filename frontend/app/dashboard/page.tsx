"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, RefreshCw, MessageSquare, Users, AlertTriangle, Clock,
  FileText, CheckCircle, XCircle, Target,
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

interface HosoData {
  phuong: string;
  thang: string;
  total: number;
  overdue_count: number;
  on_time_count: number;
  overdue_rate: number;
  on_time_rate: number;
  done_count: number;
  waiting_count: number;
  status_list: { name: string; value: number }[];
  sectors: { name: string; count: number }[];
  top_procedures: { name: string; count: number }[];
  daily_list: { date: string; count: number }[];
  overdue_by_sector: { name: string; on_time: number; overdue: number }[];
}

function KpiCard({ icon, label, value, sub, accent, color, size = "normal" }: {
  icon: React.ReactNode; label: string; value: string | number;
  sub?: string; accent?: string; color?: string; size?: "normal" | "small";
}) {
  const isSmall = size === "small";
  return (
    <div className={`rounded-2xl flex items-center gap-3 transition-all hover:shadow-lg hover:-translate-y-0.5 duration-200 ${isSmall ? "p-3" : "p-4"}`}
      style={{ background: "rgba(255,255,255,0.92)", border: "1.5px solid rgba(201,151,60,0.2)", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
      <div className={`rounded-xl flex items-center justify-center shrink-0 ${isSmall ? "w-9 h-9" : "w-11 h-11"}`}
        style={{ background: accent || "linear-gradient(135deg,#7B1818,#9B2020)" }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-medium uppercase tracking-wider ${isSmall ? "text-[9px]" : "text-[10px]"}`} style={{ color: "#9B7B5A" }}>{label}</p>
        <p className={`font-bold ${isSmall ? "text-lg" : "text-2xl"}`} style={{ color: color || "#3D1A0E" }}>{value}</p>
        {sub && <p className={`${isSmall ? "text-[9px]" : "text-xs"} mt-0.5`} style={{ color: "#B8956A" }}>{sub}</p>}
      </div>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  "Đã hủy": "#888780", "Chờ tiếp nhận": "#2a78d6", "Đã trả kết quả": "#1baf7a",
  "Từ chối chuyên ngành": "#e34948", "Dừng xử lý": "#eda100",
  "Chờ bổ sung hồ sơ": "#4a3aa7", "Đang xử lý": "#0ea5e9",
};

const tooltipStyle = {
  borderRadius: "12px", border: "1px solid #E8C06A",
  fontSize: "11px", background: "white", boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
};

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [hoso, setHoso] = useState<HosoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [r1, r2] = await Promise.all([
        fetch(`${API_URL}/api/v1/stats`),
        fetch(`${API_URL}/api/v1/hoso/lai-thieu`),
      ]);
      if (!r1.ok) throw new Error(`Stats: lỗi ${r1.status}`);
      if (!r2.ok) throw new Error(`Hoso: lỗi ${r2.status}`);
      const [statsData, hosoData] = await Promise.all([r1.json(), r2.json()]);
      setStats(statsData); setHoso(hosoData);
      setLastUpdated(new Date().toLocaleTimeString("vi-VN"));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Không thể tải dữ liệu.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const avgSeconds = stats ? (stats.avg_response_time_ms / 1000).toFixed(1) : "—";
  const pieData = stats ? [
    { name: "Trả lời thành công", value: stats.total_questions - stats.fallback_count },
    { name: "Fallback", value: stats.fallback_count },
  ] : [];
  const PIE_COLORS = ["#7B1818", "#C9973C"];
  const overdueData = hoso ? [
    { name: "Đúng hạn", value: hoso.on_time_count, color: "#1baf7a" },
    { name: "Trễ hạn", value: hoso.overdue_count, color: "#e34948" },
  ] : [];

  return (
    <div className="min-h-screen"
      style={{ backgroundImage: "url('/bg-lotus.png')", backgroundSize: "cover", backgroundPosition: "center top", backgroundAttachment: "fixed" }}>

      <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-3"
        style={{ background: "linear-gradient(135deg,#5C1010 0%,#8B1A1A 55%,#6B1414 100%)", boxShadow: "0 2px 20px rgba(0,0,0,0.45)" }}>
        <div className="absolute inset-0 opacity-15 pointer-events-none"
          style={{ backgroundImage: "url('/bg-vietnam.jpg')", backgroundSize: "120%", backgroundPosition: "right center", mixBlendMode: "luminosity" }} />
        <div className="flex items-center gap-3 relative z-10">
          <Link href="/" className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-white/15" style={{ background: "rgba(255,255,255,0.12)" }}>
            <ArrowLeft className="w-4 h-4 text-white" />
          </Link>
          <div>
            <h1 className="text-white font-bold text-lg tracking-widest drop-shadow">📊 DASHBOARD HỆ THỐNG AI</h1>
            <p className="text-[10px] tracking-wider" style={{ color: "#E8C06A" }}>Phân tích hiệu suất xử lý hồ sơ & chatbot — VNPT TP.HCM</p>
          </div>
        </div>
        <div className="flex items-center gap-3 relative z-10">
          {lastUpdated && <span className="text-[10px]" style={{ color: "rgba(232,192,106,0.7)" }}>Cập nhật: {lastUpdated}</span>}
          <button onClick={fetchAll} disabled={loading}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-white/15 disabled:opacity-50"
            style={{ background: "rgba(255,255,255,0.12)" }}>
            <RefreshCw className={`w-4 h-4 text-white ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5">
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

        {stats && hoso && (
          <>
            {/* ── 8 KPI ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              <KpiCard size="small" icon={<FileText className="w-4 h-4 text-white" />}
                accent="linear-gradient(135deg,#4A4A4A,#6B6B6B)" label="Tổng hồ sơ" value={hoso.total} sub="tháng 6/2026" />
              <KpiCard size="small" icon={<CheckCircle className="w-4 h-4 text-white" />}
                accent="linear-gradient(135deg,#1B8A4A,#2BAD6B)" label="Đúng hạn"
                value={hoso.on_time_count} sub={`${hoso.on_time_rate}%`} color="#1B8A4A" />
              <KpiCard size="small" icon={<XCircle className="w-4 h-4 text-white" />}
                accent="linear-gradient(135deg,#B22222,#DC3545)" label="Trễ hạn"
                value={hoso.overdue_count} sub={`${hoso.overdue_rate}%`} color="#B22222" />
              <KpiCard size="small" icon={<CheckCircle className="w-4 h-4 text-white" />}
                accent="linear-gradient(135deg,#0F766E,#14B8A6)" label="Đã trả KQ"
                value={hoso.done_count} sub={`${((hoso.done_count / hoso.total) * 100).toFixed(1)}%`} />
              <KpiCard size="small" icon={<Users className="w-4 h-4 text-white" />}
                accent="linear-gradient(135deg,#7B1818,#9B2020)" label="Phiên chat" value={stats.total_sessions} sub="sessions" />
              <KpiCard size="small" icon={<MessageSquare className="w-4 h-4 text-white" />}
                accent="linear-gradient(135deg,#C9973C,#E8A020)" label="Câu hỏi" value={stats.total_questions} sub="lượt hỏi" />
              <KpiCard size="small" icon={<Target className="w-4 h-4 text-white" />}
                accent="linear-gradient(135deg,#6B1414,#8B1A1A)" label="Độ chính xác"
                value={`${(100 - stats.fallback_rate).toFixed(1)}%`} sub="chatbot" color="#7B1818" />
              <KpiCard size="small" icon={<Clock className="w-4 h-4 text-white" />}
                accent="linear-gradient(135deg,#4A4A8A,#6B6BA8)" label="Thời gian TB" value={`${avgSeconds}s`} sub="phản hồi" />
            </div>

            {/* ── BIỂU ĐỒ CHATBOT ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.92)", border: "1.5px solid rgba(201,151,60,0.2)", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
                <h3 className="text-xs font-bold tracking-wide mb-3" style={{ color: "#7B1818" }}>🎯 CHATBOT: TỶ LỆ TRẢ LỜI THÀNH CÔNG / FALLBACK</h3>
                {stats.total_questions === 0 ? (
                  <p className="text-sm text-center py-10" style={{ color: "#B8956A" }}>Chưa có dữ liệu</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                          {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                          <Label value={`${(100 - stats.fallback_rate).toFixed(1)}%`} position="center" fill="#7B1818" fontSize={20} fontWeight="bold" />
                        </Pie>
                        <Tooltip formatter={(v: unknown) => [`${Number(v) || 0} câu`, ""]} contentStyle={tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex items-center justify-center gap-4 mt-1">
                      {pieData.map((d, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-[10px]" style={{ color: "#7B5A2B" }}>
                          <span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i] }} />{d.name} ({d.value})
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.92)", border: "1.5px solid rgba(201,151,60,0.2)", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
                <h3 className="text-xs font-bold tracking-wide mb-3" style={{ color: "#7B1818" }}>📈 CHATBOT: LƯỢNG CÂU HỎI THEO NGÀY (7 NGÀY GẦN NHẤT)</h3>
                {stats.daily_questions.length === 0 ? (
                  <p className="text-sm text-center py-10" style={{ color: "#B8956A" }}>Chưa có dữ liệu</p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
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

            {/* ── BIỂU ĐỒ TOP THỦ TỤC CHATBOT ── */}
            <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.92)", border: "1.5px solid rgba(201,151,60,0.2)", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
              <h3 className="text-xs font-bold tracking-wide mb-3" style={{ color: "#7B1818" }}>🔥 THỦ TỤC HÀNH CHÍNH ĐƯỢC HỎI NHIỀU NHẤT (CHATBOT)</h3>
              {stats.top_thu_tuc.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: "#B8956A" }}>Dữ liệu sẽ xuất hiện sau khi có thêm câu hỏi mới.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={stats.top_thu_tuc.slice(0, 8)} layout="vertical" margin={{ left: 20, right: 40, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5E8D5" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "#9B7B5A" }} allowDecimals={false} />
                    <YAxis type="category" dataKey="ten_thu_tuc" width={210} tick={{ fontSize: 10, fill: "#5A3A1A" }}
                      tickFormatter={(v: string) => v.length > 34 ? v.slice(0, 34) + "…" : v} />
                    <Tooltip formatter={(v: unknown) => [`${Number(v) || 0} lượt`, "Số lần hỏi"]} contentStyle={tooltipStyle} />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]} fill="#C9973C" name="Lượt hỏi" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* ── BIỂU ĐỒ HỒ SƠ LÁI THIÊU ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.92)", border: "1.5px solid rgba(201,151,60,0.2)", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
                <h3 className="text-xs font-bold tracking-wide mb-3" style={{ color: "#7B1818" }}>📊 HỒ SƠ: PHÂN BỔ TRẠNG THÁI</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={hoso.status_list} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="value">
                      {hoso.status_list.map((s, i) => <Cell key={i} fill={STATUS_COLORS[s.name] || "#888780"} />)}
                    </Pie>
                    <Tooltip formatter={(v: unknown) => [`${Number(v) || 0} hồ sơ`, ""]} contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 justify-center">
                  {hoso.status_list.map((s, i) => (
                    <div key={i} className="flex items-center gap-1 text-[9px]" style={{ color: "#5A3A1A" }}>
                      <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: STATUS_COLORS[s.name] || "#888780" }} />
                      {s.name} ({s.value})
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.92)", border: "1.5px solid rgba(201,151,60,0.2)", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
                <h3 className="text-xs font-bold tracking-wide mb-3" style={{ color: "#7B1818" }}>⏱️ HỒ SƠ: TỶ LỆ ĐÚNG HẠN / TRỄ HẠN</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={overdueData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                      {overdueData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      <Label value={`${hoso.on_time_rate}%`} position="center" fill="#1baf7a" fontSize={20} fontWeight="bold" />
                    </Pie>
                    <Tooltip formatter={(v: unknown) => [`${Number(v) || 0} hồ sơ`, ""]} contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-center gap-6 mt-2">
                  {overdueData.map((d, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[10px]" style={{ color: "#5A3A1A" }}>
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                      {d.name} ({d.value}) · {((d.value / hoso.total) * 100).toFixed(1)}%
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── HỒ SƠ THEO LĨNH VỰC & TOP THỦ TỤC ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.92)", border: "1.5px solid rgba(201,151,60,0.2)", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
                <h3 className="text-xs font-bold tracking-wide mb-3" style={{ color: "#7B1818" }}>🏷️ HỒ SƠ THEO LĨNH VỰC (TOP 6)</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={hoso.sectors} layout="vertical" margin={{ left: 10, right: 40, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5E8D5" />
                    <XAxis type="number" tick={{ fontSize: 9, fill: "#9B7B5A" }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 9, fill: "#5A3A1A" }} />
                    <Tooltip formatter={(v: unknown) => [`${Number(v) || 0} hồ sơ`, ""]} contentStyle={tooltipStyle} />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]} fill="#2a78d6" name="Hồ sơ" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.92)", border: "1.5px solid rgba(201,151,60,0.2)", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
                <h3 className="text-xs font-bold tracking-wide mb-3" style={{ color: "#7B1818" }}>🏆 TOP 5 THỦ TỤC ĐƯỢC NỘP NHIỀU NHẤT</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={hoso.top_procedures} layout="vertical" margin={{ left: 10, right: 40, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5E8D5" />
                    <XAxis type="number" tick={{ fontSize: 9, fill: "#9B7B5A" }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 9, fill: "#5A3A1A" }}
                      tickFormatter={(v: string) => v.length > 26 ? v.slice(0, 26) + "…" : v} />
                    <Tooltip formatter={(v: unknown) => [`${Number(v) || 0} hồ sơ`, ""]} contentStyle={tooltipStyle} />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]} fill="#C9973C" name="Hồ sơ" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── BIỂU ĐỒ ĐÚNG/TRỄ HẠN THEO LĨNH VỰC ── */}
            <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.92)", border: "1.5px solid rgba(201,151,60,0.2)", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
              <h3 className="text-xs font-bold tracking-wide mb-3" style={{ color: "#7B1818" }}>✅ ĐÚNG HẠN / TRỄ HẠN THEO LĨNH VỰC</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={hoso.overdue_by_sector} layout="vertical" margin={{ left: 10, right: 40, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F5E8D5" />
                  <XAxis type="number" tick={{ fontSize: 9, fill: "#9B7B5A" }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 9, fill: "#5A3A1A" }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="on_time" stackId="a" fill="#1baf7a" name="Đúng hạn" />
                  <Bar dataKey="overdue" stackId="a" fill="#e34948" name="Trễ hạn" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center gap-6 mt-2">
                <div className="flex items-center gap-1.5 text-[10px]" style={{ color: "#5A3A1A" }}>
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#1baf7a" }} />Đúng hạn
                </div>
                <div className="flex items-center gap-1.5 text-[10px]" style={{ color: "#5A3A1A" }}>
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#e34948" }} />Trễ hạn
                </div>
              </div>
            </div>

            {/* ── FOOTER ── */}
            <p className="text-center text-[9px] pb-2" style={{ color: "#B8956A" }}>
              ✦ Chatbot: dữ liệu thời gian thực ·  {hoso.thang}  — VNPT TP.HCM
            </p>
          </>
        )}
      </main>
    </div>
  );
}
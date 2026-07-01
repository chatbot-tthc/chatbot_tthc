"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, RefreshCw, MessageSquare, Users, AlertTriangle, Clock,
  FileText, CheckCircle, XCircle, Hourglass, Database,
  Calendar, TrendingUp, Building2, Home, User, Briefcase,
  Landmark, Heart, Scale, BarChart3, PieChart as PieChartIcon,
  Activity, Zap, Shield, Target, Layers
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, Label, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line,
  ComposedChart, Area
} from "recharts";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Type ──────────────────────────────────────────────────
interface StatsData {
  total_sessions: number;
  total_questions: number;
  fallback_count: number;
  fallback_rate: number;
  avg_response_time_ms: number;
  top_thu_tuc: { ten_thu_tuc: string; count: number }[];
  daily_questions: { date: string; count: number }[];
}

// ── DỮ LIỆU MẪU CHO HỒ SƠ HÀNH CHÍNH ──────────────────
// (Sẽ thay bằng dữ liệu thật từ API sau khi import)
const MOCK_HS_DATA = {
  total: 801,
  completed: 40,
  overdue: 110,
  pending: 46,
  status: [
    { name: "Đã hủy", value: 663, color: "#E8D8C0" },
    { name: "Chờ tiếp nhận", value: 46, color: "#F5D6A8" },
    { name: "Đã trả kết quả", value: 40, color: "#7B1818" },
    { name: "Từ chối chuyển ngành", value: 26, color: "#C9973C" },
    { name: "Dừng xử lý", value: 17, color: "#B8956A" },
    { name: "Chờ bổ sung / Tạm dừng", value: 9, color: "#E8C06A" },
    { name: "Đang xử lý", value: 1, color: "#9B2020" },
  ],
  fields: [
    { name: "Đất đai", value: 215 },
    { name: "Hộ tịch", value: 180 },
    { name: "Hộ kinh doanh", value: 145 },
    { name: "Người có công", value: 98 },
    { name: "Hợp tác xã", value: 67 },
    { name: "Tín ngưỡng", value: 45 },
  ],
  top_thu_tuc: [
    { name: "Đính chính GCN đã cấp có sai...", value: 95 },
    { name: "Giao/cho thuê đất, chuyển MĐ...", value: 85 },
    { name: "Đăng ký đất đai, cấp GCN QSD...", value: 78 },
    { name: "Đăng ký thành lập hộ kinh do...", value: 62 },
    { name: "Cấp GXN tình trạng hôn nhân", value: 48 },
  ]
};

// ── KPI Card ──────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, accent, trend, color }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  trend?: { value: number; label: string };
  color?: string;
}) {
  return (
    <div className="rounded-2xl p-5 flex items-center gap-4 transition-all hover:shadow-lg hover:-translate-y-0.5 duration-200"
      style={{
        background: "rgba(255,255,255,0.92)",
        border: "1.5px solid rgba(201,151,60,0.2)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.06)"
      }}>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: accent || "linear-gradient(135deg,#7B1818,#9B2020)" }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "#9B7B5A" }}>
          {label}
        </p>
        <p className="text-2xl font-bold" style={{ color: color || "#3D1A0E" }}>
          {value}
        </p>
        {sub && <p className="text-xs mt-0.5" style={{ color: "#B8956A" }}>{sub}</p>}
        {trend && (
          <div className="flex items-center gap-1 mt-0.5">
            <span className={`text-xs font-medium ${trend.value >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%
            </span>
            <span className="text-xs text-gray-400">{trend.label}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Section Header ────────────────────────────────────────
function SectionHeader({ icon, title, subtitle, badge, className }: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  badge?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 mb-4 ${className || ''}`}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: "linear-gradient(135deg,#7B1818,#9B2020)" }}>
        {icon}
      </div>
      <div>
        <h2 className="text-sm font-bold" style={{ color: "#7B1818" }}>{title}</h2>
        {subtitle && (
          <p className="text-xs" style={{ color: "#B8956A" }}>{subtitle}</p>
        )}
      </div>
      {badge && (
        <span className="ml-auto text-[10px] px-2.5 py-1 rounded-full font-medium"
          style={{ background: "#FFF5E6", color: "#C9973C", border: "1px solid #E8C06A" }}>
          {badge}
        </span>
      )}
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────
export default function DashboardPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [hsData] = useState(MOCK_HS_DATA);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/stats`);
      if (!res.ok) throw new Error(`Lỗi ${res.status}`);
      const json = await res.json();
      setData(json);
      setLastUpdated(new Date().toLocaleTimeString("vi-VN"));
    } catch (e) {
      setError("Không thể tải dữ liệu. Kiểm tra backend đã chạy chưa.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // ── Biểu đồ ──
  const pieData = data ? [
    { name: "Trả lời thành công", value: data.total_questions - data.fallback_count },
    { name: "Fallback", value: data.fallback_count },
  ] : [];
  const PIE_COLORS = ["#7B1818", "#C9973C"];

  const avgSeconds = data ? (data.avg_response_time_ms / 1000).toFixed(1) : "—";

  // Dữ liệu cho phần hồ sơ
  const statusData = hsData.status || [];
  const fieldData = hsData.fields || [];
  const topThuTucData = hsData.top_thu_tuc || [];

  const tooltipStyle = {
    borderRadius: "12px",
    border: "1px solid #E8C06A",
    fontSize: "12px",
    background: "white",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
  };

  return (
    <div className="min-h-screen"
      style={{
        backgroundImage: "url('/bg-lotus.png')",
        backgroundSize: "cover",
        backgroundPosition: "center top",
        backgroundAttachment: "fixed"
      }}>

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-3"
        style={{
          background: "linear-gradient(135deg,#5C1010 0%,#8B1A1A 55%,#6B1414 100%)",
          boxShadow: "0 2px 20px rgba(0,0,0,0.45)"
        }}>
        <div className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: "url('/bg-vietnam.jpg')",
            backgroundSize: "120%",
            backgroundPosition: "right center",
            mixBlendMode: "luminosity"
          }} />

        <div className="flex items-center gap-3 relative z-10">
          <Link href="/"
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-white/15"
            style={{ background: "rgba(255,255,255,0.12)" }}>
            <ArrowLeft className="w-4 h-4 text-white" />
          </Link>
          <div>
            <h1 className="text-white font-bold text-lg tracking-widest drop-shadow">
              📊 DASHBOARD HIỆU SUẤT
            </h1>
            <p className="text-xs tracking-wider" style={{ color: "#E8C06A" }}>
              VNPT TP.HCM — Phân tích xử lý hồ sơ &amp; chatbot
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 relative z-10">
          {lastUpdated && (
            <span className="text-xs" style={{ color: "rgba(232,192,106,0.7)" }}>
              Cập nhật: {lastUpdated}
            </span>
          )}
          <button onClick={fetchStats} disabled={loading}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:bg-white/15 disabled:opacity-50"
            style={{ background: "rgba(255,255,255,0.12)" }}>
            <RefreshCw className={`w-4 h-4 text-white ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {error && (
          <div className="rounded-2xl px-4 py-3 text-sm flex items-center gap-2"
            style={{
              background: "rgba(255,248,240,0.95)",
              border: "1.5px solid #E8C06A",
              color: "#7B1818"
            }}>
            <AlertTriangle className="w-4 h-4 shrink-0" />{error}
          </div>
        )}

        {loading && !data && (
          <div className="text-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: "#C9973C" }} />
            <p className="text-sm font-medium" style={{ color: "#B8956A" }}>Đang tải dữ liệu...</p>
          </div>
        )}

        {data && (
          <>
            {/* ── SECTION 1: CHATBOT AI ── */}
            <div className="rounded-2xl p-5"
              style={{
                background: "rgba(255,255,255,0.92)",
                border: "1.5px solid rgba(201,151,60,0.2)",
                boxShadow: "0 2px 12px rgba(0,0,0,0.07)"
              }}>
              <SectionHeader
                icon={<MessageSquare className="w-4 h-4 text-white" />}
                title="THỐNG KÊ CHATBOT AI"
                subtitle="Dữ liệu hoạt động thời gian thực từ hệ thống RAG"
                badge="Real-time"
              />

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                <KpiCard
                  icon={<Users className="w-5 h-5 text-white" />}
                  accent="linear-gradient(135deg,#7B1818,#9B2020)"
                  label="Tổng phiên làm việc"
                  value={data.total_sessions}
                  sub="sessions"
                />
                <KpiCard
                  icon={<MessageSquare className="w-5 h-5 text-white" />}
                  accent="linear-gradient(135deg,#C9973C,#E8A020)"
                  label="Tổng câu hỏi"
                  value={data.total_questions}
                  sub="lượt hỏi"
                />
                <KpiCard
                  icon={<AlertTriangle className="w-5 h-5 text-white" />}
                  accent="linear-gradient(135deg,#9B6020,#C9973C)"
                  label="Tỷ lệ Fallback"
                  value={`${data.fallback_rate}%`}
                  sub={`${data.fallback_count} câu không tìm được`}
                />
                <KpiCard
                  icon={<Clock className="w-5 h-5 text-white" />}
                  accent="linear-gradient(135deg,#6B1414,#8B1A1A)"
                  label="Thời gian phản hồi TB"
                  value={`${avgSeconds}s`}
                  sub="trung bình mỗi câu"
                />
              </div>

              {/* Biểu đồ */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-4">
                {/* Pie Chart */}
                <div className="rounded-xl p-4"
                  style={{
                    background: "rgba(255,255,255,0.6)",
                    border: "1px solid rgba(201,151,60,0.15)"
                  }}>
                  <h3 className="text-xs font-bold tracking-wide mb-3" style={{ color: "#7B1818" }}>
                    🎯 TỶ LỆ TRẢ LỜI THÀNH CÔNG / FALLBACK
                  </h3>
                  {data.total_questions === 0 ? (
                    <p className="text-sm text-center py-10" style={{ color: "#B8956A" }}>Chưa có dữ liệu</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                          <Label
                            value={`${(100 - data.fallback_rate).toFixed(1)}%`}
                            position="center"
                            fill="#7B1818"
                            fontSize={24}
                            fontWeight="bold"
                          />
                        </Pie>
                        <Tooltip
                          formatter={(v: unknown) => [`${Number(v) || 0} câu`, ""]}
                          contentStyle={tooltipStyle}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                  <div className="flex items-center justify-center gap-6 mt-1">
                    {pieData.map((d, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-[11px]" style={{ color: "#7B5A2B" }}>
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i] }} />
                        {d.name} ({d.value})
                      </div>
                    ))}
                  </div>
                </div>

                {/* Line Chart */}
                <div className="rounded-xl p-4"
                  style={{
                    background: "rgba(255,255,255,0.6)",
                    border: "1px solid rgba(201,151,60,0.15)"
                  }}>
                  <h3 className="text-xs font-bold tracking-wide mb-3" style={{ color: "#7B1818" }}>
                    📈 LƯỢNG CÂU HỎI THEO NGÀY (7 NGÀY GẦN NHẤT)
                  </h3>
                  {data.daily_questions.length === 0 ? (
                    <p className="text-sm text-center py-10" style={{ color: "#B8956A" }}>Chưa có dữ liệu</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={data.daily_questions} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F5E8D5" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10, fill: "#9B7B5A" }}
                          tickFormatter={v => v.slice(5)}
                        />
                        <YAxis tick={{ fontSize: 10, fill: "#9B7B5A" }} allowDecimals={false} />
                        <Tooltip
                          labelFormatter={v => `Ngày ${v}`}
                          formatter={(v: unknown) => [`${Number(v) || 0} câu hỏi`, ""]}
                          contentStyle={tooltipStyle}
                        />
                        <Line
                          type="monotone"
                          dataKey="count"
                          stroke="#C9973C"
                          strokeWidth={2.5}
                          dot={{ r: 3.5, fill: "#C9973C", strokeWidth: 0 }}
                          activeDot={{ r: 5, fill: "#7B1818" }}
                          name="Câu hỏi"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Top thủ tục */}
              <div className="mt-4 rounded-xl p-4"
                style={{
                  background: "rgba(255,255,255,0.6)",
                  border: "1px solid rgba(201,151,60,0.15)"
                }}>
                <h3 className="text-xs font-bold tracking-wide mb-3" style={{ color: "#7B1818" }}>
                  🔥 THỦ TỤC HÀNH CHÍNH ĐƯỢC HỎI NHIỀU NHẤT
                </h3>
                {data.top_thu_tuc.length === 0 ? (
                  <p className="text-sm text-center py-6" style={{ color: "#B8956A" }}>
                    Dữ liệu sẽ xuất hiện sau khi có thêm câu hỏi mới.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={data.top_thu_tuc.slice(0, 8)}
                      layout="vertical"
                      margin={{ left: 0, right: 30, top: 0, bottom: 0 }}
                    >
                      <XAxis type="number" tick={{ fontSize: 10, fill: "#9B7B5A" }} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="ten_thu_tuc"
                        width={160}
                        tick={{ fontSize: 10, fill: "#5A3A1A" }}
                        tickFormatter={(v: string) => v.length > 25 ? v.slice(0, 25) + "…" : v}
                      />
                      <Tooltip
                        formatter={(v: unknown) => [`${Number(v) || 0} lượt`, "Số lần hỏi"]}
                        contentStyle={tooltipStyle}
                      />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} fill="#C9973C" name="Lượt hỏi" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* ═══════ SECTION 2: HỒ SƠ HÀNH CHÍNH ═══════ */}
            <div className="rounded-2xl p-5"
              style={{
                background: "rgba(255,255,255,0.92)",
                border: "1.5px solid rgba(201,151,60,0.2)",
                boxShadow: "0 2px 12px rgba(0,0,0,0.07)"
              }}>

              <SectionHeader
                icon={<FileText className="w-4 h-4 text-white" />}
                title="HỒ SƠ HÀNH CHÍNH — DỮ LIỆU THỰC TẾ"
                subtitle="Nguồn: motcua.hcm.gov.vn — Tháng 6/2026"
                badge={`${hsData.total} hồ sơ`}
              />

              {/* KPI Hồ sơ */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <KpiCard
                  icon={<Database className="w-5 h-5 text-white" />}
                  accent="linear-gradient(135deg,#4A4A4A,#6B6B6B)"
                  label="Tổng hồ sơ"
                  value={hsData.total}
                  sub="tháng 6/2026"
                />
                <KpiCard
                  icon={<CheckCircle className="w-5 h-5 text-white" />}
                  accent="linear-gradient(135deg,#1B8A4A,#2BAD6B)"
                  label="Đã trả kết quả"
                  value={hsData.completed}
                  sub={`${(hsData.completed / hsData.total * 100).toFixed(1)}% tổng hồ sơ`}
                />
                <KpiCard
                  icon={<XCircle className="w-5 h-5 text-white" />}
                  accent="linear-gradient(135deg,#B22222,#DC3545)"
                  label="Trễ hạn"
                  value={hsData.overdue}
                  sub={`${(hsData.overdue / hsData.total * 100).toFixed(1)}% tổng hồ sơ`}
                />
                <KpiCard
                  icon={<Hourglass className="w-5 h-5 text-white" />}
                  accent="linear-gradient(135deg,#C9973C,#E8A020)"
                  label="Chờ tiếp nhận"
                  value={hsData.pending}
                  sub="đang chờ xử lý"
                />
              </div>

              {/* Biểu đồ hồ sơ */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-4">
                {/* Donut Chart - Phân bổ trạng thái */}
                <div className="rounded-xl p-4"
                  style={{
                    background: "rgba(255,255,255,0.6)",
                    border: "1px solid rgba(201,151,60,0.15)"
                  }}>
                  <h4 className="text-xs font-bold tracking-wide mb-3" style={{ color: "#7B1818" }}>
                    📊 PHÂN BỔ TRẠNG THÁI HỒ SƠ
                  </h4>
                  {statusData.length === 0 ? (
                    <p className="text-sm text-center py-6" style={{ color: "#B8956A" }}>Chưa có dữ liệu</p>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie
                            data={statusData}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={70}
                            paddingAngle={2}
                            dataKey="value"
                          >
                            {statusData.map((d, i) => <Cell key={i} fill={d.color || "#C9973C"} />)}
                            <Label
                              value={`${hsData.total}`}
                              position="center"
                              fill="#3D1A0E"
                              fontSize={18}
                              fontWeight="bold"
                            />
                          </Pie>
                          <Tooltip
                            formatter={(v: unknown) => [`${Number(v) || 0} hồ sơ`, ""]}
                            contentStyle={tooltipStyle}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-wrap items-center justify-center gap-1.5 mt-1">
                        {statusData.slice(0, 5).map((d, i) => (
                          <div key={i} className="flex items-center gap-1 text-[9px]" style={{ color: "#7B5A2B" }}>
                            <span className="w-2 h-2 rounded-full" style={{ background: d.color || "#C9973C" }} />
                            {d.name.length > 12 ? d.name.slice(0, 12) + "…" : d.name} ({d.value})
                          </div>
                        ))}
                        {statusData.length > 5 && (
                          <span className="text-[9px]" style={{ color: "#B8956A" }}>
                            +{statusData.length - 5} khác
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Tỷ lệ đúng hạn/trễ hạn */}
                <div className="rounded-xl p-4"
                  style={{
                    background: "rgba(255,255,255,0.6)",
                    border: "1px solid rgba(201,151,60,0.15)"
                  }}>
                  <h4 className="text-xs font-bold tracking-wide mb-3" style={{ color: "#7B1818" }}>
                    ⏱️ TỶ LỆ ĐÚNG HẠN / TRỄ HẠN
                  </h4>
                  <div className="flex items-center gap-6 justify-center h-[180px]">
                    <div className="text-center">
                      <div className="text-3xl font-bold" style={{ color: "#1B8A4A" }}>
                        {((hsData.total - hsData.overdue) / hsData.total * 100).toFixed(1)}%
                      </div>
                      <div className="text-[11px] font-medium mt-1" style={{ color: "#1B8A4A" }}>
                        ✅ Đúng hạn
                      </div>
                      <div className="text-[10px]" style={{ color: "#B8956A" }}>
                        {hsData.total - hsData.overdue} hồ sơ
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold" style={{ color: "#B22222" }}>
                        {(hsData.overdue / hsData.total * 100).toFixed(1)}%
                      </div>
                      <div className="text-[11px] font-medium mt-1" style={{ color: "#B22222" }}>
                        ⚠️ Trễ hạn
                      </div>
                      <div className="text-[10px]" style={{ color: "#B8956A" }}>
                        {hsData.overdue} hồ sơ
                      </div>
                    </div>
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "#F5E8D5" }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${((hsData.total - hsData.overdue) / hsData.total * 100)}%`,
                        background: "linear-gradient(90deg,#1B8A4A,#2BAD6B)"
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] mt-1" style={{ color: "#B8956A" }}>
                    <span>Đúng hạn {((hsData.total - hsData.overdue) / hsData.total * 100).toFixed(1)}%</span>
                    <span>Trễ hạn {(hsData.overdue / hsData.total * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              {/* Hồ sơ theo lĩnh vực & Top thủ tục */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-4">
                <div className="rounded-xl p-4"
                  style={{
                    background: "rgba(255,255,255,0.6)",
                    border: "1px solid rgba(201,151,60,0.15)"
                  }}>
                  <h4 className="text-xs font-bold tracking-wide mb-3" style={{ color: "#7B1818" }}>
                    🏷️ HỒ SƠ THEO LĨNH VỰC
                  </h4>
                  {fieldData.length === 0 ? (
                    <p className="text-sm text-center py-6" style={{ color: "#B8956A" }}>Chưa có dữ liệu</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={fieldData} layout="vertical" margin={{ left: 70, right: 10 }}>
                        <XAxis type="number" tick={{ fontSize: 9, fill: "#9B7B5A" }} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fontSize: 9, fill: "#5A3A1A" }}
                          tickFormatter={(v) => v.length > 10 ? v.slice(0, 10) + "…" : v}
                          width={70}
                        />
                        <Tooltip formatter={(v: unknown) => [`${Number(v) || 0} hồ sơ`, ""]} contentStyle={tooltipStyle} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} fill="#C9973C" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div className="rounded-xl p-4"
                  style={{
                    background: "rgba(255,255,255,0.6)",
                    border: "1px solid rgba(201,151,60,0.15)"
                  }}>
                  <h4 className="text-xs font-bold tracking-wide mb-3" style={{ color: "#7B1818" }}>
                    🏆 TOP 5 THỦ TỤC ĐƯỢC NỘP NHIỀU NHẤT
                  </h4>
                  {topThuTucData.length === 0 ? (
                    <p className="text-sm text-center py-6" style={{ color: "#B8956A" }}>Chưa có dữ liệu</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={topThuTucData} layout="vertical" margin={{ left: 100, right: 10 }}>
                        <XAxis type="number" tick={{ fontSize: 9, fill: "#9B7B5A" }} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fontSize: 9, fill: "#5A3A1A" }}
                          tickFormatter={(v) => v.length > 15 ? v.slice(0, 15) + "…" : v}
                          width={100}
                        />
                        <Tooltip formatter={(v: unknown) => [`${Number(v) || 0} hồ sơ`, ""]} contentStyle={tooltipStyle} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} fill="#7B1818" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            {/* ── FOOTER ── */}
            <div className="text-center text-[10px] py-3" style={{ color: "#B8956A" }}>
              <p>
                ✦ Dữ liệu chatbot: thời gian thực &bull; Dữ liệu hồ sơ: tháng 6/2026 
              </p>
              <p className="mt-1">
                © VNTP TP.HCM — Phòng Dữ liệu số &bull; Thực tập sinh Nguyễn Quốc Tường
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
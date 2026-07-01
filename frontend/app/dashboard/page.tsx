"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, RefreshCw, MessageSquare, Users, AlertTriangle, Clock,
  FileText, CheckCircle, XCircle, Hourglass, Database,
  Calendar, TrendingUp, Building2, Home, User, Briefcase,
  Landmark, Heart, Scale, BarChart3, PieChart as PieChartIcon,
  Activity, Zap, Shield, Target, Layers, Gauge, GitBranch
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

// ── KPI Card ──────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, accent, color, size = "normal" }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  color?: string;
  size?: "normal" | "small";
}) {
  const isSmall = size === "small";
  return (
    <div className={`rounded-2xl flex items-center gap-3 transition-all hover:shadow-lg hover:-translate-y-0.5 duration-200 ${isSmall ? 'p-3' : 'p-4'}`}
      style={{
        background: "rgba(255,255,255,0.92)",
        border: "1.5px solid rgba(201,151,60,0.2)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.06)"
      }}>
      <div className={`rounded-xl flex items-center justify-center shrink-0 ${isSmall ? 'w-9 h-9' : 'w-11 h-11'}`}
        style={{ background: accent || "linear-gradient(135deg,#7B1818,#9B2020)" }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-medium uppercase tracking-wider ${isSmall ? 'text-[9px]' : 'text-[10px]'}`} style={{ color: "#9B7B5A" }}>
          {label}
        </p>
        <p className={`font-bold ${isSmall ? 'text-lg' : 'text-2xl'}`} style={{ color: color || "#3D1A0E" }}>
          {value}
        </p>
        {sub && <p className={`${isSmall ? 'text-[9px]' : 'text-xs'} mt-0.5`} style={{ color: "#B8956A" }}>{sub}</p>}
      </div>
    </div>
  );
}

// ── Section Header ────────────────────────────────────────
function SectionHeader({ icon, title, subtitle, badge }: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  badge?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-4 pb-2 border-b" style={{ borderColor: "rgba(201,151,60,0.2)" }}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: "linear-gradient(135deg,#7B1818,#9B2020)" }}>
        {icon}
      </div>
      <div>
        <h2 className="text-sm font-bold" style={{ color: "#7B1818" }}>{title}</h2>
        {subtitle && (
          <p className="text-[10px]" style={{ color: "#B8956A" }}>{subtitle}</p>
        )}
      </div>
      {badge && (
        <span className="ml-auto text-[9px] px-2 py-0.5 rounded-full font-medium"
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

  const avgSeconds = data ? (data.avg_response_time_ms / 1000).toFixed(1) : "—";

  // ── Dữ liệu cho biểu đồ ──
  const pieData = data ? [
    { name: "Trả lời thành công", value: data.total_questions - data.fallback_count },
    { name: "Fallback", value: data.fallback_count },
  ] : [];
  const PIE_COLORS = ["#7B1818", "#C9973C"];

  const tooltipStyle = {
    borderRadius: "12px",
    border: "1px solid #E8C06A",
    fontSize: "11px",
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
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-white/15"
            style={{ background: "rgba(255,255,255,0.12)" }}>
            <ArrowLeft className="w-4 h-4 text-white" />
          </Link>
          <div>
            <h1 className="text-white font-bold text-lg tracking-widest drop-shadow">
              📊 DASHBOARD HỆ THỐNG AI
            </h1>
            <p className="text-[10px] tracking-wider" style={{ color: "#E8C06A" }}>
              Phân tích hiệu suất xử lý hồ sơ &amp; chatbot — VNPT TP.HCM
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 relative z-10">
          {lastUpdated && (
            <span className="text-[10px]" style={{ color: "rgba(232,192,106,0.7)" }}>
              Cập nhật: {lastUpdated}
            </span>
          )}
          <button onClick={fetchStats} disabled={loading}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-white/15 disabled:opacity-50"
            style={{ background: "rgba(255,255,255,0.12)" }}>
            <RefreshCw className={`w-4 h-4 text-white ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5">

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
            {/* ── 8 KPI ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3">
              <KpiCard
                icon={<FileText className="w-4 h-4 text-white" />}
                accent="linear-gradient(135deg,#4A4A4A,#6B6B6B)"
                label="Tổng hồ sơ"
                value="-"
                sub="chờ cập nhật"
                size="small"
              />
              <KpiCard
                icon={<CheckCircle className="w-4 h-4 text-white" />}
                accent="linear-gradient(135deg,#1B8A4A,#2BAD6B)"
                label="Đúng hạn"
                value="-"
                sub="- hồ sơ"
                size="small"
                color="#1B8A4A"
              />
              <KpiCard
                icon={<XCircle className="w-4 h-4 text-white" />}
                accent="linear-gradient(135deg,#B22222,#DC3545)"
                label="Trễ hạn"
                value="-"
                sub="- %"
                size="small"
                color="#B22222"
              />
              <KpiCard
                icon={<Users className="w-4 h-4 text-white" />}
                accent="linear-gradient(135deg,#7B1818,#9B2020)"
                label="Người dùng"
                value="-"
                sub="chờ cập nhật"
                size="small"
              />
              <KpiCard
                icon={<MessageSquare className="w-4 h-4 text-white" />}
                accent="linear-gradient(135deg,#C9973C,#E8A020)"
                label="Phiên chat"
                value={data.total_sessions}
                sub="sessions"
                size="small"
              />
              <KpiCard
                icon={<AlertTriangle className="w-4 h-4 text-white" />}
                accent="linear-gradient(135deg,#9B6020,#C9973C)"
                label="Fallback"
                value={`${data.fallback_rate}%`}
                sub={`${data.fallback_count} câu`}
                size="small"
              />
              <KpiCard
                icon={<Target className="w-4 h-4 text-white" />}
                accent="linear-gradient(135deg,#6B1414,#8B1A1A)"
                label="Độ chính xác"
                value={`${(100 - data.fallback_rate).toFixed(1)}%`}
                sub="trả lời thành công"
                size="small"
                color="#7B1818"
              />
              <KpiCard
                icon={<Clock className="w-4 h-4 text-white" />}
                accent="linear-gradient(135deg,#4A4A8A,#6B6BA8)"
                label="Response Time"
                value={`${avgSeconds}s`}
                sub="trung bình"
                size="small"
              />
            </div>

            {/* ── BIỂU ĐỒ ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Biểu đồ 1: Pie Chatbot */}
              <div className="rounded-2xl p-4"
                style={{
                  background: "rgba(255,255,255,0.92)",
                  border: "1.5px solid rgba(201,151,60,0.2)",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.07)"
                }}>
                <h3 className="text-xs font-bold tracking-wide mb-3" style={{ color: "#7B1818" }}>
                  🎯 CHATBOT: TỶ LỆ TRẢ LỜI THÀNH CÔNG
                </h3>
                {data.total_questions === 0 ? (
                  <p className="text-sm text-center py-6" style={{ color: "#B8956A" }}>Chưa có dữ liệu</p>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                        <Label
                          value={`${(100 - data.fallback_rate).toFixed(1)}%`}
                          position="center"
                          fill="#7B1818"
                          fontSize={20}
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
                <div className="flex items-center justify-center gap-4 mt-1">
                  {pieData.map((d, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[10px]" style={{ color: "#7B5A2B" }}>
                      <span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i] }} />
                      {d.name} ({d.value})
                    </div>
                  ))}
                </div>
              </div>

              {/* Biểu đồ 2: Donut Hồ sơ (trống) */}
              <div className="rounded-2xl p-4"
                style={{
                  background: "rgba(255,255,255,0.92)",
                  border: "1.5px solid rgba(201,151,60,0.2)",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.07)"
                }}>
                <h3 className="text-xs font-bold tracking-wide mb-3" style={{ color: "#7B1818" }}>
                  📊 HỒ SƠ: PHÂN BỔ TRẠNG THÁI
                </h3>
                <p className="text-sm text-center py-12" style={{ color: "#B8956A" }}>Chưa có dữ liệu</p>
              </div>

              {/* Biểu đồ 3: Line Chatbot */}
              <div className="rounded-2xl p-4"
                style={{
                  background: "rgba(255,255,255,0.92)",
                  border: "1.5px solid rgba(201,151,60,0.2)",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.07)"
                }}>
                <h3 className="text-xs font-bold tracking-wide mb-3" style={{ color: "#7B1818" }}>
                  📈 CHAT: LƯỢNG CÂU HỎI THEO NGÀY
                </h3>
                {data.daily_questions.length === 0 ? (
                  <p className="text-sm text-center py-6" style={{ color: "#B8956A" }}>Chưa có dữ liệu</p>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={data.daily_questions} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F5E8D5" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 9, fill: "#9B7B5A" }}
                        tickFormatter={v => v.slice(5)}
                      />
                      <YAxis tick={{ fontSize: 9, fill: "#9B7B5A" }} allowDecimals={false} />
                      <Tooltip
                        labelFormatter={v => `Ngày ${v}`}
                        formatter={(v: unknown) => [`${Number(v) || 0} câu hỏi`, ""]}
                        contentStyle={tooltipStyle}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#C9973C"
                        strokeWidth={2}
                        dot={{ r: 3, fill: "#C9973C", strokeWidth: 0 }}
                        activeDot={{ r: 5, fill: "#7B1818" }}
                        name="Câu hỏi"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Biểu đồ 4: Gauge Hồ sơ (trống) */}
              <div className="rounded-2xl p-4"
                style={{
                  background: "rgba(255,255,255,0.92)",
                  border: "1.5px solid rgba(201,151,60,0.2)",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.07)"
                }}>
                <h3 className="text-xs font-bold tracking-wide mb-3" style={{ color: "#7B1818" }}>
                  ⏱️ HỒ SƠ: TỶ LỆ ĐÚNG HẠN / TRỄ HẠN
                </h3>
                <p className="text-sm text-center py-12" style={{ color: "#B8956A" }}>Chưa có dữ liệu</p>
              </div>
            </div>

            {/* ── BIỂU ĐỒ 5 & 6: HỒ SƠ THEO LĨNH VỰC + TOP THỦ TỤC (trống) ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="rounded-2xl p-4"
                style={{
                  background: "rgba(255,255,255,0.92)",
                  border: "1.5px solid rgba(201,151,60,0.2)",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.07)"
                }}>
                <h3 className="text-xs font-bold tracking-wide mb-3" style={{ color: "#7B1818" }}>
                  🏷️ HỒ SƠ THEO LĨNH VỰC
                </h3>
                <p className="text-sm text-center py-12" style={{ color: "#B8956A" }}>Chưa có dữ liệu</p>
              </div>

              <div className="rounded-2xl p-4"
                style={{
                  background: "rgba(255,255,255,0.92)",
                  border: "1.5px solid rgba(201,151,60,0.2)",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.07)"
                }}>
                <h3 className="text-xs font-bold tracking-wide mb-3" style={{ color: "#7B1818" }}>
                  🏆 TOP 5 THỦ TỤC ĐƯỢC NỘP NHIỀU NHẤT
                </h3>
                <p className="text-sm text-center py-12" style={{ color: "#B8956A" }}>Chưa có dữ liệu</p>
              </div>
            </div>

            {/* ── FOOTER ── */}
            <div className="text-center text-[9px] py-2" style={{ color: "#B8956A" }}>
              <p>
                ✦ Dữ liệu chatbot: thời gian thực &bull; Dữ liệu hồ sơ: chờ cập nhật
              </p>
              <p className="mt-0.5">
                © VNTP TP.HCM — Phòng Dữ liệu số &bull; Thực tập sinh Nguyễn Quốc Tường
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
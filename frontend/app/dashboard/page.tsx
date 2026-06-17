"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import {
  ArrowLeft,
  RefreshCw,
  MessageSquare,
  Users,
  AlertTriangle,
  Clock,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Label,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
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

function KpiCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-zinc-400 font-medium">{label}</p>
        <p className="text-2xl font-bold text-zinc-800">{value}</p>
        {sub && <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

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
    } catch {
      setError("Không thể tải dữ liệu. Kiểm tra backend đã chạy chưa.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const pieData = data
    ? [
        {
          name: "Trả lời thành công",
          value: data.total_questions - data.fallback_count,
        },
        { name: "Fallback", value: data.fallback_count },
      ]
    : [];

  const PIE_COLORS = ["#6366f1", "#f59e0b"];

  const avgSeconds = data
    ? (data.avg_response_time_ms / 1000).toFixed(1)
    : "—";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white px-6 py-4 shadow-lg flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold leading-tight">
              Dashboard Hiệu suất
            </h1>
            <p className="text-xs text-white/80">
              VNPT TP.HCM — Phân tích xử lý hồ sơ & chatbot
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-white/60">
              Cập nhật: {lastUpdated}
            </span>
          )}
          <button
            onClick={fetchStats}
            disabled={loading}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {loading && !data && (
          <div className="text-center py-20 text-zinc-400">
            Đang tải dữ liệu...
          </div>
        )}

        {data && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                icon={<Users className="w-5 h-5 text-white" />}
                color="bg-gradient-to-br from-blue-500 to-indigo-600"
                label="Tổng phiên làm việc"
                value={data.total_sessions.toString()}
                sub="sessions"
              />
              <KpiCard
                icon={<MessageSquare className="w-5 h-5 text-white" />}
                color="bg-gradient-to-br from-emerald-500 to-teal-600"
                label="Tổng câu hỏi"
                value={data.total_questions.toString()}
                sub="lượt hỏi"
              />
              <KpiCard
                icon={<AlertTriangle className="w-5 h-5 text-white" />}
                color="bg-gradient-to-br from-amber-500 to-orange-600"
                label="Tỷ lệ Fallback"
                value={`${data.fallback_rate}%`}
                sub={`${data.fallback_count} câu không tìm được`}
              />
              <KpiCard
                icon={<Clock className="w-5 h-5 text-white" />}
                color="bg-gradient-to-br from-purple-500 to-pink-600"
                label="Thời gian phản hồi TB"
                value={`${avgSeconds}s`}
                sub="trung bình mỗi câu"
              />
            </div>

            {/* Row 2: Pie + Line */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Pie Chart */}
              <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-5">
                <h2 className="text-sm font-semibold text-zinc-700 mb-4">
                  Tỷ lệ trả lời thành công / Fallback
                </h2>
                {data.total_questions === 0 ? (
                  <p className="text-sm text-zinc-400 text-center py-10">
                    Chưa có dữ liệu
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={95}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i]} />
                        ))}
                        <Label
                          value={`${(100 - data.fallback_rate).toFixed(1)}%`}
                          position="center"
                          fill="#6366f1"
                          fontSize={28}
                          fontWeight="bold"
                        />
                      </Pie>
                      <Tooltip
                        formatter={(val: unknown) => [`${Number(val) || 0} câu`, ""]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                <div className="flex items-center justify-center gap-6 mt-2">
                  {pieData.map((d, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs text-zinc-500">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ background: PIE_COLORS[i] }}
                      />
                      {d.name} ({d.value})
                    </div>
                  ))}
                </div>
              </div>

              {/* Line Chart */}
              <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-5">
                <h2 className="text-sm font-semibold text-zinc-700 mb-4">
                  Lượng câu hỏi theo ngày (7 ngày gần nhất)
                </h2>
                {data.daily_questions.length === 0 ? (
                  <p className="text-sm text-zinc-400 text-center py-10">
                    Chưa có dữ liệu
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart
                      data={data.daily_questions}
                      margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => v.slice(5)}
                      />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        labelFormatter={(v) => `Ngày ${v}`}
                        formatter={(val: unknown) => [`${Number(val) || 0} câu hỏi`, ""]}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#6366f1"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: "#6366f1" }}
                        activeDot={{ r: 6 }}
                        name="Câu hỏi"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Bar Chart: Top thủ tục */}
            <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-5">
              <h2 className="text-sm font-semibold text-zinc-700 mb-4">
                Thủ tục hành chính được hỏi nhiều nhất
              </h2>
              {data.top_thu_tuc.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-sm text-zinc-400">
                    Dữ liệu sẽ xuất hiện sau khi có thêm câu hỏi mới.
                  </p>
                  <p className="text-xs text-zinc-300 mt-1">
                    (Dữ liệu cũ trước 16/06 chưa lưu tên thủ tục)
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={data.top_thu_tuc.slice(0, 8)}
                    layout="vertical"
                    margin={{ left: 20, right: 30, top: 5, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="ten_thu_tuc"
                      width={200}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: string) =>
                        v.length > 32 ? v.slice(0, 32) + "…" : v
                      }
                    />
                    <Tooltip
                      formatter={(val: unknown) => [`${Number(val) || 0} lượt`, "Số lần hỏi"]}
                    />
                    <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} name="Lượt hỏi" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
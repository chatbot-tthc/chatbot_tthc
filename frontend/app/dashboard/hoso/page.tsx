"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, RefreshCw, AlertTriangle, FileText,
  CheckCircle, XCircle, Clock, X, ChevronLeft, ChevronRight,
  MessageSquare,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, Label, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

interface HosoItem {
  id: string;
  ten_thu_tuc: string;
  trang_thai: string;
  ngay_nop: string;
  han_xu_ly: string;
  linh_vuc: string;
}

interface PopupState {
  title: string;
  filter: Record<string, string>;
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

const PAGE_SIZE = 10;

// Danh sách cơ quan — anh hướng dẫn sẽ cung cấp thêm data
const CO_QUAN_LIST = [
  { value: "", label: "Tất cả cơ quan" },
  { value: "lai-thieu", label: "Phường Lái Thiêu" },
  // Thêm phường khác khi có data
];

function KpiCard({ icon, label, value, sub, accent, color }: {
  icon: React.ReactNode; label: string; value: string | number;
  sub?: string; accent?: string; color?: string;
}) {
  return (
    <div className="rounded-2xl flex items-center gap-3 p-3 transition-all hover:shadow-lg hover:-translate-y-0.5 duration-200"
      style={{ background: "rgba(255,255,255,0.92)", border: "1.5px solid rgba(201,151,60,0.2)", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: accent || "linear-gradient(135deg,#7B1818,#9B2020)" }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-medium uppercase tracking-wider" style={{ color: "#9B7B5A" }}>{label}</p>
        <p className="text-lg font-bold" style={{ color: color || "#3D1A0E" }}>{value}</p>
        {sub && <p className="text-[9px] mt-0.5" style={{ color: "#B8956A" }}>{sub}</p>}
      </div>
    </div>
  );
}

// ── POPUP DANH SÁCH HỒ SƠ ──────────────────────────────────────────────────
function HosoPopup({ popup, phuong, onClose }: {
  popup: PopupState;
  phuong: string;
  onClose: () => void;
}) {
  const [items, setItems] = useState<HosoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams({
      page: String(page),
      page_size: String(PAGE_SIZE),
      phuong: phuong || "lai-thieu",
      ...popup.filter,
    });
    setLoading(true);
    fetch(`${API_URL}/api/v1/hoso/list?${params}`)
      .then(r => r.json())
      .then(d => {
        setItems(d.items || []);
        setTotal(d.total || 0);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [page, popup, phuong]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <div className="w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden"
        style={{ background: "#FFFBF5", border: "1.5px solid rgba(201,151,60,0.3)", maxHeight: "85vh" }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between"
          style={{ background: "linear-gradient(135deg,#7B1818,#9B2020)" }}>
          <div>
            <p className="text-white font-bold">{popup.title}</p>
            <p className="text-xs mt-0.5" style={{ color: "rgba(232,192,106,0.8)" }}>
              {total} hồ sơ · Trang {page}/{totalPages || 1}
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/20"
            style={{ background: "rgba(255,255,255,0.12)" }}>
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Table */}
        <div className="overflow-y-auto" style={{ maxHeight: "calc(85vh - 130px)" }}>
          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" style={{ color: "#C9973C" }} />
              <p className="text-sm" style={{ color: "#B8956A" }}>Đang tải...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm" style={{ color: "#B8956A" }}>Không có hồ sơ nào.</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead style={{ background: "#FDF5E6", borderBottom: "1px solid #E8C06A" }}>
                <tr>
                  {["Mã hồ sơ", "Tên thủ tục", "Lĩnh vực", "Ngày nộp", "Hạn xử lý", "Trạng thái"].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-bold" style={{ color: "#7B1818" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={item.id}
                    style={{ background: i % 2 === 0 ? "white" : "#FFFBF5", borderBottom: "1px solid rgba(232,192,106,0.15)" }}>
                    <td className="px-3 py-2 font-mono" style={{ color: "#5A3A1A" }}>{item.id}</td>
                    <td className="px-3 py-2 max-w-[180px]" style={{ color: "#3D1A0E" }}>
                      <span title={item.ten_thu_tuc}>
                        {item.ten_thu_tuc?.length > 30 ? item.ten_thu_tuc.slice(0, 30) + "…" : item.ten_thu_tuc}
                      </span>
                    </td>
                    <td className="px-3 py-2" style={{ color: "#5A3A1A" }}>{item.linh_vuc}</td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: "#5A3A1A" }}>{item.ngay_nop}</td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: "#5A3A1A" }}>{item.han_xu_ly}</td>
                    <td className="px-3 py-2">
                      <span className="px-2 py-0.5 rounded-full text-white text-[10px] whitespace-nowrap"
                        style={{ background: STATUS_COLORS[item.trang_thai] || "#888780" }}>
                        {item.trang_thai}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 flex items-center justify-between border-t"
            style={{ borderColor: "rgba(232,192,106,0.2)", background: "#FDF5E6" }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40 transition-all"
              style={{ background: "white", border: "1px solid #E8C06A", color: "#7B1818" }}>
              <ChevronLeft className="w-3 h-3" /> Trước
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = page <= 3 ? i + 1 : page - 2 + i;
                if (p > totalPages) return null;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className="w-7 h-7 rounded-lg text-xs font-medium transition-all"
                    style={{ background: p === page ? "#7B1818" : "white", color: p === page ? "white" : "#7B1818", border: "1px solid #E8C06A" }}>
                    {p}
                  </button>
                );
              })}
            </div>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40 transition-all"
              style={{ background: "white", border: "1px solid #E8C06A", color: "#7B1818" }}>
              Sau <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── MAIN ────────────────────────────────────────────────────────────────────
export default function DashboardHosoPage() {
  const [hoso, setHoso] = useState<HosoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selectedCoQuan, setSelectedCoQuan] = useState("");
  const [popup, setPopup] = useState<PopupState | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const endpoint = selectedCoQuan || "lai-thieu";
      const r = await fetch(`${API_URL}/api/v1/hoso/${endpoint}`);
      if (!r.ok) throw new Error(`Lỗi ${r.status}`);
      setHoso(await r.json());
      setLastUpdated(new Date().toLocaleTimeString("vi-VN"));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Không thể tải dữ liệu.");
    } finally { setLoading(false); }
  }, [selectedCoQuan]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const overdueData = hoso ? [
    { name: "Đúng hạn", value: hoso.on_time_count, color: "#1baf7a" },
    { name: "Trễ hạn", value: hoso.overdue_count, color: "#e34948" },
  ] : [];

  const openPopup = (title: string, filter: Record<string, string>) => {
    setPopup({ title, filter });
  };

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
            <h1 className="text-white font-bold text-lg tracking-widest drop-shadow">DASHBOARD HỒ SƠ HÀNH CHÍNH</h1>
            <p className="text-[10px] tracking-wider" style={{ color: "#E8C06A" }}>Phân tích luồng công việc & hiệu suất xử lý — VNPT TP.HCM</p>
          </div>
        </div>
        <div className="flex items-center gap-3 relative z-10">
          <Link href="/dashboard"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all hover:bg-white/20"
            style={{ background: "rgba(255,255,255,0.12)", color: "#E8C06A" }}>
            <MessageSquare className="w-3.5 h-3.5" />
            Dashboard Chatbot
          </Link>
          {lastUpdated && <span className="text-[10px]" style={{ color: "rgba(232,192,106,0.7)" }}>Cập nhật: {lastUpdated}</span>}
          <button onClick={fetchData} disabled={loading}
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

        {/* BỘ LỌC CƠ QUAN */}
        <div className="rounded-2xl p-4 flex items-center gap-4"
          style={{ background: "rgba(255,255,255,0.92)", border: "1.5px solid rgba(201,151,60,0.2)", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#7B1818" }}>Cơ quan:</span>
          <select value={selectedCoQuan} onChange={e => setSelectedCoQuan(e.target.value)}
            className="flex-1 max-w-xs px-3 py-2 rounded-xl text-sm outline-none transition-all"
            style={{ background: "#FDF5E6", border: "1.5px solid #E8C06A", color: "#3D1A0E" }}>
            {CO_QUAN_LIST.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        {loading && !hoso && (
          <div className="text-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: "#C9973C" }} />
            <p className="text-sm font-medium" style={{ color: "#B8956A" }}>Đang tải dữ liệu...</p>
          </div>
        )}

        {hoso && (
          <>
            {/* KPI */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiCard icon={<FileText className="w-4 h-4 text-white" />}
                accent="linear-gradient(135deg,#4A4A4A,#6B6B6B)" label="Tổng hồ sơ"
                value={hoso.total} sub={hoso.thang} />
              <KpiCard icon={<CheckCircle className="w-4 h-4 text-white" />}
                accent="linear-gradient(135deg,#1B8A4A,#2BAD6B)" label="Đúng hạn"
                value={hoso.on_time_count} sub={`${hoso.on_time_rate}%`} color="#1B8A4A" />
              <KpiCard icon={<XCircle className="w-4 h-4 text-white" />}
                accent="linear-gradient(135deg,#B22222,#DC3545)" label="Trễ hạn"
                value={hoso.overdue_count} sub={`${hoso.overdue_rate}%`} color="#B22222" />
              <KpiCard icon={<Clock className="w-4 h-4 text-white" />}
                accent="linear-gradient(135deg,#0F766E,#14B8A6)" label="Đã trả kết quả"
                value={hoso.done_count} sub={`${((hoso.done_count / hoso.total) * 100).toFixed(1)}%`} />
            </div>

            {/* PHÂN BỔ TRẠNG THÁI + TỶ LỆ ĐÚNG/TRỄ HẠN */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Phân bổ trạng thái */}
              <div className="rounded-2xl p-4 cursor-pointer transition-all hover:shadow-xl hover:-translate-y-0.5"
                style={{ background: "rgba(255,255,255,0.92)", border: "1.5px solid rgba(201,151,60,0.2)", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}
                onClick={() => openPopup("Danh sách hồ sơ theo trạng thái", {})}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold tracking-wide" style={{ color: "#7B1818" }}>PHÂN BỔ TRẠNG THÁI HỒ SƠ</h3>
                  <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: "#FDF5E6", color: "#C9973C", border: "1px solid #E8C06A" }}>
                    Bấm để xem chi tiết
                  </span>
                </div>
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

              {/* Tỷ lệ đúng/trễ hạn */}
              <div className="rounded-2xl p-4 cursor-pointer transition-all hover:shadow-xl hover:-translate-y-0.5"
                style={{ background: "rgba(255,255,255,0.92)", border: "1.5px solid rgba(201,151,60,0.2)", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}
                onClick={() => openPopup("Danh sách hồ sơ trễ hạn", { trang_thai_nhom: "tre_han" })}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold tracking-wide" style={{ color: "#7B1818" }}>TỶ LỆ ĐÚNG HẠN / TRỄ HẠN</h3>
                  <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: "#FDF5E6", color: "#C9973C", border: "1px solid #E8C06A" }}>
                    Bấm để xem trễ hạn
                  </span>
                </div>
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

            {/* HỒ SƠ THEO LĨNH VỰC + TOP THỦ TỤC */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="rounded-2xl p-4 cursor-pointer transition-all hover:shadow-xl hover:-translate-y-0.5"
                style={{ background: "rgba(255,255,255,0.92)", border: "1.5px solid rgba(201,151,60,0.2)", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}
                onClick={() => openPopup("Hồ sơ theo lĩnh vực", {})}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold tracking-wide" style={{ color: "#7B1818" }}>HỒ SƠ THEO LĨNH VỰC (TOP 6)</h3>
                  <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: "#FDF5E6", color: "#C9973C", border: "1px solid #E8C06A" }}>
                    Bấm để xem chi tiết
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={hoso.sectors} layout="vertical" margin={{ left: 10, right: 40, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5E8D5" />
                    <XAxis type="number" tick={{ fontSize: 9, fill: "#9B7B5A" }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 9, fill: "#5A3A1A" }} />
                    <Tooltip formatter={(v: unknown) => [`${Number(v) || 0} hồ sơ`, ""]} contentStyle={tooltipStyle} />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]} fill="#2a78d6" name="Hồ sơ"
                      onClick={(data) => openPopup(`Hồ sơ lĩnh vực: ${data.name || ""}`, { linh_vuc: data.name || "" })} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-2xl p-4 cursor-pointer transition-all hover:shadow-xl hover:-translate-y-0.5"
                style={{ background: "rgba(255,255,255,0.92)", border: "1.5px solid rgba(201,151,60,0.2)", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}
                onClick={() => openPopup("Top thủ tục được nộp nhiều nhất", {})}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold tracking-wide" style={{ color: "#7B1818" }}>TOP 5 THỦ TỤC ĐƯỢC NỘP NHIỀU NHẤT</h3>
                  <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: "#FDF5E6", color: "#C9973C", border: "1px solid #E8C06A" }}>
                    Bấm để xem chi tiết
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={hoso.top_procedures} layout="vertical" margin={{ left: 10, right: 40, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F5E8D5" />
                    <XAxis type="number" tick={{ fontSize: 9, fill: "#9B7B5A" }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 9, fill: "#5A3A1A" }}
                      tickFormatter={(v: string) => v.length > 26 ? v.slice(0, 26) + "…" : v} />
                    <Tooltip formatter={(v: unknown) => [`${Number(v) || 0} hồ sơ`, ""]} contentStyle={tooltipStyle} />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]} fill="#C9973C" name="Hồ sơ"
                      onClick={(data) => openPopup(`Hồ sơ thủ tục: ${data.name || ""}`, { ten_thu_tuc: data.name || "" })} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ĐÚNG/TRỄ HẠN THEO LĨNH VỰC */}
            <div className="rounded-2xl p-4 cursor-pointer transition-all hover:shadow-xl hover:-translate-y-0.5"
              style={{ background: "rgba(255,255,255,0.92)", border: "1.5px solid rgba(201,151,60,0.2)", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}
              onClick={() => openPopup("Hồ sơ đúng hạn / trễ hạn theo lĩnh vực", {})}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold tracking-wide" style={{ color: "#7B1818" }}>ĐÚNG HẠN / TRỄ HẠN THEO LĨNH VỰC</h3>
                <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: "#FDF5E6", color: "#C9973C", border: "1px solid #E8C06A" }}>
                  Bấm để xem chi tiết
                </span>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={hoso.overdue_by_sector} layout="vertical" margin={{ left: 10, right: 40, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F5E8D5" />
                  <XAxis type="number" tick={{ fontSize: 9, fill: "#9B7B5A" }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 9, fill: "#5A3A1A" }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="on_time" stackId="a" fill="#1baf7a" name="Đúng hạn"
                    onClick={(data) => openPopup(`Hồ sơ đúng hạn: ${data.name || ""}`, { linh_vuc: data.name || "", trang_thai_nhom: "dung_han" })} />
                  <Bar dataKey="overdue" stackId="a" fill="#e34948" name="Trễ hạn" radius={[0, 4, 4, 0]}
                    onClick={(data) => openPopup(`Hồ sơ trễ hạn: ${data.name || ""}`, { linh_vuc: data.name || "", trang_thai_nhom: "tre_han" })} />
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

            <p className="text-center text-[9px] pb-2" style={{ color: "#B8956A" }}>
              ✦ {hoso.thang} — {hoso.phuong} — VNPT TP.HCM
            </p>
          </>
        )}
      </main>

      {/* POPUP */}
      {popup && (
        <HosoPopup
          popup={popup}
          phuong={selectedCoQuan || "lai-thieu"}
          onClose={() => setPopup(null)}
        />
      )}
    </div>
  );
}

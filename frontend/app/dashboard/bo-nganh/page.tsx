"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft, RefreshCw, AlertTriangle, Building2,
  CheckCircle2, Loader2, XCircle, DownloadCloud,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Agency {
  id: string;
  code: string;
  display_name: string;
  is_active: boolean;
  thu_tuc_count: number;
  crawl_status: "idle" | "crawling" | "failed";
  last_crawled_at: string | null;
  last_crawl_error: string | null;
}

const POLL_INTERVAL_MS = 5000;

function Toggle({ checked, disabled, onChange }: {
  checked: boolean; disabled?: boolean; onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className="relative w-11 h-6 rounded-full shrink-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ background: checked ? "linear-gradient(135deg,#1B8A4A,#2BAD6B)" : "#D9CBB0" }}
    >
      <span
        className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
        style={{ left: checked ? "22px" : "2px" }}
      />
    </button>
  );
}

function CrawlStatusBadge({ status }: { status: Agency["crawl_status"] }) {
  if (status === "crawling") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full"
        style={{ background: "#FDF0DA", color: "#C9973C", border: "1px solid #E8C06A" }}>
        <Loader2 className="w-3 h-3 animate-spin" /> Đang crawl...
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full"
        style={{ background: "#FBEAEA", color: "#B22222", border: "1px solid #E39B9B" }}>
        <XCircle className="w-3 h-3" /> Lỗi
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full"
      style={{ background: "#E8F5EC", color: "#1B8A4A", border: "1px solid #9ED8B4" }}>
      <CheckCircle2 className="w-3 h-3" /> Sẵn sàng
    </span>
  );
}

export default function DashboardBoNganhPage() {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState("");
  const [togglingCode, setTogglingCode] = useState<string | null>(null);
  const [crawlingCode, setCrawlingCode] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API_URL}/api/v1/agencies`);
      if (!r.ok) throw new Error(`Lỗi ${r.status}`);
      const data: Agency[] = await r.json();
      setAgencies(data);
      setLastUpdated(new Date().toLocaleTimeString("vi-VN"));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Không thể tải dữ liệu.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Poll trong khi có bộ nào đang crawl, để tự cập nhật trạng thái/số liệu
  useEffect(() => {
    const anyCrawling = agencies.some(a => a.crawl_status === "crawling");
    if (anyCrawling && !pollRef.current) {
      pollRef.current = setInterval(() => fetchData(true), POLL_INTERVAL_MS);
    }
    if (!anyCrawling && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [agencies, fetchData]);

  const handleToggle = async (agency: Agency) => {
    setTogglingCode(agency.code);
    try {
      const r = await fetch(`${API_URL}/api/v1/agencies/${agency.code}/toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !agency.is_active }),
      });
      if (!r.ok) throw new Error(`Lỗi ${r.status}`);
      const updated: Agency = await r.json();
      setAgencies(prev => prev.map(a => a.code === updated.code ? updated : a));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Không thể cập nhật trạng thái.");
    } finally {
      setTogglingCode(null);
    }
  };

  const handleCrawl = async (agency: Agency) => {
    setCrawlingCode(agency.code);
    setError(null);
    try {
      const r = await fetch(`${API_URL}/api/v1/agencies/${agency.code}/crawl`, { method: "POST" });
      if (!r.ok && r.status !== 409) throw new Error(`Lỗi ${r.status}`);
      await fetchData(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Không thể bắt đầu crawl.");
    } finally {
      setCrawlingCode(null);
    }
  };

  const totalThuTuc = agencies.reduce((s, a) => s + a.thu_tuc_count, 0);
  const activeCount = agencies.filter(a => a.is_active).length;

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
            <h1 className="text-white font-bold text-lg tracking-widest drop-shadow">QUẢN LÝ DỮ LIỆU BỘ/NGÀNH</h1>
            <p className="text-[10px] tracking-wider" style={{ color: "#E8C06A" }}>
              Bật/tắt nguồn dữ liệu & cập nhật crawl — VNPT TP.HCM
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 relative z-10">
          {lastUpdated && (
            <span className="hidden sm:block text-[10px]" style={{ color: "rgba(232,192,106,0.7)" }}>
              Cập nhật: {lastUpdated}
            </span>
          )}
          <button onClick={() => fetchData()} disabled={loading}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-white/15 disabled:opacity-50"
            style={{ background: "rgba(255,255,255,0.12)" }}>
            <RefreshCw className={`w-4 h-4 text-white ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        {error && (
          <div className="rounded-2xl px-4 py-3 text-sm flex items-center gap-2"
            style={{ background: "rgba(255,248,240,0.95)", border: "1.5px solid #E8C06A", color: "#7B1818" }}>
            <AlertTriangle className="w-4 h-4 shrink-0" />{error}
          </div>
        )}

        {loading && agencies.length === 0 && (
          <div className="text-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: "#C9973C" }} />
            <p className="text-sm font-medium" style={{ color: "#B8956A" }}>Đang tải dữ liệu...</p>
          </div>
        )}

        {agencies.length > 0 && (
          <>
            {/* KPI tổng quan */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.92)", border: "1.5px solid rgba(201,151,60,0.2)", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
                <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "#9B7B5A" }}>Tổng bộ/ngành</p>
                <p className="text-2xl font-bold" style={{ color: "#3D1A0E" }}>{agencies.length}</p>
              </div>
              <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.92)", border: "1.5px solid rgba(201,151,60,0.2)", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
                <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "#9B7B5A" }}>Đang bật</p>
                <p className="text-2xl font-bold" style={{ color: "#1B8A4A" }}>{activeCount}/{agencies.length}</p>
              </div>
              <div className="rounded-2xl p-4 col-span-2 sm:col-span-1" style={{ background: "rgba(255,255,255,0.92)", border: "1.5px solid rgba(201,151,60,0.2)", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
                <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "#9B7B5A" }}>Tổng thủ tục</p>
                <p className="text-2xl font-bold" style={{ color: "#3D1A0E" }}>{totalThuTuc.toLocaleString("vi-VN")}</p>
              </div>
            </div>

            {/* Bảng danh sách */}
            <div className="rounded-2xl overflow-hidden"
              style={{ background: "rgba(255,255,255,0.92)", border: "1.5px solid rgba(201,151,60,0.2)", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "#FDF5E6" }}>
                      <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#7B1818" }}>Bộ/Ngành</th>
                      <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#7B1818" }}>Số thủ tục</th>
                      <th className="text-center px-4 py-3 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#7B1818" }}>Trạng thái</th>
                      <th className="text-center px-4 py-3 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#7B1818" }}>Bật/Tắt</th>
                      <th className="text-center px-4 py-3 text-[10px] font-bold uppercase tracking-wider" style={{ color: "#7B1818" }}>Cập nhật</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agencies.map((a, i) => (
                      <tr key={a.code} style={{ borderTop: i === 0 ? "none" : "1px solid rgba(201,151,60,0.15)" }}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 shrink-0" style={{ color: "#C9973C" }} />
                            <div>
                              <p className="font-semibold" style={{ color: "#3D1A0E" }}>{a.display_name}</p>
                              <p className="text-[10px]" style={{ color: "#B8956A" }}>
                                {a.code}
                                {a.last_crawled_at && ` · crawl gần nhất: ${new Date(a.last_crawled_at).toLocaleString("vi-VN")}`}
                              </p>
                              {a.crawl_status === "failed" && a.last_crawl_error && (
                                <p className="text-[10px] mt-0.5" style={{ color: "#B22222" }} title={a.last_crawl_error}>
                                  {a.last_crawl_error.slice(0, 80)}{a.last_crawl_error.length > 80 ? "…" : ""}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold" style={{ color: "#3D1A0E" }}>
                          {a.thu_tuc_count.toLocaleString("vi-VN")}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center"><CrawlStatusBadge status={a.crawl_status} /></div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center">
                            <Toggle
                              checked={a.is_active}
                              disabled={togglingCode === a.code}
                              onChange={() => handleToggle(a)}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center">
                            <button
                              onClick={() => handleCrawl(a)}
                              disabled={a.crawl_status === "crawling" || crawlingCode === a.code}
                              className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full transition-all hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
                              style={{ background: "linear-gradient(135deg,#7B1818,#9B2020)", color: "white" }}
                            >
                              <DownloadCloud className="w-3.5 h-3.5" />
                              Cập nhật
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-center text-[9px] pb-2" style={{ color: "#B8956A" }}>
              ✦ Tắt 1 bộ sẽ khiến trợ lý AI ngay lập tức không tìm kiếm dữ liệu của bộ đó nữa — VNPT TP.HCM
            </p>
          </>
        )}
      </main>
    </div>
  );
}

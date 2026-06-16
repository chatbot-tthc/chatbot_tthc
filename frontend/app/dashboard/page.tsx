import Link from "next/link";
import { ArrowLeft, BarChart3 } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg mb-4">
          <BarChart3 className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 mb-2">
          Dashboard hiệu suất xử lý hồ sơ
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
          Trang đang được phát triển — sẽ hiển thị tỷ lệ hồ sơ đúng hạn/trễ hạn,
          thủ tục được quan tâm nhiều nhất, và hiệu năng phản hồi hệ thống theo
          thời gian thực.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 shadow-sm hover:shadow-md transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại Chatbot
        </Link>
      </div>
    </div>
  );
}
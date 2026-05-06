"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  MapPin,
  Building2,
  ClipboardList,
  FileText,
  LogOut,
  Newspaper,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const NAV = [
  { href: "/admin", label: "대시보드", icon: LayoutDashboard, exact: true },
  { href: "/admin/distributors", label: "배포자 관리", icon: Users },
  { href: "/admin/teams", label: "팀·권역 관리", icon: Building2 },
  { href: "/admin/locations", label: "배포처 관리", icon: MapPin },
  { href: "/admin/routes", label: "배포 이력", icon: ClipboardList },
  { href: "/admin/reports", label: "완료 보고서", icon: FileText },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/admin/login");
  }

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* 데스크탑 사이드바 */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-60 bg-[#161b27] border-r border-white/5 flex-col z-40">
        {/* 브랜드 */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/5">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Newspaper size={16} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none">새벽배포</p>
            <p className="text-slate-500 text-xs mt-0.5">관리자 콘솔</p>
          </div>
        </div>

        {/* 네비게이션 */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? "bg-blue-600/15 text-blue-400"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                <Icon size={16} className={active ? "text-blue-400" : "text-slate-500"} />
                {label}
                {active && <span className="ml-auto w-1.5 h-1.5 bg-blue-400 rounded-full" />}
              </Link>
            );
          })}
        </nav>

        {/* 로그아웃 */}
        <div className="px-3 py-4 border-t border-white/5">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-white/5 hover:text-red-400 transition-colors"
          >
            <LogOut size={16} />
            로그아웃
          </button>
        </div>
      </aside>

      {/* 모바일 하단 탭바 */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#161b27] border-t border-white/5 z-40 flex">
        {NAV.slice(0, 5).map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors ${
                active ? "text-blue-400" : "text-slate-500"
              }`}
            >
              <Icon size={18} />
              <span>{label.split(" ")[0]}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

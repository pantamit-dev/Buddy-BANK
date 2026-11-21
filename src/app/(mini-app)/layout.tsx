"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Wallet,
  Receipt,
  Users,
  CheckSquare,
  Settings,
  CircleDot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LiffProvider, useLiff } from "@/shared/context/liff-context";

function MiniAppContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile } = useLiff();

  const navItems = [
    { href: "/overview", label: "ภาพรวม", icon: Wallet },
    { href: "/my-deposits", label: "ยอดฉัน", icon: Receipt },
    { href: "/review", label: "ตรวจสลิป", icon: CheckSquare },
    { href: "/group-members", label: "สมาชิก", icon: Users },
    { href: "/settings", label: "ตั้งค่า", icon: Settings },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 pb-20 max-w-md mx-auto shadow-md border-x border-slate-200">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏦</span>
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-tight">
              Money Pool
            </h1>
            <p className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
              <CircleDot className="w-2.5 h-2.5 fill-emerald-500 text-emerald-500 animate-pulse" />
              LINE Mini App
            </p>
          </div>
        </div>
        {profile && (
          <div className="flex items-center gap-2">
            {profile.pictureUrl ? (
              <img
                src={profile.pictureUrl}
                alt={profile.displayName}
                className="w-8 h-8 rounded-full border border-slate-200 object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
                {profile.displayName.slice(0, 1)}
              </div>
            )}
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4">{children}</main>

      {/* Bottom Tab Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 max-w-md mx-auto">
        <div className="grid grid-cols-5 h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center text-xs transition-colors py-1",
                  isActive
                    ? "text-emerald-600 font-semibold"
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                <Icon
                  className={cn(
                    "w-5 h-5 mb-1",
                    isActive ? "stroke-[2.5]" : "stroke-[1.75]"
                  )}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default function MiniAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LiffProvider>
      <MiniAppContent>{children}</MiniAppContent>
    </LiffProvider>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Home,
  Receipt,
  CheckSquare,
  Settings,
  Bell,
  UserCheck,
  CheckCircle2,
  X,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LiffProvider, useLiff } from "@/shared/context/liff-context";
import { ProfileRegisterDialog } from "@/shared/components/profile-register-dialog";
import { Button } from "@/shared/components/ui/button";

function MiniAppContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile, isRegistered } = useLiff();
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);

  // Auto-open registration/verification dialog when opened with action=verify from LINE Flex Message
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const action = params.get("action");
      if (action === "verify" || action === "register") {
        setRegisterDialogOpen(true);
      }
    }
  }, []);

  // 4 Bottom Navigation tabs strictly matching docs/designs/a16803d0-e61b-11f1-af2f-ff56d59234c6.svg
  const navItems = [
    { href: "/overview", label: "หน้าหลัก", icon: Home },
    { href: "/my-deposits", label: "บัญชี", icon: Receipt },
    { href: "/review", label: "กิจกรรม", icon: CheckSquare },
    { href: "/settings", label: "ตั้งค่า", icon: Settings },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-page pb-24 max-w-md mx-auto shadow-sm border-x border-border relative transition-colors duration-200">
      {/* Top Header matching SVG Design */}
      <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between shadow-xs transition-colors duration-200">
        <div className="flex items-center gap-3">
          {/* Logo with rounded container */}
          <Link href="/overview" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-2xl overflow-hidden bg-brand-soft border border-brand/20 flex items-center justify-center p-1 shadow-xs group-hover:scale-105 transition-transform">
              <img
                src="/logo.svg"
                alt="Bank Buddy Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-brand-strong leading-tight tracking-tight">
                Bank Buddy
              </h1>
              <p className="text-[10.5px] text-text-secondary font-medium">
                เพื่อนพึ่งพายามยาก
              </p>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {/* Notification Bell Button */}
          <button
            onClick={() => setShowNotificationModal(true)}
            aria-label="การแจ้งเตือน"
            className="w-9 h-9 rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-brand-soft/60 relative transition-colors"
          >
            <Bell className="w-4 h-4 stroke-[2]" />
            {/* Unread badge matching SVG */}
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#E75B4C] ring-2 ring-surface" />
          </button>

          {/* Registration / Profile Button */}
          <Button
            size="sm"
            variant={isRegistered ? "outline" : "default"}
            onClick={() => setRegisterDialogOpen(true)}
            className={cn(
              "h-8 px-2.5 text-xs font-semibold gap-1.5 transition-all rounded-xl",
              isRegistered
                ? "border-brand/30 text-brand bg-brand-soft/50 hover:bg-brand-soft"
                : "bg-brand text-white hover:bg-brand-strong"
            )}
          >
            {isRegistered ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-brand" />
                <span className="hidden sm:inline">ยืนยันแล้ว</span>
              </>
            ) : (
              <>
                <UserCheck className="w-3.5 h-3.5" />
                <span>ลงทะเบียน</span>
              </>
            )}
          </Button>

          {profile && (
            <div
              className="cursor-pointer"
              onClick={() => setRegisterDialogOpen(true)}
              title="ข้อมูลโปรไฟล์ LINE"
            >
              {profile.pictureUrl ? (
                <img
                  src={profile.pictureUrl}
                  alt={profile.displayName}
                  className="w-8 h-8 rounded-full border border-border object-cover hover:ring-2 hover:ring-brand transition-all"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-brand text-white flex items-center justify-center text-xs font-bold hover:ring-2 hover:ring-brand transition-all">
                  {profile.displayName.slice(0, 1)}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Top Banner Alert if not registered */}
      {!isRegistered && (
        <div className="bg-brand-soft/80 border-b border-brand/20 px-4 py-2 flex items-center justify-between text-xs text-brand-strong transition-colors">
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-sm">👋</span>
            <span className="truncate">
              ยินดีต้อนรับ! กรุณายืนยันข้อมูลโปรไฟล์เพื่อเริ่มใช้งาน
            </span>
          </div>
          <button
            onClick={() => setRegisterDialogOpen(true)}
            className="text-xs font-bold text-brand hover:underline ml-2 shrink-0"
          >
            กดยืนยัน
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 p-4">{children}</main>

      {/* Profile Registration Dialog */}
      <ProfileRegisterDialog
        open={registerDialogOpen}
        onOpenChange={setRegisterDialogOpen}
      />

      {/* Notification Modal / Sheet */}
      {showNotificationModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-surface rounded-t-3xl sm:rounded-2xl w-full max-w-sm border border-border p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-brand" />
                <h3 className="text-sm font-bold text-text-primary">
                  การแจ้งเตือน
                </h3>
              </div>
              <button
                onClick={() => setShowNotificationModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-brand-soft/40 text-text-secondary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-brand-soft/40 border border-brand/15 text-xs text-text-primary space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-brand-strong">ระบบบันทึกสลิปสำเร็จ</span>
                  <span className="text-[10px] text-text-secondary">เมื่อสักครู่</span>
                </div>
                <p className="text-text-secondary text-[11px]">
                  สลิปโอนเงินของคุณได้รับการตรวจสอบและบันทึกลงใน Immutable Ledger เรียบร้อยแล้ว
                </p>
              </div>
              <div className="p-3 rounded-xl bg-surface border border-border text-xs text-text-primary space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold">ระบบความปลอดภัย AI</span>
                  <span className="text-[10px] text-text-secondary">วันนี้</span>
                </div>
                <p className="text-text-secondary text-[11px]">
                  การตรวจสอบความเสี่ยงสลิปซ้ำและการปลอมแปลงข้อมูลทำงานปกติ 100%
                </p>
              </div>
            </div>
            <Button
              className="w-full bg-brand text-white hover:bg-brand-strong rounded-xl text-xs h-9 font-semibold"
              onClick={() => setShowNotificationModal(false)}
            >
              รับทราบ
            </Button>
          </div>
        </div>
      )}

      {/* Bottom Tab Navigation strictly matching SVG Design */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-md border-t border-border max-w-md mx-auto shadow-lg pb-[env(safe-area-inset-bottom)] transition-colors duration-200">
        <div className="grid grid-cols-4 h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center py-1 transition-all relative group",
                  isActive
                    ? "text-brand font-bold"
                    : "text-text-secondary hover:text-text-primary"
                )}
              >
                {/* Active indicator pill */}
                {isActive && (
                  <span className="absolute top-1 w-6 h-1 rounded-full bg-brand transition-all" />
                )}
                <div
                  className={cn(
                    "p-1 rounded-xl transition-colors",
                    isActive ? "bg-brand-soft/60" : "group-hover:bg-brand-soft/30"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-5 h-5",
                      isActive ? "stroke-[2.5]" : "stroke-[1.8]"
                    )}
                  />
                </div>
                <span className="text-[10.5px] mt-0.5 tracking-tight font-medium">
                  {item.label}
                </span>
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

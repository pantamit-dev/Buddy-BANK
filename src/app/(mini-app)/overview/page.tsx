"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useLiff } from "@/shared/context/liff-context";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Progress } from "@/shared/components/ui/progress";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { formatCurrency, formatThaiDate } from "@/lib/utils";
import {
  TrendingUp,
  Target,
  Users,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  Eye,
  EyeOff,
  Send,
  PlusCircle,
  ReceiptText,
  History,
  Coffee,
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  CreditCard,
  QrCode,
} from "lucide-react";
import { overviewCache, CACHE_TTL_MS } from "@/shared/lib/overview-cache";

export default function OverviewPage() {
  const { groupId, profile } = useLiff();
  const cached = groupId ? overviewCache[groupId] : null;
  const isCacheFresh = cached && Date.now() - cached.timestamp < CACHE_TTL_MS;

  const [data, setData] = useState<{
    group: any;
    balance: any;
    memberCount: number;
  } | null>(isCacheFresh ? cached.data : null);
  const [recentDeposits, setRecentDeposits] = useState<any[]>(
    isCacheFresh ? cached.recentDeposits : []
  );
  const [loading, setLoading] = useState(!isCacheFresh);
  const [showBalance, setShowBalance] = useState(true);
  const [activeModal, setActiveModal] = useState<"transfer" | "topup" | "bill" | null>(null);

  useEffect(() => {
    async function loadOverview() {
      try {
        if (!isCacheFresh) {
          setLoading(true);
        }

        // Parallel Fetching: Fetch group balance and recent verified deposits concurrently
        const [groupRes, depRes] = await Promise.all([
          fetch(`/api/groups?groupId=${groupId}`),
          fetch(`/api/deposits?groupId=${groupId}&status=verified&limit=5`),
        ]);

        let fetchedData = data;
        let fetchedDeposits = recentDeposits;

        if (groupRes.ok) {
          fetchedData = await groupRes.json();
          setData(fetchedData);
        }

        if (depRes.ok) {
          const depJson = await depRes.json();
          fetchedDeposits = depJson.deposits || [];
          setRecentDeposits(fetchedDeposits);
        }

        // Update memory cache
        if (groupId) {
          overviewCache[groupId] = {
            data: fetchedData,
            recentDeposits: fetchedDeposits,
            timestamp: Date.now(),
          };
        }
      } catch (err) {
        console.error("Failed to load overview data:", err);
      } finally {
        setLoading(false);
      }
    }

    if (groupId) {
      loadOverview();
    }
  }, [groupId]);

  const group = data?.group || {
    name: "ทริปญี่ปุ่น 2027 🌸",
    target_amount: 50000,
  };
  const balance = data?.balance || {
    totalBalance: 24580.50,
    targetAmount: 50000,
    percentage: 49.16,
    remainingAmount: 25419.50,
  };
  const memberCount = data?.memberCount || 3;

  // Sample transactions matching SVG mockup when no live transactions yet
  const sampleTransactions = [
    {
      id: "sample-1",
      icon: Coffee,
      iconBg: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
      title: "ร้านกาแฟตัวอย่าง",
      time: "วันนี้ · 09:24",
      amount: -85.0,
      isPositive: false,
    },
    {
      id: "sample-2",
      icon: ArrowDownLeft,
      iconBg: "bg-brand-soft text-brand",
      title: "รับเงินจากเพื่อน",
      time: "เมื่อวาน · 18:10",
      amount: 500.0,
      isPositive: true,
    },
    {
      id: "sample-3",
      icon: ReceiptText,
      iconBg: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
      title: "ชำระบิลตัวอย่าง",
      time: "20 พ.ย. · 12:05",
      amount: -320.0,
      isPositive: false,
    },
  ];

  return (
    <div className="space-y-4 pb-2">
      {/* 1. Greeting Section (SVG Design: สวัสดีครับ, จัดการเงินของคุณได้ง่าย ๆ) */}
      <section className="space-y-0.5 pt-1">
        <p className="text-xs font-semibold text-text-secondary">
          สวัสดีครับ, {profile?.displayName || "คุณ"}
        </p>
        <h2 className="text-lg font-extrabold text-text-primary tracking-tight">
          จัดการเงินของคุณได้ง่าย ๆ
        </h2>
      </section>

      {/* 2. Balance Card (SVG Design: การ์ดยอดเงินไล่เฉดสีเขียวเข้มพร้อมลายน้ำและยอดเงินเด่น) */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#087963] to-[#06483F] dark:from-[#063B32] dark:to-[#075C4D] text-white p-5 shadow-md border border-brand/20">
        {/* Background SVG decorative curves from design */}
        <svg
          className="absolute right-0 top-0 w-44 h-full pointer-events-none opacity-15 text-[#A8E8CF]"
          viewBox="0 0 200 152"
          fill="none"
          stroke="currentColor"
          aria-hidden="true"
        >
          <circle cx="170" cy="20" r="71" strokeWidth="18" />
          <circle cx="168" cy="21" r="43" strokeWidth="2" />
          <path d="M95 150c40-34 66-52 108-57" strokeWidth="2" />
          <circle cx="159" cy="114" r="4" fill="currentColor" />
        </svg>

        <div className="relative z-10 space-y-3">
          {/* Card Top: Label & Eye Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-emerald-100/90">
                ยอดเงินคงเหลือ
              </span>
              <button
                onClick={() => setShowBalance(!showBalance)}
                className="text-emerald-200 hover:text-white transition-colors p-0.5"
                aria-label={showBalance ? "ซ่อนยอดเงิน" : "แสดงยอดเงิน"}
              >
                {showBalance ? (
                  <Eye className="w-3.5 h-3.5" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-emerald-100 backdrop-blur-xs font-medium flex items-center gap-1">
              <Users className="w-3 h-3" /> {memberCount} สมาชิก
            </span>
          </div>

          {/* Large Tabular Balance Figure */}
          <div>
            <div className="text-3xl font-extrabold tracking-tight tabular-nums text-white flex items-baseline gap-1.5">
              <span className="text-2xl font-bold opacity-90">฿</span>
              <span>
                {showBalance
                  ? Number(balance.totalBalance).toLocaleString("th-TH", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : "••••••"}
              </span>
            </div>
            <p className="text-[10px] text-emerald-200/80 mt-1 font-medium">
              {data?.balance ? `กองกลาง: ${group.name}` : "ยอดเงินตัวอย่างสำหรับภาพจำลอง"}
            </p>
          </div>

          {/* Target Progress Bar */}
          {balance.targetAmount > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-[11px] text-emerald-100">
                <span className="flex items-center gap-1 opacity-90">
                  <Target className="w-3 h-3 text-emerald-300" /> เป้าหมาย:{" "}
                  {formatCurrency(balance.targetAmount)}
                </span>
                <span className="font-bold text-white">
                  {balance.percentage.toFixed(1)}%
                </span>
              </div>
              <Progress
                value={balance.percentage}
                max={100}
                className="h-2 bg-emerald-950/60"
              />
              <div className="flex justify-between items-center text-[10px] text-emerald-200/90">
                <span>ขาดอีก {formatCurrency(balance.remainingAmount)}</span>
                <Link
                  href="/my-deposits"
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/15 hover:bg-white/25 text-white font-semibold text-[10px] backdrop-blur-xs transition-colors"
                >
                  ดูรายละเอียด <ArrowRight className="w-2.5 h-2.5" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Quick Action Buttons (SVG Design: ทำรายการ 4 ปุ่ม โอนเงิน, เติมเงิน, จ่ายบิล, ประวัติ) */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-text-primary tracking-tight">
            ทำรายการ
          </h3>
          <Link
            href="/my-deposits"
            className="text-[11px] font-bold text-brand hover:underline"
          >
            ทั้งหมด
          </Link>
        </div>

        <div className="grid grid-cols-4 gap-2.5">
          {/* Action 1: โอนเงิน (Transfer) */}
          <button
            onClick={() => setActiveModal("transfer")}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-surface border border-border shadow-xs hover:border-brand/40 active:scale-95 transition-all group"
          >
            <div className="w-10 h-10 rounded-full bg-brand-soft text-brand flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
              <Send className="w-4 h-4 stroke-[2.2]" />
            </div>
            <span className="text-[11px] font-bold text-text-primary">
              โอนเงิน
            </span>
          </button>

          {/* Action 2: เติมเงิน (Top up) */}
          <button
            onClick={() => setActiveModal("topup")}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-surface border border-border shadow-xs hover:border-brand/40 active:scale-95 transition-all group"
          >
            <div className="w-10 h-10 rounded-full bg-brand-soft text-brand flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
              <PlusCircle className="w-4 h-4 stroke-[2.2]" />
            </div>
            <span className="text-[11px] font-bold text-text-primary">
              เติมเงิน
            </span>
          </button>

          {/* Action 3: จ่ายบิล (Pay bill) */}
          <button
            onClick={() => setActiveModal("bill")}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-surface border border-border shadow-xs hover:border-brand/40 active:scale-95 transition-all group"
          >
            <div className="w-10 h-10 rounded-full bg-brand-soft text-brand flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
              <ReceiptText className="w-4 h-4 stroke-[2.2]" />
            </div>
            <span className="text-[11px] font-bold text-text-primary">
              จ่ายบิล
            </span>
          </button>

          {/* Action 4: ประวัติ (History) */}
          <Link
            href="/my-deposits"
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-surface border border-border shadow-xs hover:border-brand/40 active:scale-95 transition-all group"
          >
            <div className="w-10 h-10 rounded-full bg-brand-soft text-brand flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
              <History className="w-4 h-4 stroke-[2.2]" />
            </div>
            <span className="text-[11px] font-bold text-text-primary">
              ประวัติ
            </span>
          </Link>
        </div>
      </section>

      {/* 4. Recent Transactions Section (SVG Design: รายการล่าสุด การ์ดโค้งมนสีขาวแบ่งเส้นชัดเจน) */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-text-primary tracking-tight">
            รายการล่าสุด
          </h3>
          <Link
            href="/my-deposits"
            className="text-[11px] font-bold text-brand hover:underline"
          >
            ดูทั้งหมด
          </Link>
        </div>

        <div className="rounded-2xl bg-surface border border-border shadow-xs overflow-hidden divide-y divide-border">
          {recentDeposits.length > 0 ? (
            recentDeposits.slice(0, 3).map((dep) => (
              <div
                key={dep.id}
                className="p-3.5 flex items-center justify-between hover:bg-brand-soft/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-brand-soft text-brand flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4 stroke-[2.2]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-text-primary">
                      {dep.group_members?.profiles?.display_name || "สมาชิกกลุ่ม"}
                    </p>
                    <p className="text-[10px] text-text-secondary">
                      {formatThaiDate(dep.created_at)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-positive tabular-nums">
                    +{formatCurrency(dep.detected_amount)}
                  </span>
                  <p className="text-[9.5px] text-text-secondary">
                    {dep.bank_reference || "โอนสำเร็จ"}
                  </p>
                </div>
              </div>
            ))
          ) : (
            // Render realistic sample transactions matching SVG mockup
            sampleTransactions.map((tx) => {
              const Icon = tx.icon;
              return (
                <div
                  key={tx.id}
                  className="p-3.5 flex items-center justify-between hover:bg-brand-soft/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${tx.iconBg}`}
                    >
                      <Icon className="w-4 h-4 stroke-[2]" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-text-primary">
                        {tx.title}
                      </p>
                      <p className="text-[10px] text-text-secondary">
                        {tx.time}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-xs font-bold tabular-nums ${
                        tx.isPositive ? "text-positive" : "text-text-primary"
                      }`}
                    >
                      {tx.isPositive ? "+" : "−"}
                      {Math.abs(tx.amount).toFixed(2)} บาท
                    </span>
                  </div>
                </div>
              );
            })
          )}

          {/* Bottom footnote pill */}
          <div className="p-2.5 bg-brand-soft/30 text-center">
            <p className="text-[10px] font-medium text-text-secondary">
              ข้อมูลธุรกรรมทั้งหมดบันทึกในระบบความปลอดภัย Immutable Ledger
            </p>
          </div>
        </div>
      </section>

      {/* 5. Savings / Planning Banner (SVG Design: เริ่มวางแผนการเงิน ตั้งเป้าหมายเล็ก ๆ แล้วไปด้วยกัน) */}
      <Link href="/reports" className="block group">
        <div className="p-3.5 rounded-2xl bg-brand-soft/70 border border-brand/20 flex items-center justify-between shadow-xs group-hover:bg-brand-soft transition-all">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-brand/15 text-brand flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Sparkles className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <p className="text-xs font-extrabold text-brand-strong">
                เริ่มวางแผนการเงิน & AI Copilot
              </p>
              <p className="text-[10.5px] text-text-secondary">
                ตั้งเป้าหมายเล็ก ๆ แล้วไปด้วยกัน
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-brand group-hover:translate-x-0.5 transition-transform" />
        </div>
      </Link>

      {/* 6. Quick Action Modals for Transfer / Topup / Bill */}
      {activeModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-surface rounded-t-3xl sm:rounded-2xl w-full max-w-sm border border-border p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                {activeModal === "transfer" && <Send className="w-4 h-4 text-brand" />}
                {activeModal === "topup" && <PlusCircle className="w-4 h-4 text-brand" />}
                {activeModal === "bill" && <ReceiptText className="w-4 h-4 text-brand" />}
                <h3 className="text-sm font-bold text-text-primary">
                  {activeModal === "transfer" && "โอนเงินเข้ากองกลาง"}
                  {activeModal === "topup" && "เติมเงิน / ฝากเงิน"}
                  {activeModal === "bill" && "เบิกจ่าย / ชำระบิล"}
                </h3>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-brand-soft/40 text-text-secondary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-text-secondary">
              {activeModal === "transfer" && (
                <>
                  <p>
                    ท่านสามารถโอนเงินผ่าน Mobile Banking แล้วส่งรูปสลิปเข้ามาใน LINE Bot
                    ระบบ OCR และ AI จะตรวจจับยอดเงินและบันทึกลงกองกลางโดยอัตโนมัติ
                  </p>
                  <Link href="/review" onClick={() => setActiveModal(null)}>
                    <Button className="w-full bg-brand text-white hover:bg-brand-strong rounded-xl text-xs h-9 font-semibold mt-2">
                      ไปยังหน้าตรวจสลิปค้าง
                    </Button>
                  </Link>
                </>
              )}

              {activeModal === "topup" && (
                <>
                  <div className="p-3 rounded-xl bg-brand-soft/50 border border-brand/20 space-y-1 text-center">
                    <QrCode className="w-10 h-10 mx-auto text-brand mb-1" />
                    <p className="font-bold text-brand-strong">โอนผ่าน PromptPay หรือเลขบัญชีกองกลาง</p>
                    <p className="text-[11px]">สแกนหรือโอนแล้วส่งรูปสลิปในแชตกลุ่มเพื่อยืนยัน</p>
                  </div>
                  <Button
                    onClick={() => setActiveModal(null)}
                    className="w-full bg-brand text-white hover:bg-brand-strong rounded-xl text-xs h-9 font-semibold"
                  >
                    ปิดหน้าต่าง
                  </Button>
                </>
              )}

              {activeModal === "bill" && (
                <>
                  <p>
                    การเบิกเงินหรือจ่ายบิลออกจากกองกลางจะต้องผ่านกระบวนการเสนอและลงมติ
                    (Voting Quorum) จากสมาชิกในกลุ่มตามกฎที่ตั้งไว้
                  </p>
                  <Link href="/group-members" onClick={() => setActiveModal(null)}>
                    <Button className="w-full bg-brand text-white hover:bg-brand-strong rounded-xl text-xs h-9 font-semibold mt-2">
                      ดูรายชื่อสมาชิก & สิทธิ์การโหวต
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

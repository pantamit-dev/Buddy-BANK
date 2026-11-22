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
  Copy,
  Check,
  Download,
  ExternalLink,
  RefreshCw,
  Coins,
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
    settings?: any;
  } | null>(isCacheFresh ? cached.data : null);
  const [recentDeposits, setRecentDeposits] = useState<any[]>(
    isCacheFresh ? cached.recentDeposits : []
  );
  const [loading, setLoading] = useState(!isCacheFresh);
  const [showBalance, setShowBalance] = useState(true);
  const [activeModal, setActiveModal] = useState<"transfer" | "topup" | "bill" | null>(null);

  // Transfer & PromptPay Modal States
  const [transferAmount, setTransferAmount] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("amount");
      if (p && !isNaN(parseFloat(p))) return parseFloat(p);
    }
    if (cached?.data?.settings?.defaultQrAmount !== undefined && cached?.data?.settings?.defaultQrAmount !== null) {
      return Number(cached.data.settings.defaultQrAmount);
    }
    return 300;
  });
  const [customAmountInput, setCustomAmountInput] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("amount");
      if (p && !isNaN(parseFloat(p))) return p;
    }
    if (cached?.data?.settings?.defaultQrAmount !== undefined && cached?.data?.settings?.defaultQrAmount !== null) {
      const n = Number(cached.data.settings.defaultQrAmount);
      return n > 0 ? n.toString() : "";
    }
    return "300";
  });
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [qrLoading, setQrLoading] = useState<boolean>(false);
  const [promptPayTarget, setPromptPayTarget] = useState<string>("081-234-5678");
  const [bankAccountNo, setBankAccountNo] = useState<string>("123-4-56789-0");
  const [bankName, setBankName] = useState<string>("กสิกรไทย (KBANK)");
  const [accountName, setAccountName] = useState<string>("กองกลาง Bank Buddy");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);

  // Auto-open modal if URL has ?action=transfer
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("action") === "transfer") {
        setActiveModal("transfer");
        const amt = params.get("amount");
        if (amt && !isNaN(parseFloat(amt))) {
          const num = parseFloat(amt);
          setTransferAmount(num);
          setCustomAmountInput(num.toString());
        }
      }
    }
  }, []);

  // Fetch or update PromptPay QR code when transfer modal is active or amount changes (debounced)
  useEffect(() => {
    if (activeModal === "transfer") {
      let isSubscribed = true;
      setQrLoading(true);
      const timer = setTimeout(() => {
        fetch(
          `/api/promptpay/generate?groupId=${groupId || ""}&amount=${transferAmount || 0}`
        )
          .then((res) => res.json())
          .then((json) => {
            if (isSubscribed && json.success) {
              setQrDataUrl(json.qrDataUrl);
              if (json.target) setPromptPayTarget(json.target);
              if (json.bankAccountNo) setBankAccountNo(json.bankAccountNo);
              if (json.bankName) setBankName(json.bankName);
              if (json.accountName) setAccountName(json.accountName);
            }
          })
          .catch((err) => console.error("Failed to generate QR:", err))
          .finally(() => {
            if (isSubscribed) setQrLoading(false);
          });
      }, 250);

      return () => {
        isSubscribed = false;
        clearTimeout(timer);
      };
    }
  }, [activeModal, transferAmount, groupId]);

  const handleCopy = (text: string, field: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const handleDownloadQr = async () => {
    if (!qrDataUrl) return;

    setDownloadStatus("กำลังบันทึกภาพ...");
    const filename = `promptpay-${transferAmount ? `${transferAmount}thb` : "qr"}.png`;

    try {
      // 1. Fetch data URL as Blob
      const res = await fetch(qrDataUrl);
      const blob = await res.blob();
      const file = new File([blob], filename, { type: "image/png" });

      // 2. Web Share API: Best on iOS & Android devices - prompts native "Save Image" to Photos
      if (
        typeof navigator !== "undefined" &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: "PromptPay QR Code",
          text: `PromptPay QR โอนเงินกองกลาง ${transferAmount > 0 ? formatCurrency(transferAmount) : ""}`,
        });
        setDownloadStatus("บันทึกภาพสำเร็จ!");
        setTimeout(() => setDownloadStatus(null), 3000);
        return;
      }

      // 3. Blob Object URL download for desktop / compatible browsers
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);

      setDownloadStatus("ดาวน์โหลดภาพสำเร็จ!");
      setTimeout(() => setDownloadStatus(null), 3000);
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setDownloadStatus(null);
        return;
      }
      console.warn("Direct download fallback triggered:", err);

      // 4. Server Attachment Fallback
      const serverDownloadUrl = `/api/promptpay/generate?groupId=${groupId || ""}&amount=${transferAmount || 0}&format=png&download=1`;
      window.location.href = serverDownloadUrl;
      setDownloadStatus("กำลังดาวน์โหลดภาพ...");
      setTimeout(() => setDownloadStatus(null), 3000);
    }
  };

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

          if (fetchedData?.settings) {
            if (fetchedData.settings.promptpayId) setPromptPayTarget(fetchedData.settings.promptpayId);
            if (fetchedData.settings.bankAccountNo) setBankAccountNo(fetchedData.settings.bankAccountNo);
            if (fetchedData.settings.bankName) setBankName(fetchedData.settings.bankName);
            if (fetchedData.settings.accountName) setAccountName(fetchedData.settings.accountName);

            // Set default QR amount if not explicitly given in URL
            const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
            if (!urlParams?.get("amount") && fetchedData.settings.defaultQrAmount !== undefined && fetchedData.settings.defaultQrAmount !== null) {
              const defAmt = Number(fetchedData.settings.defaultQrAmount);
              setTransferAmount(defAmt);
              setCustomAmountInput(defAmt > 0 ? defAmt.toString() : "");
            }
          }
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-surface rounded-t-3xl sm:rounded-3xl w-full max-w-md border border-border p-5 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                {activeModal === "transfer" && <Send className="w-4 h-4 text-brand" />}
                {activeModal === "topup" && <PlusCircle className="w-4 h-4 text-brand" />}
                {activeModal === "bill" && <ReceiptText className="w-4 h-4 text-brand" />}
                <div>
                  <h3 className="text-sm font-bold text-text-primary">
                    {activeModal === "transfer" && "โอนเงินเข้ากองกลาง (PromptPay)"}
                    {activeModal === "topup" && "เติมเงิน / ฝากเงิน"}
                    {activeModal === "bill" && "เบิกจ่าย / ชำระบิล"}
                  </h3>
                  {activeModal === "transfer" && (
                    <p className="text-[10px] text-text-secondary">
                      สแกน QR Code หรือคัดลอกเลขบัญชีกองกลางเพื่อโอนเงิน
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-brand-soft/40 text-text-secondary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Download Status Toast Banner */}
            {downloadStatus && (
              <div className="p-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold flex items-center gap-2 shadow-xs animate-in slide-in-from-top duration-200">
                <Check className="w-4 h-4 shrink-0" />
                <span className="flex-1">{downloadStatus}</span>
              </div>
            )}

            <div className="space-y-4 text-xs text-text-secondary">
              {activeModal === "transfer" && (
                <>
                  {/* Amount Selector */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                        <Coins className="w-3.5 h-3.5 text-brand" />
                        กำหนดจำนวนเงินที่ต้องการโอน:
                      </span>
                      {transferAmount > 0 ? (
                        <span className="text-xs font-extrabold text-brand bg-brand-soft px-2.5 py-0.5 rounded-full border border-brand/20">
                          {formatCurrency(transferAmount)}
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                          ไม่ระบุยอด (สแกนใส่ยอดเอง)
                        </span>
                      )}
                    </div>

                    {/* Preset Amount Pills */}
                    <div className="grid grid-cols-5 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setTransferAmount(0);
                          setCustomAmountInput("");
                        }}
                        className={`py-1.5 px-1 rounded-xl text-[11px] font-bold transition-all border text-center ${
                          transferAmount === 0
                            ? "bg-brand text-white border-brand shadow-xs"
                            : "bg-surface hover:bg-brand-soft/40 border-border text-text-primary"
                        }`}
                      >
                        ไม่ระบุ
                      </button>
                      {[100, 300, 500, 1000].map((amt) => {
                        const isSelected = transferAmount === amt;
                        return (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => {
                              setTransferAmount(amt);
                              setCustomAmountInput(amt.toString());
                            }}
                            className={`py-1.5 px-1 rounded-xl text-[11px] font-bold transition-all border text-center ${
                              isSelected
                                ? "bg-brand text-white border-brand shadow-xs"
                                : "bg-surface hover:bg-brand-soft/40 border-border text-text-primary"
                            }`}
                          >
                            {amt.toLocaleString()} ฿
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Amount Input & Quick Adjust */}
                    <div className="space-y-1.5">
                      <div className="relative flex items-center">
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="any"
                          value={customAmountInput}
                          onChange={(e) => {
                            const valStr = e.target.value;
                            setCustomAmountInput(valStr);
                            const val = parseFloat(valStr);
                            if (!isNaN(val) && val >= 0) {
                              setTransferAmount(val);
                            } else if (valStr === "") {
                              setTransferAmount(0);
                            }
                          }}
                          placeholder="ใส่จำนวนเงินที่ต้องการโอน (เช่น 250 หรือ 0)"
                          className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-brand pr-14 font-medium"
                        />
                        <div className="absolute right-2.5 flex items-center gap-1.5">
                          {customAmountInput && (
                            <button
                              type="button"
                              onClick={() => {
                                setCustomAmountInput("");
                                setTransferAmount(0);
                              }}
                              className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] text-text-secondary hover:text-text-primary"
                              title="ล้าง"
                            >
                              ✕
                            </button>
                          )}
                          <span className="text-xs font-bold text-text-secondary pointer-events-none">
                            บาท
                          </span>
                        </div>
                      </div>

                      {/* Quick Adjust Buttons */}
                      <div className="flex items-center gap-1.5 justify-end">
                        <span className="text-[10px] text-text-secondary">เพิ่มด่วน:</span>
                        {[50, 100, 500].map((inc) => (
                          <button
                            key={inc}
                            type="button"
                            onClick={() => {
                              const newAmt = Math.max(0, (transferAmount || 0) + inc);
                              setTransferAmount(newAmt);
                              setCustomAmountInput(newAmt.toString());
                            }}
                            className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-surface border border-border hover:bg-brand-soft/40 text-text-secondary hover:text-brand transition-colors"
                          >
                            +{inc}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Dynamic PromptPay QR Code Display */}
                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-border text-center space-y-3 shadow-xs">
                    <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-brand-strong">
                      <QrCode className="w-4 h-4 text-brand" />
                      <span>
                        {transferAmount > 0
                          ? "PromptPay QR Code (ล็อกยอดเงินแล้ว)"
                          : "PromptPay QR Code (ไม่ระบุยอดเงิน)"}
                      </span>
                    </div>

                    <div className="relative w-52 h-52 mx-auto bg-white p-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-inner flex items-center justify-center">
                      {qrLoading ? (
                        <div className="flex flex-col items-center gap-2 text-text-secondary">
                          <RefreshCw className="w-6 h-6 animate-spin text-brand" />
                          <span className="text-[10px]">กำลังสร้าง QR Code...</span>
                        </div>
                      ) : qrDataUrl ? (
                        <img
                          src={qrDataUrl}
                          alt="PromptPay QR Code"
                          className="w-full h-full object-contain select-none"
                        />
                      ) : (
                        <span className="text-xs text-text-secondary">ไม่สามารถสร้าง QR ได้</span>
                      )}
                    </div>

                    <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-2.5 text-center">
                      <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        {transferAmount > 0
                          ? `ยอดเงินโอน: ${formatCurrency(transferAmount)} (ล็อกยอดใน QR แล้ว)`
                          : "QR แบบไม่ระบุยอดเงิน (สแกนแล้วใส่ยอดเองในแอปธนาคาร)"}
                      </p>
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {transferAmount > 0
                          ? "เมื่อเปิดสแกนในแอปธนาคาร ยอดเงินจะปรากฏขึ้นอัตโนมัติ"
                          : "เมื่อเปิดสแกนในแอปธนาคาร สามารถระบุจำนวนเงินที่ต้องการโอนได้อิสระ"}
                      </p>
                    </div>

                    <p className="text-[10px] text-text-secondary leading-tight text-center">
                      💡 <strong>บนมือถือ:</strong> สามารถแตะค้างที่รูปภาพ QR Code ด้านบน เพื่อ <strong>&quot;บันทึกภาพลงเครื่อง&quot;</strong> หรือกดปุ่มด้านล่าง
                    </p>

                    <div className="pt-1">
                      {/* Unified Reliable Download QR Button */}
                      <a
                        href={`/api/promptpay/generate?groupId=${groupId || ""}&amount=${transferAmount || 0}&format=png&download=1`}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={`promptpay-${transferAmount ? `${transferAmount}thb` : "open"}.png`}
                        className="w-full py-2.5 px-3 rounded-xl bg-brand text-white hover:bg-brand-strong text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        <span>ดาวน์โหลดภาพ QR Code</span>
                      </a>
                    </div>
                  </div>

                  {/* Group Account Details Card */}
                  <div className="p-3.5 rounded-2xl bg-brand-soft/40 border border-border space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-bold text-text-primary pb-1 border-b border-border/50">
                      <span>ข้อมูลบัญชีกองกลาง</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-text-secondary font-normal">
                          {accountName}
                        </span>
                        <Link
                          href={`/settings?groupId=${groupId || ""}`}
                          onClick={() => setActiveModal(null)}
                          className="text-[10px] text-brand hover:underline font-semibold flex items-center gap-0.5"
                        >
                          ตั้งค่า
                          <ExternalLink className="w-2.5 h-2.5" />
                        </Link>
                      </div>
                    </div>

                    <div className="space-y-2 text-[11px]">
                      {/* PromptPay Row */}
                      <div className="flex items-center justify-between">
                        <span className="text-text-secondary">พร้อมเพย์:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-text-primary">
                            {promptPayTarget}
                          </span>
                          <button
                            onClick={() => handleCopy(promptPayTarget, "promptpay")}
                            className="p-1 rounded hover:bg-brand-soft text-text-secondary hover:text-brand transition-colors"
                            title="คัดลอกเบอร์พร้อมเพย์"
                          >
                            {copiedField === "promptpay" ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Bank Account Row */}
                      <div className="flex items-center justify-between">
                        <span className="text-text-secondary">{bankName}:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-text-primary">
                            {bankAccountNo}
                          </span>
                          <button
                            onClick={() => handleCopy(bankAccountNo, "bankAccount")}
                            className="p-1 rounded hover:bg-brand-soft text-text-secondary hover:text-brand transition-colors"
                            title="คัดลอกเลขบัญชี"
                          >
                            {copiedField === "bankAccount" ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Instruction Footer */}
                  <div className="p-3 rounded-xl bg-surface border border-border space-y-1">
                    <p className="font-bold text-text-primary text-[10.5px]">
                      ขั้นตอนหลังจากโอนเงิน:
                    </p>
                    <p className="text-[10px] text-text-secondary leading-relaxed">
                      1. ถ่ายรูปหรือบันทึกภาพสลิปจากแอปธนาคาร<br />
                      2. ส่งรูปสลิปลงในแชทกลุ่ม LINE นี้<br />
                      3. ระบบ OCR จะอ่านยอดเงินและบันทึกเข้ากองกลางโดยอัตโนมัติ
                    </p>
                  </div>

                  <Link href="/review" onClick={() => setActiveModal(null)}>
                    <Button className="w-full bg-brand text-white hover:bg-brand-strong rounded-xl text-xs h-9 font-semibold">
                      ไปยังหน้าตรวจสลิปค้าง
                    </Button>
                  </Link>
                </>
              )}

              {activeModal === "topup" && (
                <>
                  <div className="p-4 rounded-xl bg-brand-soft/50 border border-brand/20 space-y-2 text-center">
                    <QrCode className="w-10 h-10 mx-auto text-brand mb-1" />
                    <p className="font-bold text-brand-strong">โอนผ่าน PromptPay หรือเลขบัญชีกองกลาง</p>
                    <p className="text-[11px]">
                      สแกน QR หรือโอนผ่านเลขบัญชีของกลุ่ม แล้วส่งรูปสลิปในแชตกลุ่มเพื่อยืนยัน
                    </p>
                  </div>
                  <Button
                    onClick={() => setActiveModal("transfer")}
                    className="w-full bg-brand text-white hover:bg-brand-strong rounded-xl text-xs h-9 font-semibold"
                  >
                    เปิดหน้าสแกน QR & บัญชี
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

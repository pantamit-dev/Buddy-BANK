"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useLiff } from "@/shared/context/liff-context";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { formatCurrency, formatThaiDate, cn } from "@/lib/utils";
import { invalidateOverviewCache } from "@/shared/lib/overview-cache";
import {
  Vote,
  Plus,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  X,
  Wallet,
  Settings,
  AlertTriangle,
} from "lucide-react";

type FilterTab = "pending_vote" | "approved" | "closed" | "all";

interface WithdrawalVote {
  id: string;
  member_id: string;
  vote_choice: "approve" | "reject";
  voted_at: string;
  group_members?: {
    id: string;
    profiles?: {
      line_user_id?: string;
      display_name?: string;
      picture_url?: string;
    };
  };
}

interface WithdrawalItem {
  id: string;
  group_id: string;
  requested_by: string;
  amount: number;
  purpose: string;
  status: "pending_vote" | "approved" | "rejected" | "cancelled" | "paid";
  expires_at: string;
  created_at: string;
  approveVotes: number;
  rejectVotes: number;
  requiredApprovals: number;
  totalMembers: number;
  votes: WithdrawalVote[];
  group_members?: {
    id: string;
    role: string;
    profiles?: {
      line_user_id?: string;
      display_name?: string;
      picture_url?: string;
    };
  };
}

export default function WithdrawalsPage() {
  const { profile, groupId, userRole } = useLiff();
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([]);
  const [quorumConfig, setQuorumConfig] = useState({
    quorumPercent: 50,
    durationHours: 48,
    totalActiveMembers: 1,
    requiredApprovals: 1,
  });
  const [currentBalance, setCurrentBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("pending_vote");
  const [busyId, setBusyId] = useState<string | null>(null);

  // Create form modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const [purposeInput, setPurposeInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const loadWithdrawals = useCallback(async () => {
    if (!groupId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/withdrawals?groupId=${groupId}&limit=50`);
      if (res.ok) {
        const json = await res.json();
        setWithdrawals(json.withdrawals || []);
        if (json.quorumConfig) setQuorumConfig(json.quorumConfig);
        if (typeof json.currentBalance === "number") {
          setCurrentBalance(json.currentBalance);
        }
      }
    } catch (e) {
      console.error("Failed to load withdrawals:", e);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    if (groupId) {
      loadWithdrawals();
    }
  }, [groupId, loadWithdrawals]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleCreateWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const parsedAmount = parseFloat(amountInput);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError("กรุณาระบุจำนวนเงินที่ต้องการเบิกให้ถูกต้อง");
      return;
    }
    if (parsedAmount > currentBalance) {
      setFormError(
        `ยอดเงินกองกลางคงเหลือ ${formatCurrency(currentBalance)} ไม่เพียงพอสำหรับคำขอนี้`
      );
      return;
    }
    if (!purposeInput.trim()) {
      setFormError("กรุณาระบุวัตถุประสงค์การเบิกเงิน");
      return;
    }
    if (!profile?.userId) {
      setFormError("กรุณายืนยันตัวตนโปรไฟล์ LINE ก่อนเสนอเบิกเงิน");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          requesterLineUserId: profile.userId,
          amount: parsedAmount,
          purpose: purposeInput.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFormError(json.error || "ไม่สามารถสร้างคำขอเบิกเงินได้");
        return;
      }

      setAmountInput("");
      setPurposeInput("");
      setShowCreateModal(false);
      setFilter("pending_vote");
      invalidateOverviewCache(groupId);
      await loadWithdrawals();
      showToast(
        json.lineNotified
          ? "สร้างคำขอเบิกเงินและส่งการ์ดโหวตเข้ากลุ่ม LINE แล้ว!"
          : "สร้างคำขอเบิกเงินและเปิดโหวตเรียบร้อยแล้ว!"
      );
    } catch (err: any) {
      setFormError(err?.message || "เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (withdrawalId: string, choice: "approve" | "reject") => {
    if (!profile?.userId) {
      alert("กรุณายืนยันโปรไฟล์ LINE ก่อนลงคะแนน");
      return;
    }

    try {
      setBusyId(withdrawalId);
      const res = await fetch("/api/withdrawals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "vote",
          withdrawalId,
          voterLineUserId: profile.userId,
          choice,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "ลงคะแนนไม่สำเร็จ");
        return;
      }

      invalidateOverviewCache(groupId);
      await loadWithdrawals();

      const status = json.voteResult?.status;
      if (status === "approved") {
        showToast("มติผ่านเกณฑ์! อนุมัติการเบิกเงินและหักยอดกองกลางแล้ว");
      } else if (status === "rejected") {
        showToast("คำขอเบิกเงินไม่ผ่านเกณฑ์เสียงเห็นชอบ");
      } else {
        showToast(
          choice === "approve" ? "บันทึกเสียง 'เห็นชอบ' แล้ว" : "บันทึกเสียง 'คัดค้าน' แล้ว"
        );
      }
    } catch (e: any) {
      alert("เกิดข้อผิดพลาด: " + String(e?.message || e));
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (withdrawalId: string) => {
    if (!profile?.userId) return;
    if (!confirm("ต้องการยกเลิกคำขอเบิกเงินนี้ใช่หรือไม่?")) return;

    try {
      setBusyId(withdrawalId);
      const res = await fetch("/api/withdrawals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel",
          withdrawalId,
          actorLineUserId: profile.userId,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "ไม่สามารถยกเลิกคำขอได้");
        return;
      }
      await loadWithdrawals();
      showToast("ยกเลิกคำขอเบิกเงินเรียบร้อยแล้ว");
    } catch (e: any) {
      alert("เกิดข้อผิดพลาด: " + String(e?.message || e));
    } finally {
      setBusyId(null);
    }
  };

  const pendingCount = withdrawals.filter((w) => w.status === "pending_vote").length;

  const filteredList = withdrawals.filter((w) => {
    if (filter === "pending_vote") return w.status === "pending_vote";
    if (filter === "approved") return w.status === "approved" || w.status === "paid";
    if (filter === "closed") return w.status === "rejected" || w.status === "cancelled";
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-1">
        <div>
          <h2 className="text-base font-extrabold text-text-primary tracking-tight flex items-center gap-2">
            <Vote className="w-5 h-5 text-brand" />
            เบิกจ่าย &amp; ลงมติกลุ่ม
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            เสนอเบิกเงินกองกลางและโหวตลงมติสมาชิกแบบโปร่งใส
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={loadWithdrawals}
            disabled={loading}
            className="text-xs h-8 px-2.5 rounded-xl border-border hover:bg-brand-soft/40 text-text-secondary"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setFormError(null);
              setShowCreateModal(true);
            }}
            className="text-xs h-8 px-3 rounded-xl bg-brand hover:bg-brand-strong text-white font-bold gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            เสนอเบิกเงิน
          </Button>
        </div>
      </div>

      {/* Toast Message */}
      {toastMsg && (
        <div className="p-3 rounded-xl bg-brand-soft border border-brand/25 text-xs font-semibold text-brand-strong flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-brand shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Pool Balance & Quorum Rule Banner */}
      <Card className="bg-surface border-border shadow-xs rounded-2xl">
        <CardContent className="p-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-soft flex items-center justify-center text-brand shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] text-text-secondary">ยอดกองกลางพร้อมเบิก</p>
              <p className="text-sm font-extrabold text-text-primary tabular-nums">
                {formatCurrency(currentBalance)}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold text-brand-strong">
              เกณฑ์ผ่าน: {quorumConfig.requiredApprovals}/{quorumConfig.totalActiveMembers} เสียง ({quorumConfig.quorumPercent}%)
            </p>
            <Link
              href="/settings"
              className="text-[10px] text-text-secondary hover:text-brand inline-flex items-center gap-1 mt-0.5"
            >
              <Settings className="w-2.5 h-2.5" />
              โหวตภายใน {quorumConfig.durationHours} ชม.
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Filter Tabs */}
      <div className="grid grid-cols-4 gap-1.5 bg-surface p-1 rounded-xl border border-border">
        {(
          [
            { key: "pending_vote", label: `รอโหวต (${pendingCount})` },
            { key: "approved", label: "อนุมัติ" },
            { key: "closed", label: "ไม่ผ่าน" },
            { key: "all", label: "ทั้งหมด" },
          ] as { key: FilterTab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              "py-1.5 px-2 rounded-lg text-[11px] font-bold transition-colors",
              filter === tab.key
                ? "bg-brand text-white shadow-xs"
                : "text-text-secondary hover:text-text-primary hover:bg-brand-soft/40"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Withdrawal List */}
      {loading ? (
        <div className="p-12 text-center text-xs text-text-secondary">
          กำลังโหลดรายการคำขอเบิกเงิน...
        </div>
      ) : filteredList.length === 0 ? (
        <Card className="p-8 text-center bg-surface border-border shadow-xs rounded-2xl">
          <Vote className="w-10 h-10 mx-auto text-brand mb-2 opacity-75" />
          <h3 className="text-sm font-extrabold text-text-primary">
            ยังไม่มีรายการในหมวดนี้
          </h3>
          <p className="text-xs text-text-secondary mt-1 mb-3">
            สมาชิกสามารถกด &ldquo;เสนอเบิกเงิน&rdquo; หรือพิมพ์ #เบิก ในกลุ่ม LINE เพื่อเปิดโหวตได้
          </p>
          <Button
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="bg-brand hover:bg-brand-strong text-white text-xs rounded-xl h-8 font-bold"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            สร้างคำขอเบิกเงินแรก
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredList.map((item) => {
            const requesterName =
              item.group_members?.profiles?.display_name || "สมาชิก";
            const requesterLineId = item.group_members?.profiles?.line_user_id;
            const myVote = item.votes.find(
              (v) => v.group_members?.profiles?.line_user_id === profile?.userId
            );
            const progressPct = Math.min(
              100,
              Math.round((item.approveVotes / Math.max(1, item.requiredApprovals)) * 100)
            );
            const isBusy = busyId === item.id;
            const canCancel =
              item.status === "pending_vote" &&
              (requesterLineId === profile?.userId ||
                userRole === "owner" ||
                userRole === "treasurer");

            return (
              <Card
                key={item.id}
                className="overflow-hidden border-border bg-surface shadow-xs rounded-2xl"
              >
                <CardHeader className="p-3.5 bg-brand-soft/25 border-b border-border flex flex-row items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-text-primary truncate">
                      {requesterName}
                    </span>
                    {item.status === "pending_vote" && (
                      <Badge className="text-[10px] bg-amber-500/15 text-warning border border-amber-500/25 font-bold shrink-0">
                        รอผลโหวต
                      </Badge>
                    )}
                    {(item.status === "approved" || item.status === "paid") && (
                      <Badge className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 font-bold shrink-0">
                        อนุมัติแล้ว
                      </Badge>
                    )}
                    {item.status === "rejected" && (
                      <Badge className="text-[10px] bg-red-500/15 text-red-600 border border-red-500/25 font-bold shrink-0">
                        ไม่ผ่านมติ
                      </Badge>
                    )}
                    {item.status === "cancelled" && (
                      <Badge className="text-[10px] bg-slate-500/15 text-slate-600 border border-slate-500/25 font-bold shrink-0">
                        ยกเลิกแล้ว
                      </Badge>
                    )}
                  </div>
                  <span className="text-[10px] text-text-secondary shrink-0">
                    {formatThaiDate(item.created_at)}
                  </span>
                </CardHeader>

                <CardContent className="p-3.5 space-y-3">
                  {/* Amount & Purpose */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-[11px] text-text-secondary">วัตถุประสงค์</p>
                      <p className="text-sm font-bold text-text-primary break-words">
                        {item.purpose}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] text-text-secondary">จำนวนเงิน</p>
                      <p className="text-base font-extrabold text-brand tabular-nums">
                        {formatCurrency(Number(item.amount))}
                      </p>
                    </div>
                  </div>

                  {/* Voting Progress */}
                  <div className="p-2.5 rounded-xl bg-page border border-border space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        เห็นชอบ {item.approveVotes}/{item.requiredApprovals} เสียง
                      </span>
                      <span className="font-semibold text-red-600 dark:text-red-400">
                        คัดค้าน {item.rejectVotes} เสียง
                      </span>
                    </div>
                    <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          item.status === "rejected" ? "bg-red-500" : "bg-brand"
                        )}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-text-secondary">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        ปิดโหวต: {formatThaiDate(item.expires_at)}
                      </span>
                      <span>สมาชิกทั้งหมด {item.totalMembers} คน</span>
                    </div>
                  </div>

                  {/* Voter Chips */}
                  {item.votes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {item.votes.map((v) => {
                        const voterName =
                          v.group_members?.profiles?.display_name || "สมาชิก";
                        const isApprove = v.vote_choice === "approve";
                        return (
                          <span
                            key={v.id}
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                              isApprove
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                                : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                            )}
                          >
                            {isApprove ? (
                              <CheckCircle2 className="w-2.5 h-2.5" />
                            ) : (
                              <XCircle className="w-2.5 h-2.5" />
                            )}
                            {voterName}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Voting & Cancel Actions */}
                  {item.status === "pending_vote" && (
                    <div className="space-y-2 pt-1">
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          size="sm"
                          disabled={isBusy}
                          onClick={() => handleVote(item.id, "approve")}
                          variant={myVote?.vote_choice === "approve" ? "default" : "outline"}
                          className={cn(
                            "text-xs h-9 rounded-xl font-bold",
                            myVote?.vote_choice === "approve"
                              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                              : "border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                          )}
                        >
                          <ThumbsUp className="w-3.5 h-3.5 mr-1.5" />
                          {myVote?.vote_choice === "approve" ? "เห็นชอบแล้ว" : "เห็นชอบ"}
                        </Button>
                        <Button
                          size="sm"
                          disabled={isBusy}
                          onClick={() => handleVote(item.id, "reject")}
                          variant={myVote?.vote_choice === "reject" ? "default" : "outline"}
                          className={cn(
                            "text-xs h-9 rounded-xl font-bold",
                            myVote?.vote_choice === "reject"
                              ? "bg-red-600 hover:bg-red-700 text-white"
                              : "border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10"
                          )}
                        >
                          <ThumbsDown className="w-3.5 h-3.5 mr-1.5" />
                          {myVote?.vote_choice === "reject" ? "คัดค้านแล้ว" : "คัดค้าน"}
                        </Button>
                      </div>
                      {canCancel && (
                        <button
                          disabled={isBusy}
                          onClick={() => handleCancel(item.id)}
                          className="w-full py-1.5 text-[11px] font-semibold text-text-secondary hover:text-red-600 flex items-center justify-center gap-1 transition-colors"
                        >
                          <Ban className="w-3 h-3" />
                          ยกเลิกคำขอเบิกเงินนี้
                        </button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Withdrawal Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-surface rounded-t-3xl sm:rounded-3xl w-full max-w-md border border-border p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Vote className="w-4 h-4 text-brand" />
                <div>
                  <h3 className="text-sm font-bold text-text-primary">
                    เสนอเบิกเงิน / จ่ายบิลกองกลาง
                  </h3>
                  <p className="text-[10px] text-text-secondary">
                    ระบบจะส่งการ์ดลงมติเข้ากลุ่ม LINE และบันทึกยอดเมื่อเสียงครบ
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-brand-soft/40 text-text-secondary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateWithdrawal} className="space-y-3.5">
              <div className="p-2.5 rounded-xl bg-brand-soft/40 border border-brand/20 flex items-center justify-between text-xs">
                <span className="text-text-secondary">ยอดเงินคงเหลือกองกลาง</span>
                <span className="font-extrabold text-brand-strong tabular-nums">
                  {formatCurrency(currentBalance)}
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-text-primary">
                  จำนวนเงินที่ขอเบิก (บาท)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="1"
                  placeholder="เช่น 1500"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className="rounded-xl border-border bg-surface text-text-primary font-bold tabular-nums"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-text-primary">
                  วัตถุประสงค์ / รายการค่าใช้จ่าย
                </label>
                <Input
                  type="text"
                  placeholder="เช่น ค่ามัดจำที่พัก, ค่าอาหารมื้อเย็น"
                  value={purposeInput}
                  onChange={(e) => setPurposeInput(e.target.value)}
                  className="rounded-xl border-border bg-surface text-text-primary"
                  maxLength={500}
                  required
                />
              </div>

              {formError && (
                <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 flex items-start gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="p-2.5 rounded-xl bg-page border border-border text-[11px] text-text-secondary">
                ต้องได้เสียงเห็นชอบอย่างน้อย{" "}
                <strong className="text-text-primary">
                  {quorumConfig.requiredApprovals}/{quorumConfig.totalActiveMembers} คน
                </strong>{" "}
                ({quorumConfig.quorumPercent}%) ภายใน {quorumConfig.durationHours} ชม.
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 rounded-xl text-xs h-10"
                >
                  ยกเลิก
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-brand hover:bg-brand-strong text-white rounded-xl text-xs h-10 font-bold"
                >
                  {submitting ? "กำลังส่งคำขอ..." : "เปิดโหวตเบิกเงิน"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

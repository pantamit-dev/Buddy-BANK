"use client";

import React, { useEffect, useState } from "react";
import { useLiff } from "@/shared/context/liff-context";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { formatCurrency, formatThaiDate } from "@/lib/utils";
import {
  CheckSquare,
  Check,
  X,
  ExternalLink,
  Receipt,
  RotateCcw,
} from "lucide-react";
import { invalidateOverviewCache } from "@/shared/lib/overview-cache";

export default function ReviewPage() {
  const { profile, groupId } = useLiff();
  const [pendingDeposits, setPendingDeposits] = useState<any[]>([]);
  const [adjustedAmounts, setAdjustedAmounts] = useState<{ [id: string]: string }>({});
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchPending = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/deposits?groupId=${groupId}&status=pending&limit=30`
      );
      if (res.ok) {
        const json = await res.json();
        setPendingDeposits(json.deposits || []);
      }
    } catch (e) {
      console.error("Failed to load pending deposits:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (groupId) {
      fetchPending();
    }
  }, [groupId]);

  const handleReviewAction = async (depositId: string, action: "approve" | "reject") => {
    try {
      setProcessingId(depositId);
      const customAmount = adjustedAmounts[depositId];
      const payload: any = {
        depositId,
        action,
        reviewerLineUserId: profile?.userId || "U_OWNER_001",
      };

      if (customAmount && !isNaN(Number(customAmount)) && Number(customAmount) > 0) {
        payload.customAmount = Number(customAmount);
      }

      const res = await fetch("/api/deposits", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        invalidateOverviewCache(groupId);
        setPendingDeposits((prev) => prev.filter((d) => d.id !== depositId));
      } else {
        const err = await res.json();
        alert(err.error || "ดำเนินการไม่สำเร็จ");
      }
    } catch (e) {
      alert("เกิดข้อผิดพลาดในการตรวจสอบ: " + String(e));
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-1">
        <div>
          <h2 className="text-base font-extrabold text-text-primary tracking-tight flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-brand" />
            กิจกรรมตรวจสลิป
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            ยืนยันความถูกต้องของสลิปเพื่อบันทึกลงบัญชีแยกประเภท
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchPending}
          className="text-xs h-8 px-2.5 rounded-xl border-border hover:bg-brand-soft/40 text-text-secondary"
          disabled={loading}
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1" />
          รีเฟรช
        </Button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-text-secondary">
          กำลังค้นหารายการสลิปที่รอตรวจสอบ...
        </div>
      ) : pendingDeposits.length === 0 ? (
        <Card className="p-8 text-center bg-surface border-border shadow-xs rounded-2xl">
          <Receipt className="w-10 h-10 mx-auto text-brand mb-2 opacity-80" />
          <h3 className="text-sm font-extrabold text-text-primary">
            ไม่มีสลิปรอตรวจสอบ 🎉
          </h3>
          <p className="text-xs text-text-secondary mt-1">
            สลิปทั้งหมดได้รับการอนุมัติและบันทึกลงบัญชีเรียบร้อยแล้ว
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {pendingDeposits.map((dep) => {
            const memberProfile = dep.group_members?.profiles || {};
            const isBusy = processingId === dep.id;

            return (
              <Card
                key={dep.id}
                className="overflow-hidden border-border bg-surface shadow-xs rounded-2xl"
              >
                <CardHeader className="p-3.5 bg-brand-soft/30 border-b border-border flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-text-primary">
                      {memberProfile.display_name || "สมาชิก"}
                    </span>
                    <Badge className="text-[10px] bg-amber-500/15 text-warning border border-amber-500/25 font-bold">
                      รอยืนยัน
                    </Badge>
                  </div>
                  <span className="text-[10px] text-text-secondary">
                    {formatThaiDate(dep.created_at)}
                  </span>
                </CardHeader>
                <CardContent className="p-3.5 space-y-3">
                  {/* Slip Preview Thumbnail & OCR details */}
                  <div className="flex gap-3">
                    {dep.signedUrl ? (
                      <a
                        href={dep.signedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="relative block w-20 h-24 bg-page rounded-xl border border-border overflow-hidden shrink-0 group"
                      >
                        <img
                          src={dep.signedUrl}
                          alt="สลิปโอนเงิน"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <ExternalLink className="w-4 h-4 text-white" />
                        </div>
                      </a>
                    ) : (
                      <div className="w-20 h-24 bg-page rounded-xl border border-border flex flex-col items-center justify-center text-text-secondary shrink-0">
                        <Receipt className="w-6 h-6 mb-1 text-text-secondary/60" />
                        <span className="text-[9px]">ไม่มีรูปภาพ</span>
                      </div>
                    )}

                    <div className="flex-1 space-y-1.5 text-xs">
                      <div>
                        <span className="text-text-secondary text-[10px]">
                          ยอดที่ตรวจพบ:
                        </span>
                        <p className="font-extrabold text-brand text-sm tabular-nums">
                          {formatCurrency(dep.detected_amount)}
                        </p>
                      </div>
                      <div>
                        <span className="text-text-secondary text-[10px]">
                          รหัสอ้างอิง:
                        </span>
                        <p className="font-mono text-[10px] text-text-primary">
                          {dep.bank_reference || "ไม่พบรหัส"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Manual adjustment input */}
                  <div className="space-y-1 pt-1 border-t border-border">
                    <label className="text-[10px] text-text-secondary font-medium">
                      แก้ไขยอดเงินก่อนบันทึก (หาก OCR อ่านคลาดเคลื่อน):
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder={`ค่าเริ่มต้น: ${dep.detected_amount || "0"}`}
                      value={adjustedAmounts[dep.id] || ""}
                      onChange={(e) =>
                        setAdjustedAmounts((prev) => ({
                          ...prev,
                          [dep.id]: e.target.value,
                        }))
                      }
                      className="h-8 text-xs font-mono rounded-xl border-border bg-page text-text-primary"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button
                      variant="default"
                      size="sm"
                      className="bg-brand hover:bg-brand-strong text-white text-xs h-9 rounded-xl font-bold gap-1 shadow-xs"
                      disabled={isBusy}
                      onClick={() => handleReviewAction(dep.id, "approve")}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      {isBusy ? "กำลังบันทึก..." : "อนุมัติบันทึก"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-negative border-rose-500/30 hover:bg-rose-500/10 text-xs h-9 rounded-xl font-bold gap-1"
                      disabled={isBusy}
                      onClick={() => handleReviewAction(dep.id, "reject")}
                    >
                      <X className="w-3.5 h-3.5 stroke-[2.5]" />
                      {isBusy ? "กำลังยกเลิก..." : "ปฏิเสธสลิป"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

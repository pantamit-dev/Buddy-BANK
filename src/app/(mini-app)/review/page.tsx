"use client";

import React, { useEffect, useState } from "react";
import { useLiff } from "@/shared/context/liff-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
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
  AlertCircle,
} from "lucide-react";

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
        payload.adjustedAmount = Number(customAmount);
      }

      const res = await fetch("/api/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await fetchPending();
      } else {
        const err = await res.json();
        alert(err.error || "เกิดข้อผิดพลาดในการตรวจสอบสลิป");
      }
    } catch (e) {
      alert("ไม่สามารถดำเนินการได้: " + String(e));
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
            <CheckSquare className="w-5 h-5 text-emerald-600" /> ตรวจสอบสลิปโอนเงิน
          </h2>
          <p className="text-xs text-slate-500">
            รายการที่รอตรวจสอบ ({pendingDeposits.length} รายการ)
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-8"
          onClick={fetchPending}
          disabled={loading}
        >
          รีเฟรช
        </Button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">
          กำลังค้นหารายการสลิปที่รอตรวจสอบ...
        </div>
      ) : pendingDeposits.length === 0 ? (
        <Card className="p-8 text-center bg-white border-slate-200">
          <Receipt className="w-10 h-10 mx-auto text-emerald-500 mb-2 opacity-80" />
          <h3 className="text-sm font-bold text-slate-900">ไม่มีสลิปรอตรวจสอบ 🎉</h3>
          <p className="text-xs text-slate-400 mt-1">
            สลิปทั้งหมดได้รับการอนุมัติและบันทึกลงบัญชีเรียบร้อยแล้ว
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {pendingDeposits.map((dep) => {
            const memberProfile = dep.group_members?.profiles || {};
            const isBusy = processingId === dep.id;

            return (
              <Card key={dep.id} className="overflow-hidden border-slate-200 shadow-sm">
                <CardHeader className="p-3.5 bg-slate-50 border-b border-slate-100 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      {memberProfile.display_name || "สมาชิก"}
                    </span>
                    <Badge variant="warning" className="text-[10px]">
                      รออนุมัติ
                    </Badge>
                  </div>
                  <span className="text-[10px] text-slate-400">
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
                        className="relative block w-20 h-24 bg-slate-100 rounded border border-slate-200 overflow-hidden shrink-0 group"
                      >
                        <img
                          src={dep.signedUrl}
                          alt="สลิปโอนเงิน"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <ExternalLink className="w-4 h-4 text-white" />
                        </div>
                      </a>
                    ) : (
                      <div className="w-20 h-24 bg-slate-100 rounded border border-slate-200 flex flex-col items-center justify-center text-slate-400 shrink-0">
                        <Receipt className="w-6 h-6 mb-1" />
                        <span className="text-[9px]">ไม่มีรูปภาพ</span>
                      </div>
                    )}

                    <div className="flex-1 space-y-1 text-xs">
                      <div>
                        <span className="text-slate-400 text-[10px]">ยอดที่ OCR ตรวจพบ:</span>
                        <p className="font-bold text-emerald-600 text-sm">
                          {formatCurrency(dep.detected_amount)}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px]">รหัสอ้างอิง:</span>
                        <p className="font-mono text-[10px] text-slate-700">
                          {dep.bank_reference || "ไม่พบรหัส"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Manual adjustment input */}
                  <div className="space-y-1 pt-1 border-t border-slate-100">
                    <label className="text-[10px] text-slate-500 font-medium">
                      แก้ไขยอดเงินก่อนอนุมัติ (หาก OCR อ่านผิดพลาด):
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
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button
                      variant="default"
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-xs h-8 gap-1"
                      disabled={isBusy}
                      onClick={() => handleReviewAction(dep.id, "approve")}
                    >
                      <Check className="w-3.5 h-3.5" />
                      {isBusy ? "กำลังบันทึก..." : "อนุมัติ"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-rose-600 border-rose-200 hover:bg-rose-50 text-xs h-8 gap-1"
                      disabled={isBusy}
                      onClick={() => handleReviewAction(dep.id, "reject")}
                    >
                      <X className="w-3.5 h-3.5" />
                      {isBusy ? "กำลังบันทึก..." : "ปฏิเสธ"}
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

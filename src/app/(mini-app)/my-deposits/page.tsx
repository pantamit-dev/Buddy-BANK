"use client";

import React, { useEffect, useState } from "react";
import { useLiff } from "@/shared/context/liff-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { formatCurrency, formatThaiDate } from "@/lib/utils";
import { Wallet, CheckCircle, Clock, AlertCircle, XCircle, UserCheck } from "lucide-react";
import { ProfileRegisterDialog } from "@/shared/components/profile-register-dialog";

export default function MyDepositsPage() {
  const { profile, groupId, isRegistered } = useLiff();
  const [deposits, setDeposits] = useState<any[]>([]);
  const [personalSummary, setPersonalSummary] = useState({
    total: 0,
    count: 0,
  });
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    async function loadMyDeposits() {
      try {
        setLoading(true);
        // Query deposits
        const res = await fetch(`/api/deposits?groupId=${groupId}&limit=50`);
        if (res.ok) {
          const json = await res.json();
          const allDeps: any[] = json.deposits || [];

          // Filter for current user's profile if available
          const myDeps = profile?.userId
            ? allDeps.filter(
                (d) =>
                  d.group_members?.profiles?.line_user_id === profile.userId ||
                  d.group_members?.profiles?.id === profile.userId
              )
            : allDeps;

          const activeList = myDeps.length > 0 ? myDeps : allDeps;
          setDeposits(activeList);

          const verifiedSum = activeList
            .filter((d) => d.status === "verified")
            .reduce((sum, d) => sum + Number(d.detected_amount || 0), 0);

          setPersonalSummary({
            total: verifiedSum,
            count: activeList.length,
          });
        }
      } catch (e) {
        console.error("Failed to load personal deposits:", e);
      } finally {
        setLoading(false);
      }
    }

    if (groupId) {
      loadMyDeposits();
    }
  }, [groupId, profile?.userId]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified":
        return (
          <Badge className="text-[10px] bg-brand-soft text-brand border border-brand/20 font-bold">
            <CheckCircle className="w-3 h-3 mr-1 text-brand" /> ยืนยันแล้ว
          </Badge>
        );
      case "pending":
        return (
          <Badge className="text-[10px] bg-amber-500/10 text-warning border border-amber-500/20 font-bold">
            <Clock className="w-3 h-3 mr-1" /> รอตรวจสอบ
          </Badge>
        );
      case "processing":
        return (
          <Badge className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-bold">
            <Clock className="w-3 h-3 mr-1 animate-spin" /> กำลังบันทึก
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="text-[10px] bg-rose-500/10 text-negative border border-rose-500/20 font-bold">
            <XCircle className="w-3 h-3 mr-1" /> ปฏิเสธ
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px] border-border text-text-secondary">
            {status}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Profile Confirmation Card */}
      <Card className="bg-surface border-border shadow-xs">
        <CardContent className="p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {profile?.pictureUrl ? (
              <img
                src={profile.pictureUrl}
                alt={profile.displayName}
                className="w-10 h-10 rounded-full border border-border object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-brand text-white flex items-center justify-center text-sm font-bold">
                {profile?.displayName?.slice(0, 1) || "U"}
              </div>
            )}
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-text-primary">
                  {profile?.displayName || "LINE User"}
                </span>
                {isRegistered ? (
                  <Badge className="text-[9.5px] px-2 py-0 bg-brand-soft text-brand border border-brand/20 font-bold">
                    ยืนยันแล้ว
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[9.5px] px-2 py-0 text-warning border-amber-400/40 bg-amber-500/10 font-bold">
                    รอยืนยัน
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-text-secondary font-mono truncate max-w-[170px]">
                {profile?.userId || "ID ไม่พร้อมใช้งาน"}
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant={isRegistered ? "outline" : "default"}
            onClick={() => setDialogOpen(true)}
            className="text-xs h-9 px-3 font-bold gap-1 rounded-xl bg-brand text-white hover:bg-brand-strong"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>{isRegistered ? "แก้ไขโปรไฟล์" : "ลงทะเบียน"}</span>
          </Button>
        </CardContent>
      </Card>

      {/* Personal Summary Card */}
      <Card className="bg-surface border-border shadow-xs">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-xs text-text-secondary font-bold flex items-center gap-1.5">
            <Wallet className="w-4 h-4 text-brand" /> ยอดโอนสะสมของฉัน
          </CardTitle>
          <div className="mt-1">
            <span className="text-2xl font-black text-text-primary tabular-nums">
              {formatCurrency(personalSummary.total)}
            </span>
            <p className="text-xs text-text-secondary mt-0.5 font-medium">
              ส่งสลิปทั้งหมด {personalSummary.count} รายการ
            </p>
          </div>
        </CardHeader>
      </Card>

      {/* Historical List */}
      <Card className="bg-surface border-border shadow-xs overflow-hidden">
        <CardHeader className="py-3 px-4 border-b border-border bg-brand-soft/20">
          <h3 className="text-sm font-extrabold text-text-primary tracking-tight">
            ประวัติการส่งสลิปของฉัน
          </h3>
        </CardHeader>
        <CardContent className="p-0 divide-y divide-border">
          {loading ? (
            <div className="p-8 text-center text-xs text-text-secondary">
              กำลังโหลดรายการ...
            </div>
          ) : deposits.length === 0 ? (
            <div className="p-8 text-center text-xs text-text-secondary">
              <AlertCircle className="w-6 h-6 mx-auto mb-2 text-text-secondary/60" />
              ยังไม่พบประวัติการส่งสลิปของคุณ
            </div>
          ) : (
            deposits.map((dep) => (
              <div
                key={dep.id}
                className="p-3.5 flex items-center justify-between hover:bg-brand-soft/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-brand-soft text-brand flex items-center justify-center shrink-0">
                    <CheckCircle className="w-4 h-4 stroke-[2.2]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-text-primary tabular-nums">
                        {formatCurrency(dep.detected_amount)}
                      </span>
                      {getStatusBadge(dep.status)}
                    </div>
                    <p className="text-[10px] text-text-secondary mt-0.5">
                      {formatThaiDate(dep.created_at)}
                    </p>
                  </div>
                </div>

                <div className="text-right text-[11px] text-text-secondary font-mono">
                  {dep.bank_reference || "-"}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <ProfileRegisterDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

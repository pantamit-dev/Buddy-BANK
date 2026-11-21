"use client";

import React, { useEffect, useState } from "react";
import { useLiff } from "@/shared/context/liff-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { formatCurrency, formatThaiDate } from "@/lib/utils";
import { Wallet, CheckCircle, Clock, AlertCircle, XCircle, UserCheck, CheckCircle2 } from "lucide-react";
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
          <Badge variant="success" className="text-[10px]">
            <CheckCircle className="w-3 h-3 mr-1" /> ยืนยันแล้ว
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="warning" className="text-[10px]">
            <Clock className="w-3 h-3 mr-1" /> รอตรวจสอบ
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-800">
            <Clock className="w-3 h-3 mr-1 animate-spin" /> กำลังบันทึก
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive" className="text-[10px]">
            <XCircle className="w-3 h-3 mr-1" /> ปฏิเสธ
          </Badge>
        );
      default:
        return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Profile Confirmation Card */}
      <Card className="bg-white border-slate-200 shadow-xs">
        <CardContent className="p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {profile?.pictureUrl ? (
              <img
                src={profile.pictureUrl}
                alt={profile.displayName}
                className="w-10 h-10 rounded-full border border-slate-200 object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                {profile?.displayName?.slice(0, 1) || "U"}
              </div>
            )}
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-slate-800">
                  {profile?.displayName || "LINE User"}
                </span>
                {isRegistered ? (
                  <Badge variant="success" className="text-[9px] px-1.5 py-0">
                    ยืนยันแล้ว
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-amber-600 border-amber-300 bg-amber-50">
                    รอยืนยัน
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-mono truncate max-w-[170px]">
                {profile?.userId || "ID ไม่พร้อมใช้งาน"}
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant={isRegistered ? "outline" : "default"}
            onClick={() => setDialogOpen(true)}
            className="text-xs h-8 px-3 font-semibold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>{isRegistered ? "แก้ไขโปรไฟล์" : "ลงทะเบียน"}</span>
          </Button>
        </CardContent>
      </Card>

      {/* Personal Summary Card */}
      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-500 font-medium flex items-center gap-1.5">
            <Wallet className="w-4 h-4 text-emerald-600" /> ยอดโอนสะสมของฉัน
          </CardTitle>
          <div className="mt-1">
            <span className="text-2xl font-black text-slate-900">
              {formatCurrency(personalSummary.total)}
            </span>
            <p className="text-xs text-slate-400 mt-0.5">
              ส่งสลิปทั้งหมด {personalSummary.count} รายการ
            </p>
          </div>
        </CardHeader>
      </Card>

      {/* Historical List */}
      <Card>
        <CardHeader className="py-3 px-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">
            ประวัติการส่งสลิปของฉัน
          </h3>
        </CardHeader>
        <CardContent className="p-0 divide-y divide-slate-100">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">
              กำลังโหลดรายการ...
            </div>
          ) : deposits.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              <AlertCircle className="w-6 h-6 mx-auto mb-2 text-slate-300" />
              ยังไม่พบประวัติการส่งสลิปของคุณ
            </div>
          ) : (
            deposits.map((dep) => (
              <div key={dep.id} className="p-3.5 space-y-2 hover:bg-slate-50/60">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900">
                    {formatCurrency(dep.detected_amount)}
                  </span>
                  {getStatusBadge(dep.status)}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>{formatThaiDate(dep.created_at)}</span>
                  <span className="font-mono text-[10px]">
                    {dep.bank_reference || "ไม่มีรหัสอ้างอิง"}
                  </span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Profile Registration Dialog */}
      <ProfileRegisterDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import { useLiff } from "@/shared/context/liff-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { Users, Crown, Shield, UserCheck, CheckCircle } from "lucide-react";

export default function GroupMembersPage() {
  const { profile, groupId } = useLiff();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/members?groupId=${groupId}`);
      if (res.ok) {
        const json = await res.json();
        setMembers(json.members || []);
      }
    } catch (e) {
      console.error("Failed to load members:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (groupId) {
      fetchMembers();
    }
  }, [groupId]);

  const handleApproveMember = async (memberId: string) => {
    try {
      setActionLoading(memberId);
      const res = await fetch("/api/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          status: "active",
          actorLineUserId: profile?.userId || "U_OWNER_001",
        }),
      });

      if (res.ok) {
        await fetchMembers();
      } else {
        const err = await res.json();
        alert(err.error || "เกิดข้อผิดพลาดในการอนุมัติสมาชิก");
      }
    } catch (e) {
      alert("ไม่สามารถอนุมัติได้: " + String(e));
    } finally {
      setActionLoading(null);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "owner":
        return (
          <Badge className="bg-amber-500 text-white text-[10px] gap-1">
            <Crown className="w-2.5 h-2.5" /> หัวหน้ากลุ่ม
          </Badge>
        );
      case "treasurer":
        return (
          <Badge className="bg-blue-600 text-white text-[10px] gap-1">
            <Shield className="w-2.5 h-2.5" /> เหรัญญิก
          </Badge>
        );
      case "member":
        return (
          <Badge variant="secondary" className="text-[10px]">
            สมาชิก
          </Badge>
        );
      default:
        return <Badge variant="outline" className="text-[10px]">{role}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-white border-slate-200">
        <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-600" /> สมาชิกในกลุ่ม (
            {members.length} คน)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 divide-y divide-slate-100">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">
              กำลังโหลดรายชื่อสมาชิก...
            </div>
          ) : members.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              ยังไม่มีสมาชิกในระบบ
            </div>
          ) : (
            members.map((m) => {
              const prof = m.profiles || {};
              const isPending = m.status === "pending_approval";

              return (
                <div
                  key={m.id}
                  className="p-3.5 flex items-center justify-between hover:bg-slate-50/70"
                >
                  <div className="flex items-center gap-3">
                    {prof.picture_url ? (
                      <img
                        src={prof.picture_url}
                        alt={prof.display_name}
                        className="w-10 h-10 rounded-full object-cover border border-slate-200"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm">
                        {prof.display_name?.slice(0, 1) || "U"}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900">
                          {prof.display_name || "สมาชิก"}
                        </span>
                        {getRoleBadge(m.role)}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        สมทบแล้ว:{" "}
                        <span className="font-semibold text-emerald-600">
                          {formatCurrency(m.contributionTotal)}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div>
                    {isPending ? (
                      <Button
                        size="sm"
                        variant="default"
                        className="text-xs h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 gap-1"
                        disabled={actionLoading === m.id}
                        onClick={() => handleApproveMember(m.id)}
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        {actionLoading === m.id ? "กำลังอนุมัติ..." : "อนุมัติ"}
                      </Button>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300 bg-emerald-50">
                        <CheckCircle className="w-2.5 h-2.5 mr-1" /> สมาชิกพร้อมใช้งาน
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

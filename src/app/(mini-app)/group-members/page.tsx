"use client";

import React, { useEffect, useState } from "react";
import { useLiff } from "@/shared/context/liff-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { Users, Crown, Shield, UserCheck, CheckCircle, Eye, Loader2 } from "lucide-react";
import type { MemberRole } from "@/shared/types/database.types";

export default function GroupMembersPage() {
  const { profile, groupId, isOwner } = useLiff();
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

  const handleUpdateRole = async (memberId: string, newRole: MemberRole) => {
    try {
      setActionLoading(memberId);
      const res = await fetch("/api/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId,
          role: newRole,
          actorLineUserId: profile?.userId || "U_OWNER_001",
        }),
      });

      if (res.ok) {
        setMembers((prev) =>
          prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
        );
      } else {
        const err = await res.json();
        alert(err.error || "เกิดข้อผิดพลาดในการเปลี่ยนบทบาท");
      }
    } catch (e) {
      alert("ไม่สามารถเปลี่ยนบทบาทได้: " + String(e));
    } finally {
      setActionLoading(null);
    }
  };

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
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/25 text-[10px] gap-1 font-bold">
            <Crown className="w-2.5 h-2.5" /> หัวหน้ากลุ่ม
          </Badge>
        );
      case "treasurer":
        return (
          <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25 text-[10px] gap-1 font-bold">
            <Shield className="w-2.5 h-2.5" /> เหรัญญิก
          </Badge>
        );
      case "viewer":
        return (
          <Badge className="bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/25 text-[10px] gap-1 font-bold">
            <Eye className="w-2.5 h-2.5" /> ผู้สังเกตการณ์
          </Badge>
        );
      case "member":
        return (
          <Badge variant="secondary" className="text-[10px] bg-brand-soft/50 text-text-secondary border-0 font-medium">
            สมาชิก
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px] border-border text-text-secondary font-medium">
            {role}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-surface border-border shadow-xs rounded-2xl overflow-hidden">
        <CardHeader className="py-3.5 px-4 border-b border-border bg-brand-soft/20 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-extrabold text-text-primary flex items-center gap-2">
            <Users className="w-4 h-4 text-brand" /> สมาชิกในกลุ่ม ({members.length} คน)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 divide-y divide-border">
          {loading ? (
            <div className="p-8 text-center text-xs text-text-secondary">
              กำลังโหลดรายชื่อสมาชิก...
            </div>
          ) : members.length === 0 ? (
            <div className="p-8 text-center text-xs text-text-secondary">
              ยังไม่มีสมาชิกในระบบ
            </div>
          ) : (
            members.map((m) => {
              const prof = m.profiles || {};
              const isPending = m.status === "pending_approval";

              return (
                <div
                  key={m.id}
                  className="p-3.5 flex items-center justify-between hover:bg-brand-soft/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {prof.picture_url ? (
                      <img
                        src={prof.picture_url}
                        alt={prof.display_name}
                        className="w-10 h-10 rounded-full object-cover border border-border"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-brand-soft text-brand flex items-center justify-center font-bold text-sm">
                        {prof.display_name?.slice(0, 1) || "U"}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-text-primary">
                          {prof.display_name || "สมาชิก"}
                        </span>
                        {getRoleBadge(m.role)}
                      </div>
                      <p className="text-[11px] text-text-secondary mt-0.5">
                        สมทบแล้ว:{" "}
                        <span className="font-extrabold text-brand tabular-nums">
                          {formatCurrency(m.contributionTotal)}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isPending ? (
                      <Button
                        size="sm"
                        variant="default"
                        className="text-xs h-8 px-2.5 rounded-xl bg-brand hover:bg-brand-strong text-white gap-1 font-bold shadow-xs"
                        disabled={actionLoading === m.id}
                        onClick={() => handleApproveMember(m.id)}
                      >
                        {actionLoading === m.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <UserCheck className="w-3.5 h-3.5" />
                        )}
                        {actionLoading === m.id ? "กำลังอนุมัติ..." : "อนุมัติ"}
                      </Button>
                    ) : (
                      <Badge className="text-[10px] text-brand border border-brand/20 bg-brand-soft font-bold">
                        <CheckCircle className="w-2.5 h-2.5 mr-1" /> พร้อมใช้งาน
                      </Badge>
                    )}

                    {isOwner && (
                      <select
                        value={m.role}
                        disabled={actionLoading === m.id}
                        onChange={(e) => handleUpdateRole(m.id, e.target.value as MemberRole)}
                        className="text-xs h-8 px-2 py-1 rounded-xl border border-border bg-surface text-text-primary focus:outline-none focus:ring-1 focus:ring-brand font-medium cursor-pointer"
                      >
                        <option value="owner">👑 Owner</option>
                        <option value="treasurer">🛡️ เหรัญญิก</option>
                        <option value="member">👤 สมาชิก</option>
                        <option value="viewer">👁️ ผู้ชม</option>
                      </select>
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

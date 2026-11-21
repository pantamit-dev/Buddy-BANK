"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useLiff } from "@/shared/context/liff-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
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
} from "lucide-react";

// In-memory client cache for instant tab navigation (30s TTL)
const overviewCache: Record<
  string,
  { data: any; recentDeposits: any[]; timestamp: number }
> = {};
const CACHE_TTL_MS = 30_000;

export function invalidateOverviewCache(groupId?: string) {
  if (groupId) {
    delete overviewCache[groupId];
  } else {
    for (const key of Object.keys(overviewCache)) {
      delete overviewCache[key];
    }
  }
}

export default function OverviewPage() {
  const { groupId } = useLiff();
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

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-500">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm">กำลังโหลดข้อมูลกองกลาง...</p>
      </div>
    );
  }

  const group = data?.group || {
    name: "ทริปญี่ปุ่น 2027 🌸",
    target_amount: 50000,
  };
  const balance = data?.balance || {
    totalBalance: 2500,
    targetAmount: 50000,
    percentage: 5.0,
    remainingAmount: 47500,
  };
  const memberCount = data?.memberCount || 3;

  return (
    <div className="space-y-4">
      {/* Pool Header Card */}
      <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white border-0 shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Badge
              variant="outline"
              className="text-emerald-400 border-emerald-500/40 bg-emerald-500/10 text-[10px]"
            >
              <ShieldCheck className="w-3 h-3 mr-1" /> ปลอดภัยด้วย Ledger RLS
            </Badge>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> {memberCount} สมาชิก
            </span>
          </div>
          <CardTitle className="text-lg text-white font-bold mt-1">
            {group.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-1">
          <div>
            <p className="text-xs text-slate-400">ยอดเงินกองกลางสะสม</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-extrabold text-emerald-400">
                {formatCurrency(balance.totalBalance)}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5 bg-slate-800/80 p-3 rounded-lg border border-slate-700">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1">
                <Target className="w-3 h-3 text-emerald-400" /> เป้าหมาย:{" "}
                {formatCurrency(balance.targetAmount)}
              </span>
              <span className="font-bold text-white">
                {balance.percentage.toFixed(1)}%
              </span>
            </div>
            <Progress
              value={balance.percentage}
              max={100}
              className="h-2.5 bg-slate-700"
            />
            <p className="text-[11px] text-slate-400 text-right">
              ยังขาดอีก {formatCurrency(balance.remainingAmount)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Quick Action Navigation */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/review">
          <Button
            variant="outline"
            className="w-full justify-between h-auto py-3 bg-white border-slate-200 hover:bg-slate-50"
          >
            <div className="text-left">
              <p className="font-semibold text-slate-900 text-sm">ตรวจสลิปค้าง</p>
              <p className="text-[11px] text-slate-500">อนุมัติรายการโอน</p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </Button>
        </Link>
        <Link href="/my-deposits">
          <Button
            variant="outline"
            className="w-full justify-between h-auto py-3 bg-white border-slate-200 hover:bg-slate-50"
          >
            <div className="text-left">
              <p className="font-semibold text-slate-900 text-sm">ยอดของฉัน</p>
              <p className="text-[11px] text-slate-500">ประวัติการโอนเงิน</p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </Button>
        </Link>
      </div>

      {/* Reports & Analytics Quick Access */}
      <Link href="/reports" className="block">
        <Card className="border-indigo-100 bg-gradient-to-r from-indigo-50/70 to-blue-50/70 hover:shadow-xs transition-shadow">
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-indigo-600 text-white">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">รายงานการเงิน & AI Copilot</p>
                <p className="text-[10px] text-slate-500">ดาวน์โหลดรายงาน Excel และดูแนวโน้มการออม</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-indigo-600" />
          </CardContent>
        </Card>
      </Link>

      {/* Recent Ledger Credits */}
      <Card>
        <CardHeader className="py-3 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">
              รายการโอนเข้าล่าสุด
            </h3>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            บันทึกแล้ว
          </Badge>
        </CardHeader>
        <CardContent className="p-0 divide-y divide-slate-100">
          {recentDeposits.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs">
              <Clock className="w-6 h-6 mx-auto mb-2 text-slate-300" />
              ยังไม่มีรายการโอนที่ได้รับการยืนยัน
            </div>
          ) : (
            recentDeposits.map((dep) => (
              <div
                key={dep.id}
                className="p-3.5 flex items-center justify-between hover:bg-slate-50/80 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">
                      {dep.group_members?.profiles?.display_name || "สมาชิก"}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {formatThaiDate(dep.created_at)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-emerald-600">
                    +{formatCurrency(dep.detected_amount)}
                  </span>
                  <p className="text-[9px] text-slate-400">
                    {dep.bank_reference || "โอนสำเร็จ"}
                  </p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import { useLiff } from "@/shared/context/liff-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import {
  FileSpreadsheet,
  Download,
  Calendar,
  TrendingUp,
  TrendingDown,
  Sparkles,
  BarChart3,
  CheckCircle2,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function ReportsPage() {
  const { groupId } = useLiff();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [stats, setStats] = useState<{
    totalCredits: number;
    totalDebits: number;
    netBalance: number;
  }>({ totalCredits: 2500, totalDebits: 0, netBalance: 2500 });
  const [copilotInsight, setCopilotInsight] = useState<string | null>(null);

  useEffect(() => {
    async function loadReports() {
      try {
        setLoading(true);
        // Call copilot endpoint for analytical insight
        const copilotRes = await fetch("/api/chat/copilot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            groupId: groupId || "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            messages: [{ role: "user", content: "สรุปภาพรวมทางการเงินและแนวโน้มการออม" }],
          }),
        });

        if (copilotRes.ok) {
          const copilotData = await copilotRes.json();
          setCopilotInsight(copilotData.replyText);
        }
      } catch (err) {
        console.error("Failed to load reports overview:", err);
      } finally {
        setLoading(false);
      }
    }

    loadReports();
  }, [groupId]);

  const handleGenerateReport = async () => {
    try {
      setGenerating(true);
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: groupId || "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          period: new Date().toISOString().substring(0, 7),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setReports((prev) => [data.report, ...prev]);
        if (data.report?.signedUrl) {
          window.open(data.report.signedUrl, "_blank");
        }
      }
    } catch (err) {
      console.error("Generate report failed:", err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card className="bg-gradient-to-br from-[#087963] to-[#06483F] dark:from-[#063B32] dark:to-[#075C4D] text-white border-0 shadow-md rounded-2xl p-4">
        <CardHeader className="p-0 pb-3">
          <div className="flex items-center justify-between">
            <Badge className="bg-white/15 text-white border-white/20 text-[10px] font-bold">
              <BarChart3 className="w-3.5 h-3.5 mr-1" /> รายงานการเงิน & AI
            </Badge>
            <span className="text-xs text-emerald-100 flex items-center gap-1 font-medium">
              <Calendar className="w-3.5 h-3.5" /> ประจำเดือนนี้
            </span>
          </div>
          <CardTitle className="text-lg text-white font-extrabold mt-2 tracking-tight">
            รายงานและประวัติเดินบัญชี
          </CardTitle>
          <p className="text-xs text-emerald-100/90 leading-relaxed">
            สร้างและดาวน์โหลดไฟล์รายงาน Excel (.xlsx) และตรวจสอบบทวิเคราะห์การเงินอัจฉริยะ
          </p>
        </CardHeader>
        <CardContent className="p-0 pt-1">
          <Button
            onClick={handleGenerateReport}
            disabled={generating}
            className="w-full bg-white text-brand-strong hover:bg-white/90 font-extrabold rounded-xl h-11 text-xs shadow-xs flex items-center justify-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4 text-brand" />
            {generating ? "กำลังสร้างรายงาน Excel..." : "สร้างรายงาน Excel (ExcelJS)"}
          </Button>
        </CardContent>
      </Card>

      {/* Financial Stats Breakdown */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-surface border-border shadow-xs rounded-2xl">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-soft text-brand flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <p className="text-[11px] text-text-secondary font-medium">ยอดเงินเข้า (ฝาก)</p>
              <p className="text-sm font-extrabold text-positive tabular-nums">
                +{formatCurrency(stats.totalCredits)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-surface border-border shadow-xs rounded-2xl">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-negative flex items-center justify-center shrink-0">
              <TrendingDown className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <p className="text-[11px] text-text-secondary font-medium">ยอดเงินออก (เบิก)</p>
              <p className="text-sm font-extrabold text-negative tabular-nums">
                −{formatCurrency(stats.totalDebits)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Copilot Analytical Insights */}
      {copilotInsight && (
        <Card className="border-brand/20 bg-brand-soft/40 shadow-xs rounded-2xl overflow-hidden">
          <CardHeader className="pb-1 pt-3.5 px-4">
            <div className="flex items-center gap-2 text-brand text-xs font-extrabold">
              <Sparkles className="w-4 h-4 stroke-[2.2]" />
              <span>บทวิเคราะห์อัจฉริยะ (AI Copilot Insights)</span>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-1.5 text-xs text-text-primary leading-relaxed whitespace-pre-line font-medium">
            {copilotInsight}
          </CardContent>
        </Card>
      )}

      {/* Export History */}
      <Card className="bg-surface border-border shadow-xs rounded-2xl overflow-hidden">
        <CardHeader className="py-3 px-4 border-b border-border bg-brand-soft/20">
          <CardTitle className="text-sm font-extrabold text-text-primary flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-brand" /> รายการดาวน์โหลดที่พร้อมใช้งาน
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 space-y-2">
          {reports.length === 0 ? (
            <p className="text-xs text-text-secondary text-center py-4">
              ยังไม่มีรายงานที่สร้างในรอบนี้ คลิกปุ่มด้านบนเพื่อสร้างไฟล์ Excel
            </p>
          ) : (
            reports.map((r, i) => (
              <div
                key={r.reportId || i}
                className="flex items-center justify-between p-3 bg-brand-soft/30 rounded-xl border border-brand/15"
              >
                <div className="flex items-center gap-2.5">
                  <FileSpreadsheet className="w-4 h-4 text-brand shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-text-primary">
                      รายงานประจำเดือน {r.period}
                    </p>
                    <span className="text-[10px] text-text-secondary font-medium">รูปแบบ Excel (.xlsx)</span>
                  </div>
                </div>
                {r.signedUrl && (
                  <a
                    href={r.signedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1.5 rounded-xl bg-surface border border-border text-brand hover:bg-brand-soft font-bold text-xs flex items-center gap-1 shadow-xs transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>ดาวน์โหลด</span>
                  </a>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

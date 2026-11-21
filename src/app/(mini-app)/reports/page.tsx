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
      <Card className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white border-0 shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-indigo-300 border-indigo-400/30 bg-indigo-500/10 text-xs">
              <BarChart3 className="w-3.5 h-3.5 mr-1" /> รายงานการเงินและสถิติ
            </Badge>
            <span className="text-xs text-slate-300 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> ประจำเดือนนี้
            </span>
          </div>
          <CardTitle className="text-xl text-white font-bold mt-1">
            รายงานและประวัติเดินบัญชี
          </CardTitle>
          <p className="text-xs text-slate-300">
            สร้างและดาวน์โหลดไฟล์รายงาน Excel (.xlsx) และตรวจสอบสรุปวิเคราะห์ทางการเงิน
          </p>
        </CardHeader>
        <CardContent className="pt-2">
          <Button
            onClick={handleGenerateReport}
            disabled={generating}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {generating ? "กำลังสร้างรายงาน Excel..." : "สร้างรายงาน Excel (ExcelJS)"}
          </Button>
        </CardContent>
      </Card>

      {/* Financial Stats Breakdown */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-slate-200">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-700">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-medium">ยอดเงินเข้า (ฝาก)</p>
              <p className="text-base font-bold text-slate-900">
                {formatCurrency(stats.totalCredits)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-red-100 text-red-700">
              <TrendingDown className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-medium">ยอดเงินออก (เบิก)</p>
              <p className="text-base font-bold text-slate-900">
                {formatCurrency(stats.totalDebits)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Copilot Analytical Insights */}
      {copilotInsight && (
        <Card className="border-indigo-100 bg-indigo-50/50">
          <CardHeader className="pb-1 pt-3 px-3.5">
            <div className="flex items-center gap-1.5 text-indigo-700 text-xs font-semibold">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>บทวิเคราะห์อัจฉริยะ (AI Copilot Insights)</span>
            </div>
          </CardHeader>
          <CardContent className="px-3.5 pb-3.5 pt-1 text-xs text-slate-700 leading-relaxed whitespace-pre-line">
            {copilotInsight}
          </CardContent>
        </Card>
      )}

      {/* Export History */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> รายการดาวน์โหลดที่พร้อมใช้งาน
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {reports.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">
              ยังไม่มีรายงานที่สร้างในรอบนี้ คลิกปุ่มด้านบนเพื่อสร้างไฟล์ Excel
            </p>
          ) : (
            reports.map((r, i) => (
              <div
                key={r.reportId || i}
                className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100"
              >
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <div>
                    <p className="text-xs font-medium text-slate-800">
                      รายงานประจำเดือน {r.period}
                    </p>
                    <span className="text-[10px] text-slate-500">รูปแบบ Excel (.xlsx)</span>
                  </div>
                </div>
                {r.signedUrl && (
                  <a
                    href={r.signedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-md bg-white border border-slate-200 text-slate-700 hover:text-emerald-600 text-xs flex items-center gap-1 shadow-xs"
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

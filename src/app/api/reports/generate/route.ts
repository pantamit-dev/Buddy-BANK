import { NextRequest, NextResponse } from "next/server";
import { ReportGeneratorService } from "@/modules/reports/generator";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { groupId, period = new Date().toISOString().substring(0, 7) } = body;

    if (!groupId) {
      return NextResponse.json({ error: "groupId is required" }, { status: 400 });
    }

    const reportService = new ReportGeneratorService();
    const report = await reportService.generateMonthlyExcelReport(groupId, period);

    return NextResponse.json({ success: true, report });
  } catch (err: any) {
    console.error("[ReportAPI] Error generating report:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to generate report" },
      { status: 500 }
    );
  }
}

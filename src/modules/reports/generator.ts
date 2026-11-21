import ExcelJS from "exceljs";
import { createAdminClient } from "@/integrations/supabase/server";
import type { ReportType } from "@/shared/types/database.types";

export interface GenerateReportResult {
  reportId: string;
  storagePath: string;
  signedUrl: string | null;
  reportType: ReportType;
  period: string;
}

export class ReportGeneratorService {
  constructor(private supabase = createAdminClient()) {}

  /**
   * Generates a multi-sheet financial report in Excel (.xlsx) format and uploads to Supabase Storage
   */
  async generateMonthlyExcelReport(groupId: string, period: string): Promise<GenerateReportResult> {
    // 1. Fetch group details
    const { data: group } = await this.supabase
      .from("groups")
      .select("*")
      .eq("id", groupId)
      .single();

    if (!group) throw new Error("Group not found");

    // 2. Fetch ledger entries
    const { data: ledgerEntries } = await this.supabase
      .from("ledger_entries")
      .select("*, group_members(profiles(display_name))")
      .eq("group_id", groupId)
      .order("created_at", { ascending: true });

    // 3. Fetch members
    const { data: members } = await this.supabase
      .from("group_members")
      .select("id, role, status, profiles(display_name)")
      .eq("group_id", groupId);

    // 4. Build Excel workbook using ExcelJS
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Bank Buddy System";
    workbook.created = new Date();

    // Sheet 1: Summary Overview
    const summarySheet = workbook.addWorksheet("ภาพรวมกองกลาง");
    summarySheet.columns = [
      { header: "หัวข้อ", key: "title", width: 25 },
      { header: "ข้อมูล", key: "value", width: 35 },
    ];

    let totalCredits = 0;
    let totalDebits = 0;
    for (const e of ledgerEntries || []) {
      if (e.entry_type === "credit") totalCredits += Number(e.amount);
      if (e.entry_type === "debit") totalDebits += Number(e.amount);
    }
    const currentBalance = totalCredits - totalDebits;

    summarySheet.addRows([
      { title: "ชื่อกลุ่มกองกลาง", value: group.name },
      { title: "รอบรายงาน", value: period },
      { title: "เป้าหมายเงินกองกลาง", value: `฿${Number(group.target_amount).toLocaleString()}` },
      { title: "ยอดคงเหลือสุทธิปัจจุบัน", value: `฿${currentBalance.toLocaleString()}` },
      { title: "ยอดเงินเข้าสะสม (Deposit)", value: `฿${totalCredits.toLocaleString()}` },
      { title: "ยอดเงินออกสะสม (Withdrawal)", value: `฿${totalDebits.toLocaleString()}` },
      { title: "จำนวนสมาชิกในกลุ่ม", value: `${(members || []).length} ท่าน` },
      { title: "วันที่จัดทำรายงาน", value: new Date().toLocaleString("th-TH") },
    ]);

    summarySheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    summarySheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F172A" },
    };

    // Sheet 2: Ledger Entries
    const ledgerSheet = workbook.addWorksheet("รายการเดินบัญชี");
    ledgerSheet.columns = [
      { header: "ลำดับ", key: "index", width: 8 },
      { header: "วันเวลา", key: "date", width: 22 },
      { header: "สมาชิก", key: "member", width: 25 },
      { header: "ประเภทรายการ", key: "type", width: 16 },
      { header: "จำนวนเงิน (THB)", key: "amount", width: 18 },
      { header: "ยอดคงเหลือ (THB)", key: "balance", width: 20 },
    ];

    (ledgerEntries || []).forEach((row: any, i: number) => {
      ledgerSheet.addRow({
        index: i + 1,
        date: new Date(row.created_at).toLocaleString("th-TH"),
        member: row.group_members?.profiles?.display_name || "สมาชิก",
        type: row.entry_type === "credit" ? "ฝากเงิน (+)" : "เบิกเงิน (-)",
        amount: Number(row.amount),
        balance: Number(row.running_balance),
      });
    });

    ledgerSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ledgerSheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E293B" },
    };

    // Sheet 3: Member Roster
    const memberSheet = workbook.addWorksheet("รายชื่อสมาชิก");
    memberSheet.columns = [
      { header: "ลำดับ", key: "index", width: 8 },
      { header: "ชื่อสมาชิก", key: "name", width: 25 },
      { header: "บทบาท (Role)", key: "role", width: 15 },
      { header: "สถานะ", key: "status", width: 15 },
    ];

    (members || []).forEach((m: any, i: number) => {
      memberSheet.addRow({
        index: i + 1,
        name: m.profiles?.display_name || "สมาชิก",
        role: m.role,
        status: m.status,
      });
    });

    memberSheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    memberSheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF334155" },
    };

    // 5. Generate Buffer
    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `${groupId}/${period}_financial_report_${Date.now()}.xlsx`;

    // 6. Upload to Storage bucket 'reports'
    const { data: uploadData, error: uploadErr } = await this.supabase.storage
      .from("reports")
      .upload(fileName, buffer, {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        upsert: true,
      });

    if (uploadErr) {
      console.error("[ReportGeneratorService] Storage upload failed:", uploadErr);
    }

    const storagePath = uploadData?.path || `reports/${fileName}`;

    // 7. Insert row into reports table
    const { data: reportRow, error: insertErr } = await this.supabase
      .from("reports")
      .insert({
        group_id: groupId,
        report_type: "monthly_summary",
        period,
        file_storage_path: storagePath,
        status: "completed",
      })
      .select()
      .single();

    if (insertErr) {
      throw insertErr;
    }

    // 8. Generate short-lived signed URL
    const { data: signedData } = await this.supabase.storage
      .from("reports")
      .createSignedUrl(storagePath, 3600);

    return {
      reportId: reportRow.id,
      storagePath,
      signedUrl: signedData?.signedUrl || null,
      reportType: "monthly_summary",
      period,
    };
  }

  /**
   * Generates a lightweight CSV formatted report buffer
   */
  async generateCsvReport(groupId: string): Promise<string> {
    const { data: entries } = await this.supabase
      .from("ledger_entries")
      .select("*, group_members(profiles(display_name))")
      .eq("group_id", groupId)
      .order("created_at", { ascending: true });

    let csv = "ID,Date,Member,Type,Amount,RunningBalance\n";
    for (const e of entries || []) {
      const date = new Date(e.created_at).toISOString();
      const name = (e as any).group_members?.profiles?.display_name || "Member";
      csv += `"${e.id}","${date}","${name}","${e.entry_type}",${e.amount},${e.running_balance}\n`;
    }
    return csv;
  }
}

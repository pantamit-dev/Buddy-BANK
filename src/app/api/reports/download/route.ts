import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const reportId = searchParams.get("reportId");

    if (!reportId) {
      return NextResponse.json({ error: "reportId is required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: report, error } = await supabase
      .from("reports")
      .select("*")
      .eq("id", reportId)
      .single();

    if (error || !report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const { data: signedData } = await supabase.storage
      .from("reports")
      .createSignedUrl(report.file_storage_path, 3600);

    return NextResponse.json({
      success: true,
      report,
      downloadUrl: signedData?.signedUrl || null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to get download url" },
      { status: 500 }
    );
  }
}

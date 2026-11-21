"use client";

import React, { useEffect, useState } from "react";
import { useLiff } from "@/shared/context/liff-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { Settings, Save, ShieldAlert, CheckCircle2, UserCheck } from "lucide-react";

export default function SettingsPage() {
  const { profile, groupId, setGroupId } = useLiff();
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true);
        const url = "/api/groups" + (groupId ? `?groupId=${groupId}` : "");
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          if (json.group) {
            setName(json.group.name || "");
            setTargetAmount(String(json.group.target_amount || "0"));
            if (json.group.id && json.group.id !== groupId) {
              setGroupId(json.group.id);
            }
          }
        }
      } catch (e) {
        console.error("Failed to load settings:", e);
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, [groupId, setGroupId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setSuccessMsg(null);

      const res = await fetch("/api/groups", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: groupId || undefined,
          name,
          targetAmount: Number(targetAmount),
          actorLineUserId: profile?.userId || "U000ec61a0cfa63d6b163c764f7793c15",
        }),
      });

      if (res.ok) {
        setSuccessMsg("บันทึกการตั้งค่าเรียบร้อยแล้ว");
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        const err = await res.json();
        alert(err.error || "เกิดข้อผิดพลาดในการบันทึก");
      }
    } catch (e) {
      alert("ไม่สามารถบันทึกได้: " + String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Current Operator Status */}
      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="p-3 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <span className="text-slate-500">ผู้ดำเนินการ: </span>
              <span className="font-bold text-slate-800">
                {profile?.displayName || "Save"}
              </span>
            </div>
          </div>
          <Badge variant="success" className="text-[10px] px-2 py-0.5">
            สิทธิ์ Owner
          </Badge>
        </CardContent>
      </Card>

      <Card className="bg-white border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-600" /> ตั้งค่ากองกลาง
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            เฉพาะหัวหน้ากลุ่ม (Owner) เท่านั้นที่มีสิทธิ์แก้ไขการตั้งค่านี้
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-xs text-slate-400">
              กำลังโหลดข้อมูลการตั้งค่า...
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  ชื่อกลุ่ม / วัตถุประสงค์กองกลาง:
                </label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น ทริปญี่ปุ่น 2027"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  เป้าหมายยอดเงินรวม (บาท):
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  placeholder="50000.00"
                  required
                />
              </div>

              {successMsg && (
                <div className="flex items-center gap-1.5 p-2.5 rounded bg-emerald-50 text-emerald-800 text-xs border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={saving}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 gap-1.5 font-semibold"
              >
                <Save className="w-4 h-4" />
                {saving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs text-slate-600">
            <span className="font-semibold text-slate-800">
              ข้อกำหนดความปลอดภัยทางบัญชี
            </span>
            <p>
              ยอดเงินในระบบคำนวณจากรายการสลิปที่ได้รับการตรวจสอบและบันทึกในบัญชีแยกประเภท
              (Immutable Ledger) เท่านั้น การแก้ไขเป้าหมายจะไม่กระทบต่อประวัติการทำธุรกรรม
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

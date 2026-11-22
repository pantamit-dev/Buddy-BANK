"use client";

import React, { useEffect, useState } from "react";
import { useLiff } from "@/shared/context/liff-context";
import { useTheme, ThemeMode } from "@/shared/context/theme-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import {
  Settings,
  Save,
  ShieldAlert,
  CheckCircle2,
  UserCheck,
  Palette,
  Sun,
  Moon,
  Laptop,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { profile, groupId, setGroupId } = useLiff();
  const { theme, setTheme } = useTheme();
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

  const themeOptions: { id: ThemeMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "system", label: "ตามระบบ", icon: Laptop },
    { id: "light", label: "สว่าง", icon: Sun },
    { id: "dark", label: "มืด", icon: Moon },
  ];

  return (
    <div className="space-y-4">
      {/* 1. Current Operator Status */}
      <Card className="bg-surface border-border shadow-xs">
        <CardContent className="p-3.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-brand-soft text-brand flex items-center justify-center shrink-0">
              <UserCheck className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <span className="text-text-secondary text-[11px]">ผู้ดำเนินการ: </span>
              <span className="font-bold text-text-primary block text-xs">
                {profile?.displayName || "Save (Administrator)"}
              </span>
            </div>
          </div>
          <Badge variant="success" className="text-[10px] px-2.5 py-0.5 rounded-full bg-brand-soft text-brand border border-brand/20">
            สิทธิ์ Owner
          </Badge>
        </CardContent>
      </Card>

      {/* 2. Appearance & Theme Settings (SYSTEM_DESIGN.md Section 6) */}
      <Card className="bg-surface border-border shadow-xs">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-extrabold text-text-primary flex items-center gap-2">
            <Palette className="w-4 h-4 text-brand" /> รูปลักษณ์ (ธีมการแสดงผล)
          </CardTitle>
          <CardDescription className="text-xs text-text-secondary">
            เลือกโทนสีของแอปพลิเคชัน รองรับการสลับตามระบบ สว่าง และมืด
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {/* Segmented Control for Theme Selection */}
          <div className="grid grid-cols-3 gap-2 p-1 bg-brand-soft/30 border border-brand/15 rounded-2xl">
            {themeOptions.map((opt) => {
              const Icon = opt.icon;
              const isSelected = theme === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTheme(opt.id)}
                  className={cn(
                    "flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs font-bold transition-all min-h-[44px]",
                    isSelected
                      ? "bg-brand text-white shadow-xs scale-[1.02]"
                      : "text-text-secondary hover:text-text-primary hover:bg-brand-soft/40"
                  )}
                >
                  <Icon className={cn("w-4 h-4 mb-1", isSelected ? "text-white" : "text-brand")} />
                  <span className="text-[11px]">{opt.label}</span>
                </button>
              );
            })}
          </div>
          <p className="text-[10.5px] text-text-secondary mt-2 text-center">
            {theme === "system"
              ? "ระบบจะเปลี่ยนธีมสว่างหรือมืดตามการตั้งค่าของอุปกรณ์คุณอัตโนมัติ"
              : theme === "light"
              ? "เปิดใช้งานโหมดสว่างตลอดเวลา"
              : "เปิดใช้งานโหมดมืดเพื่อความสบายตาในที่แสงน้อย"}
          </p>
        </CardContent>
      </Card>

      {/* 3. Group Pool Configuration */}
      <Card className="bg-surface border-border shadow-xs">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-extrabold text-text-primary flex items-center gap-2">
            <Settings className="w-4 h-4 text-brand" /> ตั้งค่ากองกลาง
          </CardTitle>
          <CardDescription className="text-xs text-text-secondary">
            เฉพาะหัวหน้ากลุ่ม (Owner) เท่านั้นที่มีสิทธิ์แก้ไขเป้าหมายนี้
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {loading ? (
            <div className="py-8 text-center text-xs text-text-secondary">
              กำลังโหลดข้อมูลการตั้งค่า...
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-primary">
                  ชื่อกลุ่ม / วัตถุประสงค์กองกลาง:
                </label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น ทริปญี่ปุ่น 2027"
                  className="rounded-xl border-border bg-surface text-text-primary focus-visible:ring-brand"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-primary">
                  เป้าหมายยอดเงินรวม (บาท):
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  placeholder="50000.00"
                  className="rounded-xl border-border bg-surface text-text-primary focus-visible:ring-brand font-medium tabular-nums"
                  required
                />
              </div>

              {successMsg && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-brand-soft text-brand-strong text-xs border border-brand/20">
                  <CheckCircle2 className="w-4 h-4 text-brand shrink-0" />
                  <span className="font-medium">{successMsg}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={saving}
                className="w-full bg-brand hover:bg-brand-strong text-white text-xs h-12 rounded-xl gap-2 font-bold transition-all shadow-xs"
              >
                <Save className="w-4 h-4" />
                {saving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* 4. Security & Audit Disclosure */}
      <Card className="bg-brand-soft/30 border-brand/15 shadow-xs">
        <CardContent className="p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs text-text-secondary">
            <span className="font-bold text-text-primary block">
              ข้อกำหนดความปลอดภัยทางบัญชีกองกลาง
            </span>
            <p className="text-[11px] leading-relaxed">
              ยอดเงินในระบบคำนวณจากรายการสลิปที่ได้รับการตรวจสอบและบันทึกในบัญชีแยกประเภท
              (Immutable Ledger) เท่านั้น การแก้ไขเป้าหมายจะไม่กระทบต่อประวัติการทำธุรกรรมย้อนหลัง
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

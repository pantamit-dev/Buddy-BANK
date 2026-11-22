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
  AlertTriangle,
  RotateCcw,
  Trash2,
  QrCode,
  CreditCard,
  Vote,
  Clock,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/components/ui/dialog";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { profile, groupId, setGroupId } = useLiff();
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  
  // PromptPay & Bank Account Settings
  const [promptpayId, setPromptpayId] = useState("");
  const [bankAccountNo, setBankAccountNo] = useState("");
  const [bankName, setBankName] = useState("");
  const [defaultQrAmount, setDefaultQrAmount] = useState("");

  // Withdrawal & Voting Rules
  const [votingQuorumPercent, setVotingQuorumPercent] = useState("50");
  const [votingDurationHours, setVotingDurationHours] = useState("48");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Development Reset Database state
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);
  const [resetDetails, setResetDetails] = useState<any | null>(null);

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
          if (json.settings) {
            setPromptpayId(json.settings.promptpayId || "");
            setBankAccountNo(json.settings.bankAccountNo || "");
            setBankName(json.settings.bankName || "");
            setDefaultQrAmount(
              json.settings.defaultQrAmount !== null && json.settings.defaultQrAmount !== undefined
                ? String(json.settings.defaultQrAmount)
                : ""
            );
            setVotingQuorumPercent(String(json.settings.votingQuorumPercent ?? 50));
            setVotingDurationHours(String(json.settings.votingDurationHours ?? 48));
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
          promptpayId,
          bankAccountNo,
          bankName,
          defaultQrAmount: defaultQrAmount ? Number(defaultQrAmount) : null,
          votingQuorumPercent: Number(votingQuorumPercent),
          votingDurationHours: Number(votingDurationHours),
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

  const handleResetDatabase = async () => {
    try {
      setIsResetting(true);
      setResetSuccessMsg(null);
      setResetDetails(null);

      const res = await fetch("/api/dev/reset-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: groupId || undefined,
          actorLineUserId: profile?.userId || "U000ec61a0cfa63d6b163c764f7793c15",
        }),
      });

      const json = await res.json();
      if (res.ok) {
        setResetSuccessMsg(json.message || "รีเซ็ตข้อมูลธุรกรรมและสลิปเรียบร้อยแล้ว");
        setResetDetails(json.details);
        setConfirmModalOpen(false);
      } else {
        alert(json.error || "เกิดข้อผิดพลาดในการรีเซ็ตข้อมูล");
      }
    } catch (e) {
      alert("ไม่สามารถรีเซ็ตได้: " + String(e));
    } finally {
      setIsResetting(false);
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

      {/* 3. Group Pool Configuration Form */}
      {loading ? (
        <Card className="bg-surface border-border shadow-xs">
          <CardContent className="py-8 text-center text-xs text-text-secondary">
            กำลังโหลดข้อมูลการตั้งค่า...
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          {/* 3.1 Basic Group Settings */}
          <Card className="bg-surface border-border shadow-xs">
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-extrabold text-text-primary flex items-center gap-2">
                <Settings className="w-4 h-4 text-brand" /> ตั้งค่าข้อมูลกองกลาง
              </CardTitle>
              <CardDescription className="text-xs text-text-secondary">
                เฉพาะหัวหน้ากลุ่ม (Owner) เท่านั้นที่มีสิทธิ์แก้ไขข้อมูลส่วนนี้
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3.5">
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
            </CardContent>
          </Card>

          {/* 3.2 PromptPay & Bank Account for QR Code Generation */}
          <Card className="bg-surface border-border shadow-xs">
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-extrabold text-text-primary flex items-center gap-2">
                <QrCode className="w-4 h-4 text-brand" /> บัญชีกองกลาง & PromptPay QR Code
              </CardTitle>
              <CardDescription className="text-xs text-text-secondary">
                กำหนดเบอร์ PromptPay หรือเลขบัญชีธนาคารสำหรับสร้าง QR Code ให้สมาชิกสแกนโอนเงิน
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3.5">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-brand" />
                    พร้อมเพย์ ID (PromptPay):
                  </label>
                  <span className="text-[10.5px] text-brand font-semibold">สร้าง QR Code</span>
                </div>
                <Input
                  type="text"
                  value={promptpayId}
                  onChange={(e) => setPromptpayId(e.target.value)}
                  placeholder="เช่น 0812345678 หรือ 1100412345678"
                  className="rounded-xl border-border bg-surface text-text-primary focus-visible:ring-brand font-mono"
                />
                <p className="text-[10px] text-text-secondary leading-tight">
                  รองรับเบอร์มือถือ 10 หลัก หรือเลขบัตรประชาชน 13 หลัก (ใช้สร้าง QR Code มาตรฐาน EMVCo อัตโนมัติ)
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-brand" />
                    เลขที่บัญชีธนาคาร:
                  </label>
                  <Input
                    type="text"
                    value={bankAccountNo}
                    onChange={(e) => setBankAccountNo(e.target.value)}
                    placeholder="เช่น 123-4-56789-0"
                    className="rounded-xl border-border bg-surface text-text-primary focus-visible:ring-brand font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-primary">
                    ชื่อธนาคาร:
                  </label>
                  <Input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="เช่น กสิกรไทย (KBANK)"
                    className="rounded-xl border-border bg-surface text-text-primary focus-visible:ring-brand"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-primary">
                  จำนวนเงินเริ่มต้นสำหรับ QR Code (บาท):
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={defaultQrAmount}
                  onChange={(e) => setDefaultQrAmount(e.target.value)}
                  placeholder="เว้นว่างไว้หากต้องการให้ผู้สแกนระบุยอดเอง"
                  className="rounded-xl border-border bg-surface text-text-primary focus-visible:ring-brand font-medium tabular-nums"
                />
                <p className="text-[10px] text-text-secondary leading-tight">
                  หากกำหนดไว้ เมื่อสมาชิกเปิดหน้าโอนเงินหรือขอ QR ใน LINE ระบบจะใส่ยอดเงินนี้ใน QR Code ให้ทันที
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 3.3 Withdrawal & Voting Configuration */}
          <Card className="bg-surface border-border shadow-xs">
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-extrabold text-text-primary flex items-center gap-2">
                <Vote className="w-4 h-4 text-brand" /> เงื่อนไขการถอนเงิน & การลงมติ (Withdrawal)
              </CardTitle>
              <CardDescription className="text-xs text-text-secondary">
                กำหนดเกณฑ์การลงมติเห็นชอบเมื่อมีสมาชิกเสนอเบิกจ่ายหรือถอนเงินจากกองกลาง
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-primary">
                    สัดส่วนโหวตเห็นชอบ (%):
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={votingQuorumPercent}
                    onChange={(e) => setVotingQuorumPercent(e.target.value)}
                    placeholder="50"
                    className="rounded-xl border-border bg-surface text-text-primary focus-visible:ring-brand font-medium tabular-nums"
                    required
                  />
                  <p className="text-[10px] text-text-secondary leading-tight">
                    เปอร์เซ็นต์เสียงเห็นชอบขั้นต่ำของสมาชิกทั้งหมด (ปกติ 50%)
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-primary flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-brand" />
                    ระยะเวลาโหวต (ชม.):
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="168"
                    value={votingDurationHours}
                    onChange={(e) => setVotingDurationHours(e.target.value)}
                    placeholder="48"
                    className="rounded-xl border-border bg-surface text-text-primary focus-visible:ring-brand font-medium tabular-nums"
                    required
                  />
                  <p className="text-[10px] text-text-secondary leading-tight">
                    ระยะเวลาเปิดโหวตก่อนคำขอถอนเงินจะหมดอายุ (ปกติ 48 ชม.)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Status & Submit Button */}
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
            {saving ? "กำลังบันทึกการตั้งค่าทั้งหมด..." : "บันทึกการตั้งค่าทั้งหมด"}
          </Button>
        </form>
      )}

      {/* 4. Owner Development Reset Tools (Danger Zone) */}
      <Card className="bg-surface border-negative/30 shadow-xs overflow-hidden">
        <div className="bg-negative/10 px-4 py-2.5 border-b border-negative/20 flex items-center justify-between">
          <div className="flex items-center gap-2 text-negative font-bold text-xs">
            <AlertTriangle className="w-4 h-4 stroke-[2.2]" />
            <span>เครื่องมือผู้พัฒนา (Owner Dev Tools)</span>
          </div>
          <Badge
            variant="outline"
            className="text-[10px] bg-surface text-negative border-negative/30 font-semibold px-2"
          >
            โหมดทดสอบ
          </Badge>
        </div>
        <CardContent className="p-4 space-y-3">
          <div>
            <h4 className="text-xs font-bold text-text-primary">
              รีเซ็ตข้อมูลธุรกรรมและสลิป (Reset Transaction Data)
            </h4>
            <p className="text-[11px] text-text-secondary mt-1 leading-relaxed">
              ล้างข้อมูลการฝาก สลิป รายการตรวจสอบ และประวัติบัญชีกองกลางทั้งหมดใน Supabase
              เพื่อเริ่มต้นทดสอบระบบใหม่ โดย<strong>คงข้อมูลสมาชิก (Profiles)</strong> และ
              <strong>การตั้งค่ากลุ่ม (Settings)</strong> ไว้ครบถ้วน
            </p>
          </div>

          {resetSuccessMsg && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-positive/10 text-positive text-xs border border-positive/20">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold">{resetSuccessMsg}</span>
                {resetDetails && (
                  <p className="text-[10.5px] opacity-90">
                    ลบสลิป: {resetDetails.deleted_deposits || 0} รายการ | ธุรกรรม:{" "}
                    {resetDetails.deleted_transactions || 0} รายการ | บัญชี:{" "}
                    {resetDetails.deleted_ledger || 0} รายการ
                  </p>
                )}
              </div>
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={() => setConfirmModalOpen(true)}
            disabled={isResetting}
            className="w-full border-negative/40 text-negative hover:bg-negative/10 hover:text-negative hover:border-negative text-xs h-11 rounded-xl gap-2 font-bold transition-all shadow-xs"
          >
            <RotateCcw className={cn("w-4 h-4", isResetting && "animate-spin")} />
            {isResetting ? "กำลังรีเซ็ตฐานข้อมูล..." : "ล้างข้อมูลการฝาก & เริ่มทดสอบใหม่"}
          </Button>
        </CardContent>
      </Card>

      {/* 5. Security & Audit Disclosure */}
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

      {/* Confirmation Modal for Resetting Database */}
      <Dialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="w-10 h-10 rounded-full bg-negative/10 text-negative flex items-center justify-center mx-auto mb-2">
              <AlertTriangle className="w-5 h-5 stroke-[2.2]" />
            </div>
            <DialogTitle className="text-center text-sm">ยืนยันการรีเซ็ตข้อมูลธุรกรรม?</DialogTitle>
            <DialogDescription className="text-center text-xs">
              การดำเนินการนี้จะล้างข้อมูลเพื่อเริ่มทดสอบใหม่ใน Supabase
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5 text-xs py-2 bg-brand-soft/30 p-3 rounded-2xl border border-border">
            <div className="font-bold text-text-primary text-[11.5px] mb-1">
              📋 รายละเอียดการดำเนินการ:
            </div>
            <div className="flex items-center gap-2 text-negative">
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
              <span>ล้างสลิปการฝากและรายการรอตรวจสอบทั้งหมด</span>
            </div>
            <div className="flex items-center gap-2 text-negative">
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
              <span>ล้างประวัติธุรกรรมและบัญชีแยกประเภท</span>
            </div>
            <div className="flex items-center gap-2 text-positive font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>คงข้อมูลสมาชิกและบทบาท (Profiles, Roles) ไว้ตามเดิม</span>
            </div>
            <div className="flex items-center gap-2 text-positive font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>คงข้อมูลชื่อกลุ่มและเป้าหมาย (Settings) ไว้ตามเดิม</span>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={isResetting}
              onClick={() => setConfirmModalOpen(false)}
              className="flex-1 rounded-xl text-xs h-10"
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              disabled={isResetting}
              onClick={handleResetDatabase}
              className="flex-1 bg-negative hover:bg-negative/90 text-white rounded-xl text-xs h-10 font-bold gap-1.5"
            >
              {isResetting ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                  <span>กำลังล้างข้อมูล...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>ยืนยันล้างข้อมูล</span>
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

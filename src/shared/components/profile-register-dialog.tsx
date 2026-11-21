"use client";

import React, { useState } from "react";
import { useLiff } from "@/shared/context/liff-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { UserCheck, CheckCircle2, AlertCircle, LogIn, Sparkles } from "lucide-react";

interface ProfileRegisterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileRegisterDialog({
  open,
  onOpenChange,
}: ProfileRegisterDialogProps) {
  const {
    profile,
    isInClient,
    isRegistered,
    isRegistering,
    login,
    registerProfile,
  } = useLiff();

  const [customName, setCustomName] = useState(profile?.displayName || "");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  React.useEffect(() => {
    if (profile?.displayName) {
      setCustomName(profile.displayName);
    }
  }, [profile?.displayName]);

  const handleRegister = async () => {
    setFeedback(null);
    const res = await registerProfile(customName);
    if (res.success) {
      setFeedback({
        type: "success",
        message: "ยืนยันและบันทึกข้อมูลโปรไฟล์ลง Supabase เรียบร้อยแล้ว!",
      });
      setTimeout(() => {
        onOpenChange(false);
      }, 1500);
    } else {
      setFeedback({
        type: "error",
        message: res.message || "เกิดข้อผิดพลาดในการลงทะเบียน",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl p-6 bg-white shadow-xl">
        <DialogHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-2">
            <UserCheck className="w-6 h-6" />
          </div>
          <DialogTitle className="text-lg font-bold text-slate-900">
            ยืนยันข้อมูลโปรไฟล์ LINE
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            ตรวจสอบและลงทะเบียนข้อมูลเพื่อเชื่อมต่อกับระบบกองกลาง
          </DialogDescription>
        </DialogHeader>

        {/* Profile Card Preview */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col items-center gap-3">
          {profile?.pictureUrl ? (
            <img
              src={profile.pictureUrl}
              alt={profile.displayName}
              className="w-16 h-16 rounded-full border-2 border-emerald-500 object-cover shadow-xs"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xl font-bold">
              {profile?.displayName?.slice(0, 1) || "U"}
            </div>
          )}

          <div className="text-center w-full">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <span className="text-sm font-bold text-slate-800">
                {profile?.displayName || "LINE User"}
              </span>
              {isRegistered ? (
                <Badge variant="success" className="text-[10px] px-1.5 py-0">
                  ลงทะเบียนแล้ว
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-600 border-amber-300 bg-amber-50">
                  รอยืนยัน
                </Badge>
              )}
            </div>
            <p className="text-[11px] font-mono text-slate-400 truncate max-w-full px-2">
              ID: {profile?.userId || "กำลังโหลด..."}
            </p>
          </div>
        </div>

        {/* Custom Display Name Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">
            ชื่อที่ต้องการแสดงในกลุ่ม:
          </label>
          <Input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="ระบุชื่อของคุณ"
            className="text-sm"
          />
          <p className="text-[11px] text-slate-400">
            เพื่อนๆ ในกลุ่มจะเห็นชื่อนี้ในประวัติการส่งสลิปและยอดรวม
          </p>
        </div>

        {/* External Browser LINE Login Prompt */}
        {!isInClient && profile?.userId === "U_OWNER_001" && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-[11px] text-amber-800 flex-1">
              <span>คุณกำลังเปิดผ่านเบราว์เซอร์ภายนอก ต้องการล็อกอินด้วย LINE บัญชีจริงหรือไม่?</span>
              <button
                type="button"
                onClick={login}
                className="mt-1.5 flex items-center gap-1 text-emerald-700 font-bold hover:underline"
              >
                <LogIn className="w-3.5 h-3.5" /> ล็อกอินด้วย LINE
              </button>
            </div>
          </div>
        )}

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
              feedback.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-rose-50 text-rose-800 border border-rose-200"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 text-xs"
            disabled={isRegistering}
          >
            ยกเลิก
          </Button>
          <Button
            onClick={handleRegister}
            disabled={isRegistering || !customName.trim()}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm"
          >
            {isRegistering ? (
              "กำลังบันทึก..."
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 mr-1" />
                ยืนยันลงทะเบียน
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

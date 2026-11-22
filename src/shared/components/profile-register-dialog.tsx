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
        message: "ยืนยันและบันทึกข้อมูลโปรไฟล์เรียบร้อยแล้ว!",
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
      <DialogContent className="max-w-sm rounded-3xl p-6 bg-surface border border-border shadow-2xl">
        <DialogHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-brand-soft text-brand rounded-2xl flex items-center justify-center mb-2">
            <UserCheck className="w-6 h-6 stroke-[2.2]" />
          </div>
          <DialogTitle className="text-base font-extrabold text-text-primary tracking-tight">
            ยืนยันข้อมูลโปรไฟล์ LINE
          </DialogTitle>
          <DialogDescription className="text-xs text-text-secondary">
            ตรวจสอบและลงทะเบียนข้อมูลเพื่อเชื่อมต่อกับระบบ Bank Buddy
          </DialogDescription>
        </DialogHeader>

        {/* Profile Card Preview */}
        <div className="bg-brand-soft/30 border border-brand/20 rounded-2xl p-4 flex flex-col items-center gap-3">
          {profile?.pictureUrl ? (
            <img
              src={profile.pictureUrl}
              alt={profile.displayName}
              className="w-16 h-16 rounded-full border-2 border-brand object-cover shadow-xs"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-brand text-white flex items-center justify-center text-xl font-bold">
              {profile?.displayName?.slice(0, 1) || "U"}
            </div>
          )}

          <div className="text-center w-full">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <span className="text-sm font-bold text-text-primary">
                {profile?.displayName || "LINE User"}
              </span>
              {isRegistered ? (
                <Badge className="text-[10px] px-2 py-0 bg-brand-soft text-brand border border-brand/20 font-bold">
                  ลงทะเบียนแล้ว
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] px-2 py-0 text-warning border-amber-400/40 bg-amber-500/10 font-bold">
                  รอยืนยัน
                </Badge>
              )}
            </div>
            <p className="text-[11px] font-mono text-text-secondary truncate max-w-full px-2">
              ID: {profile?.userId || "กำลังโหลด..."}
            </p>
          </div>
        </div>

        {/* Custom Display Name Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-text-primary">
            ชื่อที่ต้องการแสดงในกลุ่ม:
          </label>
          <Input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="ระบุชื่อของคุณ"
            className="text-sm rounded-xl border-border bg-page text-text-primary focus-visible:ring-brand"
          />
          <p className="text-[10.5px] text-text-secondary">
            เพื่อนๆ ในกลุ่มจะเห็นชื่อนี้ในประวัติการส่งสลิปและยอดรวม
          </p>
        </div>

        {/* External Browser LINE Login Prompt */}
        {!isInClient && profile?.userId === "U_OWNER_001" && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <div className="text-[11px] text-text-secondary flex-1">
              <span>คุณกำลังเปิดผ่านเบราว์เซอร์ภายนอก ต้องการล็อกอินด้วย LINE บัญชีจริงหรือไม่?</span>
              <button
                type="button"
                onClick={login}
                className="mt-1 flex items-center gap-1 text-brand font-bold hover:underline"
              >
                <LogIn className="w-3.5 h-3.5" /> ล็อกอินด้วย LINE
              </button>
            </div>
          </div>
        )}

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              feedback.type === "success"
                ? "bg-brand-soft text-brand-strong border border-brand/20"
                : "bg-rose-500/10 text-negative border border-rose-500/20"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-brand shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-negative shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 text-xs rounded-xl border-border text-text-secondary hover:text-text-primary h-10"
            disabled={isRegistering}
          >
            ยกเลิก
          </Button>
          <Button
            onClick={handleRegister}
            disabled={isRegistering || !customName.trim()}
            className="flex-1 bg-brand hover:bg-brand-strong text-white text-xs font-bold rounded-xl h-10 shadow-xs"
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

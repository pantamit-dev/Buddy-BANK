"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export interface LiffContextType {
  isInitialized: boolean;
  isLoggedIn: boolean;
  isInClient: boolean;
  profile: {
    userId: string;
    displayName: string;
    pictureUrl?: string;
  } | null;
  groupId: string;
  setGroupId: (id: string) => void;
  isRegistered: boolean;
  isRegistering: boolean;
  login: () => void;
  registerProfile: (customName?: string) => Promise<{ success: boolean; message?: string }>;
}

const LiffContext = createContext<LiffContextType>({
  isInitialized: false,
  isLoggedIn: false,
  isInClient: false,
  profile: null,
  groupId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  setGroupId: () => {},
  isRegistered: false,
  isRegistering: false,
  login: () => {},
  registerProfile: async () => ({ success: false }),
});

export const useLiff = () => useContext(LiffContext);

export function LiffProvider({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInClient, setIsInClient] = useState(false);
  const [profile, setProfile] = useState<{
    userId: string;
    displayName: string;
    pictureUrl?: string;
  } | null>(null);
  const [groupId, setGroupId] = useState("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
  const [isRegistered, setIsRegistered] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const login = useCallback(async () => {
    try {
      if (typeof window !== "undefined") {
        const liff = (await import("@line/liff")).default;
        if (!liff.isLoggedIn()) {
          liff.login();
        }
      }
    } catch (e) {
      console.warn("[LiffProvider] Login failed:", e);
    }
  }, []);

  const registerProfile = useCallback(
    async (customName?: string) => {
      if (!profile?.userId) {
        return { success: false, message: "ไม่พบข้อมูล LINE User ID" };
      }

      setIsRegistering(true);
      try {
        const finalName = customName?.trim() || profile.displayName;
        const res = await fetch("/api/auth/register-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lineUserId: profile.userId,
            displayName: finalName,
            pictureUrl: profile.pictureUrl,
            groupId: groupId !== "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" ? groupId : undefined,
          }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          setIsRegistered(true);
          setProfile((prev) =>
            prev ? { ...prev, displayName: finalName } : null
          );
          return {
            success: true,
            message: data.message || "ลงทะเบียนสำเร็จ",
          };
        } else {
          return {
            success: false,
            message: data.error || "เกิดข้อผิดพลาดในการลงทะเบียน",
          };
        }
      } catch (err: any) {
        return {
          success: false,
          message: err?.message || "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้",
        };
      } finally {
        setIsRegistering(false);
      }
    },
    [profile, groupId]
  );

  useEffect(() => {
    // Check URL parameters for groupId or lineGroupId
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const urlGroupId = urlParams.get("groupId");
      const urlLineGroupId = urlParams.get("lineGroupId");

      if (urlGroupId) {
        setGroupId(urlGroupId);
      } else if (urlLineGroupId) {
        fetch(`/api/groups?lineGroupId=${encodeURIComponent(urlLineGroupId)}`)
          .then((res) => res.json())
          .then((data) => {
            if (data?.group?.id) {
              setGroupId(data.group.id);
            }
          })
          .catch((err) =>
            console.warn("[LiffProvider] Failed to resolve lineGroupId:", err)
          );
      }
    }

    // Initialize LIFF or Fallback Mock in Browser
    const initLiff = async () => {
      try {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
        if (
          typeof window !== "undefined" &&
          liffId &&
          liffId !== "your_liff_id_here"
        ) {
          const liff = (await import("@line/liff")).default;
          await liff.init({ liffId });
          setIsInClient(liff.isInClient());

          if (liff.isLoggedIn()) {
            const p = await liff.getProfile();
            const realProfile = {
              userId: p.userId,
              displayName: p.displayName,
              pictureUrl: p.pictureUrl,
            };
            setProfile(realProfile);
            setIsInitialized(true);

            // Auto-sync profile to Supabase on login
            fetch("/api/auth/register-profile", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                lineUserId: p.userId,
                displayName: p.displayName,
                pictureUrl: p.pictureUrl,
              }),
            })
              .then((res) => res.json())
              .then((data) => {
                if (data.success) {
                  setIsRegistered(true);
                }
              })
              .catch((e) => console.warn("[LiffProvider] Background sync error:", e));

            return;
          }
        }
      } catch (e) {
        console.warn("[LiffProvider] LIFF init skipped or fallback mock active:", e);
      }

      // Default mock profile for local development & browser preview
      setProfile({
        userId: "U_OWNER_001",
        displayName: "Alice (Owner)",
        pictureUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=Alice",
      });
      setIsInitialized(true);
    };

    initLiff();
  }, []);

  return (
    <LiffContext.Provider
      value={{
        isInitialized,
        isLoggedIn: !!profile,
        isInClient,
        profile,
        groupId,
        setGroupId,
        isRegistered,
        isRegistering,
        login,
        registerProfile,
      }}
    >
      {children}
    </LiffContext.Provider>
  );
}

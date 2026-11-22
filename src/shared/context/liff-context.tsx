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
  userRole: string | null;
  isOwner: boolean;
  login: () => void;
  registerProfile: (customName?: string) => Promise<{ success: boolean; message?: string }>;
}

const LiffContext = createContext<LiffContextType>({
  isInitialized: false,
  isLoggedIn: false,
  isInClient: false,
  profile: null,
  groupId: "",
  setGroupId: () => {},
  isRegistered: false,
  isRegistering: false,
  userRole: null,
  isOwner: false,
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
  const [groupId, setGroupId] = useState("");
  const [isRegistered, setIsRegistered] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Sync current user's role whenever groupId or profile changes
  useEffect(() => {
    if (!groupId || !profile?.userId) return;
    fetch(`/api/members?groupId=${groupId}`)
      .then((r) => r.json())
      .then((data) => {
        const current = (data?.members || []).find(
          (m: any) => m.profiles?.line_user_id === profile.userId
        );
        if (current?.role) {
          setUserRole(current.role);
        }
      })
      .catch(() => {});
  }, [groupId, profile?.userId]);

  const isOwner = userRole === "owner";

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
            groupId: groupId || undefined,
          }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          setIsRegistered(true);
          const updatedProfile = {
            userId: profile.userId,
            displayName: finalName,
            pictureUrl: profile.pictureUrl,
          };
          setProfile(updatedProfile);

          if (typeof window !== "undefined") {
            localStorage.setItem("bank_buddy_profile", JSON.stringify(updatedProfile));
            if (data.member?.group_id) {
              setGroupId(data.member.group_id);
              localStorage.setItem("bank_buddy_group_id", data.member.group_id);
            }
          }

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
    let activeGroupId = "";

    // 1. Check URL parameters
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const urlGroupId = urlParams.get("groupId");
      const urlLineGroupId = urlParams.get("lineGroupId");

      if (urlGroupId) {
        activeGroupId = urlGroupId;
        setGroupId(urlGroupId);
        localStorage.setItem("bank_buddy_group_id", urlGroupId);
      } else if (urlLineGroupId) {
        fetch(`/api/groups?lineGroupId=${encodeURIComponent(urlLineGroupId)}`)
          .then((res) => res.json())
          .then((data) => {
            if (data?.group?.id) {
              setGroupId(data.group.id);
              localStorage.setItem("bank_buddy_group_id", data.group.id);
            }
          })
          .catch((err) =>
            console.warn("[LiffProvider] Failed to resolve lineGroupId:", err)
          );
      } else {
        const savedGroupId = localStorage.getItem("bank_buddy_group_id");
        if (savedGroupId) {
          activeGroupId = savedGroupId;
          setGroupId(savedGroupId);
        }
      }

      // Check saved local profile
      const savedProfile = localStorage.getItem("bank_buddy_profile");
      if (savedProfile) {
        try {
          const parsed = JSON.parse(savedProfile);
          if (parsed?.userId) {
            setProfile(parsed);
            setIsRegistered(true);
          }
        } catch {
          // ignore corrupted local storage
        }
      }
    }

    // 2. Discover Real Active Group from Backend
    fetch("/api/groups" + (activeGroupId ? `?groupId=${activeGroupId}` : ""))
      .then((res) => res.json())
      .then((data) => {
        if (data?.group?.id) {
          setGroupId(data.group.id);
          if (typeof window !== "undefined") {
            localStorage.setItem("bank_buddy_group_id", data.group.id);
          }

          // If in external browser and no saved profile, auto-adopt owner's profile
          if (
            data.group?.profiles?.line_user_id &&
            typeof window !== "undefined" &&
            !localStorage.getItem("bank_buddy_profile")
          ) {
            const ownerProf = {
              userId: data.group.profiles.line_user_id,
              displayName: data.group.profiles.display_name,
              pictureUrl: data.group.profiles.picture_url,
            };
            setProfile(ownerProf);
            setIsRegistered(true);
            localStorage.setItem("bank_buddy_profile", JSON.stringify(ownerProf));
          }
        }
      })
      .catch((e) => console.warn("[LiffProvider] Auto group discovery:", e));

    // 3. Initialize LIFF
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
            setIsRegistered(true);
            setIsInitialized(true);

            if (typeof window !== "undefined") {
              localStorage.setItem("bank_buddy_profile", JSON.stringify(realProfile));
            }

            // Sync with backend
            fetch("/api/auth/register-profile", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                lineUserId: p.userId,
                displayName: p.displayName,
                pictureUrl: p.pictureUrl,
              }),
            }).catch((e) => console.warn("[LiffProvider] Sync error:", e));

            return;
          }
        }
      } catch (e) {
        console.warn("[LiffProvider] LIFF init skipped or fallback mock active:", e);
      }

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
        userRole,
        isOwner,
        login,
        registerProfile,
      }}
    >
      {children}
    </LiffContext.Provider>
  );
}

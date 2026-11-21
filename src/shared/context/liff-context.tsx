"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export interface LiffContextType {
  isInitialized: boolean;
  isLoggedIn: boolean;
  profile: {
    userId: string;
    displayName: string;
    pictureUrl?: string;
  } | null;
  groupId: string;
  setGroupId: (id: string) => void;
}

const LiffContext = createContext<LiffContextType>({
  isInitialized: false,
  isLoggedIn: false,
  profile: null,
  groupId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  setGroupId: () => {},
});

export const useLiff = () => useContext(LiffContext);

export function LiffProvider({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [profile, setProfile] = useState<{
    userId: string;
    displayName: string;
    pictureUrl?: string;
  } | null>(null);
  const [groupId, setGroupId] = useState("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

  useEffect(() => {
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
          if (liff.isLoggedIn()) {
            const p = await liff.getProfile();
            setProfile({
              userId: p.userId,
              displayName: p.displayName,
              pictureUrl: p.pictureUrl,
            });
            setIsInitialized(true);
            return;
          }
        }
      } catch (e) {
        console.warn("[LiffProvider] LIFF init skipped or fallback mock active:", e);
      }

      // Default mock profile for local development & preview
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
        profile,
        groupId,
        setGroupId,
      }}
    >
      {children}
    </LiffContext.Provider>
  );
}

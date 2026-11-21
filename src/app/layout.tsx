import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bank Buddy (Money Pool)",
  description: "LINE Mini App & Bot for Group Financial Management",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body className="antialiased min-h-screen bg-slate-50">{children}</body>
    </html>
  );
}

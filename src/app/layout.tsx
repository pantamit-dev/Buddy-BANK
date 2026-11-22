import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/shared/context/theme-context";

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai"],
  variable: "--font-noto-sans-thai",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bank Buddy — เพื่อนพึ่งพายามยาก",
  description: "LINE Mini App & Bot for Group Financial Management and Savings",
  icons: {
    icon: "/logo.svg",
    apple: "/logo.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F9F7" },
    { media: "(prefers-color-scheme: dark)", color: "#101815" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" suppressHydrationWarning className={notoSansThai.variable}>
      <head>
        <meta name="color-scheme" content="light dark" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('bank-buddy-theme') || 'system';
                  var isDark = saved === 'dark' || (saved === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
                  var meta = document.querySelector('meta[name="color-scheme"]');
                  if (meta) {
                    meta.content = saved === 'system' ? 'light dark' : (isDark ? 'dark' : 'light');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased min-h-screen bg-page text-text-primary selection:bg-brand-soft selection:text-brand-strong">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

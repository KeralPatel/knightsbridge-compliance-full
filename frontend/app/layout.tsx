import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { AppNav } from "@/components/layout/AppNav";
import { AppSidebar } from "@/components/layout/AppSidebar";

export const metadata: Metadata = {
  title: {
    default: "Knightsbridge Compliance Centre",
    template: "%s | KCC",
  },
  description:
    "Blockchain compliance intelligence platform. Detect scams, analyze wallet risk, identify rug-pulls.",
  keywords: ["blockchain compliance", "crypto security", "rug pull detection", "wallet risk", "scam detection"],
  authors: [{ name: "Knightsbridge" }],
  robots: "index, follow",
  openGraph: {
    title: "Knightsbridge Compliance Centre",
    description: "Enterprise-grade blockchain compliance and risk intelligence",
    type: "website",
    siteName: "KCC",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-text-primary font-sans antialiased">
        <div className="flex h-screen overflow-hidden">
          {/* Sidebar */}
          <AppSidebar />

          {/* Main content */}
          <div className="flex flex-col flex-1 overflow-hidden">
            <AppNav />
            <main className="flex-1 overflow-y-auto grid-bg">
              {children}
            </main>
          </div>
        </div>

        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#12121e",
              color: "#e2e8f0",
              border: "1px solid #1e1e30",
              borderRadius: "8px",
              fontSize: "14px",
            },
            success: { iconTheme: { primary: "#22c55e", secondary: "#0a0a0f" } },
            error: { iconTheme: { primary: "#ef4444", secondary: "#0a0a0f" } },
          }}
        />
      </body>
    </html>
  );
}

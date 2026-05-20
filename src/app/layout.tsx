import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "DORA Third-Party Register & Resilience Workbench",
  description: "Compliance MVP for CASPs and EMIs aligning vendor contracts to DORA Article 30(2) requirements.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="app-container">
          <Suspense fallback={<div style={{ padding: "2rem", color: "var(--text-muted)", fontSize: "0.85rem" }}>Loading scope...</div>}>
            <Sidebar />
          </Suspense>
          <main className="main-content">{children}</main>
        </div>
      </body>
    </html>
  );
}


import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/styles.css";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";

/**
 * Load Inter via next/font — self-hosted, zero layout shift,
 * replaces the browser-default font fallback in styles.css.
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Clickmasters BOS — Al Qaiser IT Company",
  description: "Internal Business Operating System for Al Qaiser IT Company.",
  keywords: ["ERP", "business", "HR", "inventory", "finance"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={inter.variable}>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}


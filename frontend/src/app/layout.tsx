import type { Metadata } from "next";
import { ReactQueryProvider } from "./providers";
import { ThemeInitializer } from "@/components/ThemeInitializer";
import "@/styles.css";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Al Qaiser IT Company",
  description: "Internal Business Operating System for Al Qaiser IT Company.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.variable}>
        <ReactQueryProvider>
          <ThemeInitializer />
          {children}
        </ReactQueryProvider>
      </body>
    </html>
  );
}
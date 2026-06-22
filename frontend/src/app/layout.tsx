import type { Metadata } from "next";
import { ReactQueryProvider } from "./providers";
import { ThemeInitializer } from "@/components/ThemeInitializer";
import "@/styles.css";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { ConfirmationProvider } from "@/contexts/ConfirmationModalContext";
import { NotificationProvider } from "@/contexts/NotificationContext";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Nexus ERP",
  description: "Internal Business Operating System for Nexus ERP.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.variable}>
        <ReactQueryProvider>
          <ThemeInitializer />
          <ConfirmationProvider>
            <NotificationProvider>
              {children}
            </NotificationProvider>
            <Toaster
              position="top-right"
              richColors
              closeButton
              duration={4000}
              theme="system"        // or "light" / "dark"
            />
          </ConfirmationProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
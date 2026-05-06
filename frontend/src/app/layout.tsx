import type { Metadata } from "next";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { CompanySettingsProvider } from "@/context/CompanySettingsContext";
import { ReactQueryProvider } from "./providers";
import "@/styles.css";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Al Qaiser IT Company",
  description: "Internal Business Operating System for Al Qaiser IT Company.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={inter.variable}>
        <ThemeProvider>
          <ReactQueryProvider>
            <AuthProvider>
              <CompanySettingsProvider>
                {children}
              </CompanySettingsProvider>
            </AuthProvider>
          </ReactQueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

import AppLayout from "@/layouts/AppLayout";
import { CompanySettingsProvider } from "@/context/CompanySettingsContext";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <CompanySettingsProvider>
      <AppLayout>{children}</AppLayout>
    </CompanySettingsProvider>
  );
}


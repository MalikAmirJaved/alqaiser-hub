

"use client";

import { ls } from "@/services/localStorageService";
import { useTheme } from "@/context/ThemeContext";
import PageHeader from "@/components/PageHeader";

export default Preferences;

function Preferences() {
  const { theme, toggle } = useTheme() as any;

  const company = ls.get<any>("company", {}) || {};

  const reset = () => {
    if (!confirm("Reset all data to seed defaults?")) return;
    ls.clearAll();
    location.reload();
  };
  return (
    <div>
      <PageHeader title="Preferences" subtitle="System configuration" />
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Theme</div>
            <div className="text-xs text-muted-foreground">Current: {theme}</div>
          </div>
          <button onClick={toggle} className="px-3 h-9 rounded-md bg-primary text-primary-foreground text-sm">
            Toggle theme
          </button>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Reset System Data</div>
            <div className="text-xs text-muted-foreground">Clears all LocalStorage and re-seeds {company.name}</div>
          </div>
          <button onClick={reset} className="px-3 h-9 rounded-md bg-destructive text-destructive-foreground text-sm">
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}


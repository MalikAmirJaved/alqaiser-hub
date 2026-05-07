"use client";
import { useEffect } from "react";
import { useThemeStore } from "@/stores/useThemeStore";

export function ThemeInitializer() {
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
  }, [theme]);

  return null;
}
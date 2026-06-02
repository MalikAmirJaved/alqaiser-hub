"use client";
import { useEffect } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";

export function ThemeInitializer() {
  const theme = useSelector((state: RootState) => state.theme.theme);

  useEffect(() => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
  }, [theme]);

  return null;
}
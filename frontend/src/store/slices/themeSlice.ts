import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type Theme = "light" | "dark";

interface ThemeState {
  theme: Theme;
}

// Safe function to validate localStorage value
const getInitialTheme = (): Theme => {
  if (typeof window === "undefined") return "dark";

  const savedTheme = localStorage.getItem("theme");

  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }

  return "dark"; // default
};

const initialState: ThemeState = {
  theme: getInitialTheme(),
};

const themeSlice = createSlice({
  name: "theme",
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<Theme>) => {
      state.theme = action.payload;

      if (typeof window !== "undefined") {
        localStorage.setItem("theme", action.payload);

        document.documentElement.classList.remove("light", "dark");
        document.documentElement.classList.add(action.payload);
      }
    },

    toggleTheme: (state) => {
      state.theme = state.theme === "dark" ? "light" : "dark";

      if (typeof window !== "undefined") {
        localStorage.setItem("theme", state.theme);

        document.documentElement.classList.remove("light", "dark");
        document.documentElement.classList.add(state.theme);
      }
    },
  },
});

export const { setTheme, toggleTheme } = themeSlice.actions;
export default themeSlice.reducer;
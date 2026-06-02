import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ThemeState {
  theme: 'light' | 'dark';
}

const initialState: ThemeState = {
  theme: (typeof window !== 'undefined' && localStorage.getItem('theme') === 'dark') ? 'dark' : 'light',
};

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.theme = action.payload;
      if (typeof window !== 'undefined') {
        localStorage.setItem('theme', action.payload);
        document.documentElement.classList.remove("light", "dark");
        document.documentElement.classList.add(action.payload);
      }
    },
    toggleTheme: (state) => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      if (typeof window !== 'undefined') {
        localStorage.setItem('theme', state.theme);
        document.documentElement.classList.remove("light", "dark");
        document.documentElement.classList.add(state.theme);
      }
    },
  },
});

export const { setTheme, toggleTheme } = themeSlice.actions;
export default themeSlice.reducer;

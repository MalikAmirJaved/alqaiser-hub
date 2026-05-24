import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { apiFetch } from "@/lib/api";
import type { CompanySettings } from "@/hooks/useCompanySettings";

interface CompanySettingsState {
  data: CompanySettings | null;
  loading: boolean;
  initialized: boolean;
}

const initialState: CompanySettingsState = {
  data: null,
  loading: false,
  initialized: false,
};

// 🔥 Fetch once globally
export const loadCompanySettings = createAsyncThunk(
  "companySettings/load",
  async () => {
    return await apiFetch<CompanySettings>("/api/company/settings/");
  }
);

const companySettingsSlice = createSlice({
  name: "companySettings",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadCompanySettings.pending, (state) => {
        state.loading = true;
      })
      .addCase(loadCompanySettings.fulfilled, (state, action) => {
        state.data = action.payload;
        state.loading = false;
        state.initialized = true;
      })
      .addCase(loadCompanySettings.rejected, (state) => {
        state.loading = false;
        state.initialized = true;
      });
  },
});

export default companySettingsSlice.reducer;
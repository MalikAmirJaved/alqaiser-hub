// store/slices/companySettingsSlice.ts
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { apiFetch } from "@/lib/api";
import type { CompanySettings } from "@/hooks/useCompanySettings";

interface CompanySettingsState {
  data: CompanySettings | null;
  loading: boolean;
  initialized: boolean;
  error: string | null;
}

const initialState: CompanySettingsState = {
  data: null,
  loading: false,
  initialized: false,
  error: null,
};

export const loadCompanySettings = createAsyncThunk(
  "companySettings/load",
  async (_, { rejectWithValue }) => {
    try {
      return await apiFetch<CompanySettings>("/api/company/settings/");
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const companySettingsSlice = createSlice({
  name: "companySettings",
  initialState,
  reducers: {
    clearCompanySettings: (state) => {
      state.data = null;
      state.initialized = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadCompanySettings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadCompanySettings.fulfilled, (state, action) => {
        state.data = action.payload;
        state.loading = false;
        state.initialized = true;
        state.error = null;
      })
      .addCase(loadCompanySettings.rejected, (state, action) => {
        state.loading = false;
        state.initialized = true;
        state.error = action.payload as string;
      });
  },
});

export const { clearCompanySettings } = companySettingsSlice.actions;
export default companySettingsSlice.reducer;
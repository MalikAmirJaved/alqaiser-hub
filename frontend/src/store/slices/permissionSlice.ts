// store/slices/permissionSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { apiFetch } from '@/lib/api';

export interface ModuleNode {
  code: string;
  name: string;
  resources: {
    code: string;
    name: string;
    actions: {
      code: string;
      name: string;
      granted: boolean;
    }[];
  }[];
}

interface PermissionState {
  permissions: string[];        // list of permission codes, e.g., 'hr:employee:view'
  modules: ModuleNode[];        // full module-resource-action tree
  loading: boolean;
  initialized: boolean;
}

const initialState: PermissionState = {
  permissions: [],
  modules: [],
  loading: false,
  initialized: false,
};

// Async thunk to load permissions and modules
export const loadPermissions = createAsyncThunk(
  'permissions/load',
  async (_, { rejectWithValue }) => {
    try {
      const [permissions, modules] = await Promise.all([
        apiFetch<string[]>('/api/permissions/me/'),
        apiFetch<ModuleNode[]>('/api/permissions/modules/'),
      ]);
      return { permissions, modules };
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const permissionSlice = createSlice({
  name: 'permissions',
  initialState,
  reducers: {
    clearPermissions: (state) => {
      state.permissions = [];
      state.modules = [];
      state.initialized = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadPermissions.pending, (state) => {
        state.loading = true;
      })
      .addCase(loadPermissions.fulfilled, (state, action) => {
        state.permissions = action.payload.permissions;
        state.modules = action.payload.modules;
        state.loading = false;
        state.initialized = true;
      })
      .addCase(loadPermissions.rejected, (state) => {
        state.loading = false;
        state.initialized = true; // still mark as initialized to avoid infinite loops
      });
  },
});

export const { clearPermissions } = permissionSlice.actions;
export default permissionSlice.reducer;
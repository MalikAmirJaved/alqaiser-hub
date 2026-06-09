import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: typeof window !== 'undefined' ? localStorage.getItem('isAuthenticated') === 'true' : false,
  isInitialized: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User | null>) => {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
      state.isInitialized = true;
      if (action.payload) {
        localStorage.setItem('isAuthenticated', 'true');
      } else {
        localStorage.removeItem('isAuthenticated');
      }
    },
    setUnauthenticated: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.isInitialized = true;
      localStorage.removeItem('isAuthenticated');
    },
    setInitialized: (state) => {
      state.isInitialized = true;
    }
  },
});

export const { setUser, setUnauthenticated, setInitialized } = authSlice.actions;
export default authSlice.reducer;

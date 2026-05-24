import { configureStore, combineReducers } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import themeReducer from "./slices/themeSlice";
import permissionReducer from "./slices/permissionSlice";

const appReducer = combineReducers({
  auth: authReducer,
  theme: themeReducer,
  permissions: permissionReducer,
});

const rootReducer = (state: any, action: any) => {
  if (action.type === "RESET_APP") {
    state = undefined; // 👈 nukes everything
  }

  return appReducer(state, action);
};

export const store = configureStore({
  reducer: rootReducer,
});


export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
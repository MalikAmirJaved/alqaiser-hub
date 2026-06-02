import { AnyAction } from "@reduxjs/toolkit";

const RESET_APP = "RESET_APP";

export const resetApp = (): AnyAction => ({
  type: RESET_APP,
});

export const rootResetReducer = (state: any, action: AnyAction) => {
  if (action.type === RESET_APP) {
    return undefined; // 👈 this wipes entire Redux store
  }
  return state;
};
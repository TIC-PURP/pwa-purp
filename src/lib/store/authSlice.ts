// src/lib/store/authSlice.ts
import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { localdb } from "../pouch/localdb";
import { RootState } from "./index";

interface AuthState {
  user: any | null;
  token: string | null;
  role: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const initialState: AuthState = {
  user: null,
  token: null,
  role: null,
  isAuthenticated: false,
  isLoading: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    loginRequest: (state) => {
      state.isLoading = true;
    },
    loginSuccess: (state, action: PayloadAction<{ user: any; token: string; role: string }>) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.role = action.payload.role;
      state.isAuthenticated = true;
      state.isLoading = false;
    },
    loginFailure: (state) => {
      state.isAuthenticated = false;
      state.isLoading = false;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.role = null;
      state.isAuthenticated = false;
      state.isLoading = false;

      try {
        localdb.destroy().then(() => {
          console.log("PouchDB local borrado en logout.");
        });
      } catch (error) {
        console.error("Error limpiando PouchDB en logout:", error);
      }

      if (typeof window !== "undefined") {
        sessionStorage.clear();
        localStorage.removeItem("authSession");
      }
    },
  },
});

export const { loginRequest, loginSuccess, loginFailure, logout } = authSlice.actions;
export const selectAuth = (state: RootState) => state.auth;
export default authSlice.reducer;

import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";

// Store de Redux con el slice de autenticación
export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ["persist/PERSIST"],
      },
    }),
});

// Tipos auxiliares
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

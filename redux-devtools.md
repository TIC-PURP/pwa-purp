# Activar Redux DevTools

1. Asegúrate de tener esta extensión instalada en Chrome o Firefox:
   https://github.com/zalmoxisus/redux-devtools-extension

2. Modifica tu `store.ts` para incluir lo siguiente:

```ts
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
  devTools: process.env.NODE_ENV !== "production",
});
```

3. ¡Listo! Ahora puedes ver el estado de Redux desde la extensión.

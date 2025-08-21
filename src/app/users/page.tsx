// src/app/users/page.tsx
"use client";

import { useDispatch } from "react-redux";
import { loginSuccess } from "@/lib/store/authSlice";

export default function UsersPage() {
  const dispatch = useDispatch();
  const addUser = () => {
    const dummyUser = { user: { email: "nuevo@purp.com" }, token: "demo", role: "user" };
    dispatch(loginSuccess(dummyUser));
  };
  return (
    <div className="p-4">
      <h2>Gestión de usuarios</h2>
      <button onClick={addUser} className="bg-blue-500 px-4 py-2 text-white rounded">
        Crear usuario de prueba
      </button>
    </div>
  );
}

// src/components/layout/navbar.tsx
"use client";

import { useDispatch } from "react-redux";
import { logout } from "@/lib/store/authSlice";

export default function Navbar() {
  const dispatch = useDispatch();

  const handleLogout = () => {
    dispatch(logout());
  };

  return (
    <nav className="p-4 bg-gray-800 text-white flex justify-between">
      <h1 className="text-lg font-bold">PWA PURP</h1>
      <button onClick={handleLogout} className="bg-red-500 px-4 py-2 rounded">
        Cerrar sesión
      </button>
    </nav>
  );
}

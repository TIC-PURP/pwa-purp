"use client";

// Barra de navegaciÃ³n superior con rol y menÃº de usuario (avatar)
import { useEffect, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useRouter } from "next/navigation";
import { logoutUser } from "@/lib/store/authSlice";
import { LogOut, Settings, Moon, Sun, Download, Trash } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export function Navbar() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { user } = useAppSelector((state) => state.auth);

  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!open) return;
      const t = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(t)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Cerrar con Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    const onPrompt = (e: any) => {
      e.preventDefault();
      setDeferred(e);
      setCanInstall(true);
    };
    const onInstalled = () => { setInstalled(true); setDeferred(null); setCanInstall(false); };
    window.addEventListener("beforeinstallprompt", onPrompt as any);
    window.addEventListener("appinstalled", onInstalled as any);
    const isStandalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || (navigator as any).standalone;
    if (isStandalone) setInstalled(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt as any);
      window.removeEventListener("appinstalled", onInstalled as any);
    };
  }, []);
  const initials = (user?.name || user?.email || "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

  const toggleTheme = () => {
    if (typeof document !== "undefined") {
      const html = document.documentElement;
      if (html.classList.contains("dark")) {
        html.classList.remove("dark");
        setDark(false);
        localStorage.setItem("theme", "light");
      } else {
        html.classList.add("dark");
        setDark(true);
        localStorage.setItem("theme", "dark");
      }
    }
  };

  const [canInstall, setCanInstall] = useState(false);
  const [deferred, setDeferred] = useState<any>(null);
  const [installed, setInstalled] = useState<boolean>(false);
  const handleInstall = async () => {
    try {
      if (deferred) {
        deferred.prompt();
        const choice = await deferred.userChoice;
        if (choice?.outcome === "accepted") {
          setInstalled(true); setCanInstall(false); setDeferred(null);
        }
      } else {
        alert("Para instalar, usa el menu del navegador (Anadir a la pantalla de inicio).");
      }
    } catch {}
  };

    const handleUninstall = () => {
    try {
      const ua = (navigator.userAgent || navigator.vendor || (window as any).opera || "").toLowerCase();
      const isIOS = /iphone|ipad|ipod/.test(ua) || (navigator.platform||"").toLowerCase().includes("mac") && ('ontouchend' in document);
      const isAndroid = /android/.test(ua);
      const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || (navigator as any).standalone;
      if (isIOS) {
        alert("iOS: Mantenga presionado el icono en la pantalla de inicio y pulse 'Eliminar app'.\nTambien puedes hacerlo desde Ajustes > General > Almacenamiento del iPhone.");
        return;
      }
      if (isAndroid) {
        alert("Android: Mantenga presionado el icono y pulse 'Desinstalar'.\nSi la abriste como app, usa el menu de tres puntos en la barra superior > 'Desinstalar app'.");
        return;
      }
      if (isStandalone) {
        alert("Escritorio: En la ventana de la app, abre el menu (tres puntos) y elige 'Desinstalar app'.\nEn Chrome: Ajustes > Apps > Administrar apps > Eliminar.\nEn Edge: Configuracion > Apps > Eliminar.");
      } else {
        alert("Para desinstalar desde escritorio, si instalaste la app: abre el menu del navegador (Chrome/Edge) > Apps > Administrar apps > Eliminar.");
      }
    } catch {
      alert("Consulta como desinstalar la app desde tu sistema o navegador.");
    }
  };

  return (
    <nav className="bg-background shadow-sm border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <div className="flex-shrink-0">
              <Link href="/" aria-label="Ir al inicio" className="inline-flex items-center">
                <Image
                  src="/icons/Espiga.png"
                  alt="Logo"
                  width={56}
                  height={56}
                  priority
                  className="h-14 w-14 object-contain"
                />
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-3 relative" ref={menuRef}>
            <span className="text-xs bg-secondary px-2 py-1 rounded-full text-secondary-foreground">
              {user?.role}
            </span>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={open}
              aria-controls="user-menu"
              onClick={() => setOpen((v) => !v)}
              className="h-9 w-9 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center overflow-hidden focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {(user as any)?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={(user as any).avatarUrl} alt={user?.name || "avatar"} className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs font-semibold text-foreground">{initials}</span>
              )}
            </button>

            {open && (
              <div id="user-menu" role="menu" className="absolute right-0 top-12 w-64 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl z-50">
                <div className="px-4 py-3 border-b">
                  <p className="text-sm font-semibold text-foreground truncate">{user?.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
                <div className="p-2">
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground text-sm"
                    onClick={() => { setOpen(false); router.push("/account"); }}
                  >
                    <Settings className="h-4 w-4" /> Mi cuenta
                  </button>
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground text-sm"
                    onClick={() => { setOpen(false); installed ? handleUninstall() : handleInstall(); }}
                    disabled={!installed && !canInstall}
                  >
                    {installed ? <Trash className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                    {installed ? 'Desinstalar app' : 'Instalar app'}
                  </button>
                  <button
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground text-sm"
                    onClick={toggleTheme}
                    aria-pressed={dark}
                  >
                    <span className="inline-flex items-center gap-2">
                      {dark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                      Tema {dark ? 'oscuro' : 'claro'}
                    </span>
                    <span
                      className={`h-5 w-9 rounded-full transition-colors ${dark ? 'bg-indigo-600' : 'bg-muted'}`}
                      role="switch"
                      aria-checked={dark}
                    >
                      <span className={`block h-5 w-5 bg-background rounded-full shadow transform transition-transform ${dark ? 'translate-x-4' : ''}`}></span>
                    </span>
                  </button>
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground text-sm"
                    onClick={async () => { setOpen(false); await dispatch(logoutUser()); router.push("/auth/login"); }}
                  >
                    <LogOut className="h-4 w-4" />
                    Cerrar sesión
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;







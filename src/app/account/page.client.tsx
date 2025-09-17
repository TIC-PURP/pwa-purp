"use client";

import { Navbar } from "@/components/layout/navbar";
import { RouteGuard } from "@/components/auth/route-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { useEffect, useRef, useState } from "react";
import { updateUser, saveUserAvatar, deleteUserAvatar } from "@/lib/database";
import { setUser } from "@/lib/store/authSlice";
import { notify } from "@/lib/notify";
import BackButton from "@/components/common/back-button";
import { Camera, Image as ImageIcon, Trash2, Pencil, X, Crop } from "lucide-react";

export default function AccountPage() {
  const { user } = useAppSelector((s) => s.auth);
  const dispatch = useAppDispatch();
  const [preview, setPreview] = useState<string | null>(null);
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ dragging: boolean; startX: number; startY: number; ox: number; oy: number }>({ dragging: false, startX: 0, startY: 0, ox: 0, oy: 0 });
  const fileRefGallery = useRef<HTMLInputElement | null>(null);
  const fileRefUser = useRef<HTMLInputElement | null>(null);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [avatarActionsOpen, setAvatarActionsOpen] = useState(false);
  const [avatarClosing, setAvatarClosing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [theme, setTheme] = useState<string>("light");
  const initialAvatarRef = useRef<string | null>(null);
  const AVATAR_SIZE = 192; // tamaño final del avatar (px)

  useEffect(() => {
    const curr = (user as any)?.avatarUrl || null;
    setPreview(curr);
    initialAvatarRef.current = curr;
    const stored = (typeof window !== "undefined" && window.localStorage.getItem("theme")) || "";
    const initial = stored || (document.documentElement.classList.contains("dark") ? "dark" : "light");
    setTheme(initial);
  }, [user]);

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const src = String(reader.result || "");
      try {
        // Crear imagen para medir ratio y decidir flujo
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const im = new Image();
          im.onload = () => resolve(im);
          im.onerror = reject;
          im.src = src;
        });
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        const ratio = w && h ? w / h : 1;

        const target = AVATAR_SIZE;
        const needsCrop = ratio > 1.6 || ratio < 0.625; // panorámica o muy vertical
        if (!needsCrop) {
          // Auto center-crop 1:1 y guardar preview; no abrir recortador
          const canvas = document.createElement("canvas");
          canvas.width = target; canvas.height = target;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            // @ts-ignore
            ctx.imageSmoothingQuality = "high";
            const r = Math.max(target / w, target / h);
            const dw = w * r, dh = h * r;
            const dx = (target - dw) / 2, dy = (target - dh) / 2;
            ctx.drawImage(img, dx, dy, dw, dh);
            let dataUrl = "";
            try { dataUrl = canvas.toDataURL("image/webp", 0.8); if (!dataUrl.startsWith("data:image/webp")) throw new Error(); }
            catch { dataUrl = canvas.toDataURL("image/jpeg", 0.85); }
            setPreview(dataUrl);
            setDirty(true);
          } else {
            // Fallback: abrir recortador si no hay contexto canvas
            setRawImage(src);
            setScale(1);
            setOffset({ x: 0, y: 0 });
            setAvatarActionsOpen(false);
            setAvatarPickerOpen(false);
            setCropOpen(true);
          }
          // cerrar overlay si estaba abierto
          setAvatarActionsOpen(false);
          setAvatarPickerOpen(false);
        } else {
          // Abrir recortador para que el usuario ajuste
          setRawImage(src);
          setScale(1);
          setOffset({ x: 0, y: 0 });
          setAvatarActionsOpen(false);
          setAvatarPickerOpen(false);
          setCropOpen(true);
        }
      } catch {
        // Si falla la carga, abrir recortador como último recurso
        setRawImage(src);
        setScale(1);
        setOffset({ x: 0, y: 0 });
        setAvatarActionsOpen(false);
        setAvatarPickerOpen(false);
        setCropOpen(true);
      }
    };
    reader.readAsDataURL(file);
  };

  const openCropWithImage = (imgSrc: string | null) => {
    if (!imgSrc) return;
    setRawImage(imgSrc);
    setScale(1);
    setOffset({ x: 0, y: 0 });
    // cerrar overlay con animación y abrir recorte luego
    setAvatarActionsOpen(false);
    setAvatarPickerOpen(false);
    setTimeout(() => setCropOpen(true), 200);
  };

  const mimeSupported = (canvas: HTMLCanvasElement, type: string) => {
    try {
      const url = canvas.toDataURL(type, 0.8);
      return url.startsWith(`data:${type}`);
    } catch {
      return false;
    }
  };

  const applyCrop = () => {
    if (!rawImage || !imgRef.current) { setCropOpen(false); return; }
    const img = imgRef.current;
    const target = AVATAR_SIZE;
    const canvas = document.createElement("canvas");
    canvas.width = target;
    canvas.height = target;
    const ctx = canvas.getContext("2d");
    if (!ctx) { setCropOpen(false); return; }
    // calcular dimensiones dibujadas
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    // offset indica el desplazamiento desde el centro del cuadro
    const cx = target / 2 + offset.x;
    const cy = target / 2 + offset.y;
    // dibujar imagen escalada y trasladada dentro del canvas
    ctx.save();
    // @ts-ignore
    ctx.imageSmoothingQuality = "high";
    ctx.translate(cx, cy);
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
    // Intentar WEBP, si no, JPEG
    let dataUrl = "";
    if (mimeSupported(canvas, "image/webp")) {
      dataUrl = canvas.toDataURL("image/webp", 0.8);
    } else {
      dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    }
    setPreview(dataUrl);
    setDirty(true);
    setCropOpen(false);
    setAvatarPickerOpen(false);
  };

  const handleDeleteAvatar = async () => {
    if (!user) return;
    try {
      await deleteUserAvatar(user.email || user.name);
      try { (window as any).__avatarUrl && URL.revokeObjectURL((window as any).__avatarUrl); } catch {}
      const updated = { ...(user as any) };
      delete (updated as any).avatarUrl;
      try { await updateUser({ ...user, hasAvatar: false }); } catch {}
      dispatch(setUser(updated as any));
      setPreview(null);
      setAvatarPickerOpen(false);
      setAvatarActionsOpen(false);
      setDirty(false);
      notify.success("Avatar eliminado");
    } catch {
      notify.error("No se pudo eliminar el avatar");
    }
  };

  const onDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    const p = 'touches' in e ? e.touches[0] : (e as any);
    dragRef.current = { dragging: true, startX: p.clientX, startY: p.clientY, ox: offset.x, oy: offset.y };
  };
  const onDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!dragRef.current.dragging) return;
    const p = 'touches' in e ? e.touches[0] : (e as any);
    const dx = p.clientX - dragRef.current.startX;
    const dy = p.clientY - dragRef.current.startY;
    setOffset({ x: dragRef.current.ox + dx, y: dragRef.current.oy + dy });
  };
  const onDragEnd = () => { dragRef.current.dragging = false; };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      // Guardar avatar como attachment (local-first y best-effort remoto)
      if (preview) {
        const blob = await fetch(preview).then(r => r.blob());
        await saveUserAvatar(user.email || user.name, blob, blob.type || "image/jpeg");
        // Actualizar store con ObjectURL fresco
        try { (window as any).__avatarUrl && URL.revokeObjectURL((window as any).__avatarUrl); } catch {}
        (user as any).avatarUrl = URL.createObjectURL(blob);
        // Persistir doc (sin avatarUrl) para updatedAt/hasAvatar coherentes
        try { await updateUser({ ...user, hasAvatar: true }); } catch {}
        dispatch(setUser({ ...(user as any), avatarUrl: (user as any).avatarUrl } as any));
        notify.success("Perfil actualizado");
      }
      setDirty(false);
    } catch {
      notify.error("No se pudo guardar tu perfil");
    } finally {
      setIsSaving(false);
    }
  };

  // Guardado automático cuando cambia la foto y hay cambios
  useEffect(() => {
    if (!dirty) return;
    if (preview === initialAvatarRef.current) return;
    // Debounce ligero para evitar múltiples llamadas
    const t = setTimeout(() => { handleSave().catch(() => {}); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview, dirty]);

  const applyTheme = (next: "dark" | "light") => {
    setTheme(next);
    if (next === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    try { window.localStorage.setItem("theme", next); } catch {}
  };

  // Cierre con tecla ESC del overlay de avatar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && avatarPickerOpen) {
        e.preventDefault();
        startCloseAvatar();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [avatarPickerOpen]);

  const startCloseAvatar = () => {
    setAvatarActionsOpen(false);
    setAvatarClosing(true);
    setTimeout(() => {
      setAvatarPickerOpen(false);
      setAvatarClosing(false);
    }, 200);
  };

  return (
    <RouteGuard>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="max-w-3xl mx-auto py-6 px-4 space-y-6">
          <div className="mb-2"><BackButton /></div>
          <Card>
            <CardHeader>
              <CardTitle>Mi cuenta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <section className="space-y-4">
                <h2 className="text-sm font-semibold text-foreground">Foto de perfil</h2>
                <div className="flex items-center gap-4">
                  <div className="h-20 w-20 rounded-full bg-muted overflow-hidden flex items-center justify-center cursor-pointer ring-0 hover:ring-2 ring-ring transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" title="Editar foto de perfil" role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAvatarPickerOpen(true); setAvatarActionsOpen(false); } }} onClick={() => { setAvatarPickerOpen(true); setAvatarActionsOpen(false); }}>
                    {preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={preview} alt="avatar" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-sm font-semibold text-muted-foreground">
                        {(user?.name || user?.email || "?")
                          .split(" ")
                          .map((p) => p[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {/* Entradas ocultas: galeria y camara (frontal) */}
                    <input
                      type="file"
                      accept="image/*"
                      ref={fileRefGallery}
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
                    />
                    <input
                      type="file"
                      accept="image/*"
                      capture="user"
                      ref={fileRefUser}
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-foreground">Tema</h2>
                <div className="flex items-center justify-between p-3 rounded-lg border bg-card/60 text-card-foreground">
                  <span className="text-sm text-foreground">Modo oscuro</span>
                  <button
                    type="button"
                    aria-pressed={theme === 'dark'}
                    onClick={() => applyTheme(theme === 'dark' ? 'light' : 'dark')}
                    className={`h-6 w-11 rounded-full relative transition-colors ${theme === 'dark' ? 'bg-indigo-600' : 'bg-muted'}`}
                    role="switch"
                    aria-label="Cambiar tema"
                  >
                    <span className={`absolute top-0 left-0 h-6 w-6 bg-background rounded-full shadow transition-transform ${theme === 'dark' ? 'translate-x-5' : ''}`}></span>
                  </button>
                </div>
              </section>

              {/* Guardado automático; sin botón de guardar */}
            </CardContent>
          </Card>
          {cropOpen && rawImage && (
            <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/40 animate-in fade-in-0" role="dialog" aria-modal="true">
              <div className="bg-popover text-popover-foreground border border-border rounded-2xl shadow-xl w-full max-w-md p-4 space-y-4">
                <p className="text-sm font-semibold text-foreground">Ajustar recorte</p>
                <div
                  className="mx-auto h-64 w-64 rounded-xl overflow-hidden bg-muted relative touch-none select-none"
                  onMouseDown={onDragStart as any}
                  onMouseMove={onDragMove as any}
                  onMouseUp={onDragEnd}
                  onMouseLeave={onDragEnd}
                  onTouchStart={onDragStart as any}
                  onTouchMove={onDragMove as any}
                  onTouchEnd={onDragEnd}
                >
                  {/* Fondo de damero suave */}
                  <div className="absolute inset-0 bg-[linear-gradient(45deg,#f1f5f9_25%,transparent_25%),linear-gradient(-45deg,#f1f5f9_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f1f5f9_75%),linear-gradient(-45deg,transparent_75%,#f1f5f9_75%)] bg-[length:16px_16px] opacity-50" />
                  {/* Imagen posicionada por transform */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    ref={imgRef}
                    src={rawImage}
                    alt="crop"
                    className="absolute top-1/2 left-1/2 will-change-transform"
                    style={{ transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
                  />
                </div>
                <div className="px-1">
                  <input
                    type="range"
                    min={0.8}
                    max={3}
                    step={0.01}
                    value={scale}
                    onChange={(e) => setScale(parseFloat(e.target.value))}
                    className="w-full"
                    aria-label="Zoom"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setCropOpen(false); setRawImage(null); }}>Cancelar</Button>
                  <Button onClick={applyCrop}>Aplicar</Button>
                </div>
              </div>
            </div>
          )}
          {avatarPickerOpen && (
            <div
              className={`fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/40 ${avatarClosing ? 'animate-out fade-out-0' : 'animate-in fade-in-0'}`}
              role="dialog"
              aria-modal="true"
              onClick={startCloseAvatar}
            >
              <div
                className={`relative ${avatarClosing ? 'animate-out fade-out-0 zoom-out-95 duration-200' : 'animate-in fade-in-0 zoom-in-95 duration-200'}`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="h-64 w-64 rounded-full overflow-hidden ring-2 ring-ring bg-muted flex items-center justify-center shadow-xl">
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt="avatar grande" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-6xl font-bold text-muted-foreground">
                      {(user?.name || user?.email || "?")
                        .split(" ")
                        .map((p) => p[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>
                  )}
                </div>
                {/* Botón cerrar */}
                <button
                  type="button"
                  aria-label="Cerrar"
                  className="absolute top-2 left-2 h-10 w-10 rounded-full bg-background/90 backdrop-blur border border-border flex items-center justify-center shadow hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={startCloseAvatar}
                >
                  <X className="h-5 w-5" />
                </button>
                {preview ? (
                  <>
                    <button
                      type="button"
                      aria-label="Editar avatar"
                      className="absolute top-2 right-2 h-10 w-10 rounded-full bg-background/90 backdrop-blur border border-border flex items-center justify-center shadow-lg hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => setAvatarActionsOpen((v) => !v)}
                    >
                      <Pencil className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Ajustar recorte"
                      className="absolute top-2 right-14 h-10 w-10 rounded-full bg-background/90 backdrop-blur border border-border flex items-center justify-center shadow-lg hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => openCropWithImage(preview)}
                    >
                      <Crop className="h-5 w-5" />
                    </button>
                    {avatarActionsOpen && (
                      <div className="absolute top-14 right-2 flex flex-col gap-2">
                        <button
                          type="button"
                          title="Eliminar"
                          className="h-10 w-10 rounded-full bg-background/90 backdrop-blur border border-border flex items-center justify-center shadow hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={handleDeleteAvatar}
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          title="Cambiar desde galería"
                          className="h-10 w-10 rounded-full bg-background/90 backdrop-blur border border-border flex items-center justify-center shadow hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => fileRefGallery.current?.click()}
                        >
                          <ImageIcon className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          title="Tomar foto"
                          className="h-10 w-10 rounded-full bg-background/90 backdrop-blur border border-border flex items-center justify-center shadow hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => fileRefUser.current?.click()}
                        >
                          <Camera className="h-5 w-5" />
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="absolute bottom-4 inset-x-0 flex justify-center gap-3">
                    <button
                      type="button"
                      title="Elegir de galería"
                      className="h-10 w-10 rounded-full bg-background/90 backdrop-blur border border-border flex items-center justify-center shadow hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => fileRefGallery.current?.click()}
                    >
                      <ImageIcon className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      title="Tomar foto"
                      className="h-10 w-10 rounded-full bg-background/90 backdrop-blur border border-border flex items-center justify-center shadow hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => fileRefUser.current?.click()}
                    >
                      <Camera className="h-5 w-5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </RouteGuard>
  );
}








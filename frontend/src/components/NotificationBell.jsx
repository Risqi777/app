import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { Bell, CheckCheck } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";

const POLL_MS = 20000;

export default function NotificationBell({ darkContext = false }) {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const lastSeenIds = useRef(new Set());
  const nav = useNavigate();
  const permissionRequested = useRef(false);

  const notify = (title, body) => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "granted") {
      try { new Notification(title, { body, icon: "/favicon.ico", tag: "shift-scheduler" }); } catch (_) {}
    }
  };

  const load = async (fireBrowser = false) => {
    try {
      const { data } = await api.get("/notifications", { params: { limit: 30 } });
      setItems(data.items || []);
      setUnread(data.unread || 0);
      if (fireBrowser) {
        const newOnes = (data.items || []).filter((n) => !n.read && !lastSeenIds.current.has(n.id));
        newOnes.forEach((n) => notify(n.title, n.message));
      }
      (data.items || []).forEach((n) => lastSeenIds.current.add(n.id));
    } catch (_) {}
  };

  useEffect(() => {
    load(false);
    if (typeof Notification !== "undefined" && Notification.permission === "default" && !permissionRequested.current) {
      permissionRequested.current = true;
      Notification.requestPermission().catch(() => {});
    }
    const t = setInterval(() => load(true), POLL_MS);
    const onVisible = () => { if (!document.hidden) load(true); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  const openItem = async (n) => {
    setOpen(false);
    try { if (!n.read) await api.patch(`/notifications/${n.id}/read`); } catch (_) {}
    load(false);
    if (n.ref_route) nav(n.ref_route);
  };

  const markAll = async () => {
    try { await api.post("/notifications/read-all"); load(false); } catch (_) {}
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          data-testid="notification-bell"
          className={cn(
            "relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors",
            darkContext
              ? "text-cyan-200 hover:bg-white/10"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800",
          )}
          aria-label="Notifikasi"
        >
          <Bell className={cn("w-5 h-5", unread > 0 && "animate-[wiggle_0.6s_ease-in-out]")} />
          {unread > 0 && (
            <span data-testid="notif-badge" className="pulse-glow absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center border border-white/60">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[340px] p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-800">
          <div className="text-sm font-semibold">Notifikasi</div>
          {unread > 0 && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={markAll} data-testid="notif-mark-all">
              <CheckCheck className="w-3.5 h-3.5 mr-1" /> Tandai semua terbaca
            </Button>
          )}
        </div>
        <div className="max-h-[360px] overflow-y-auto">
          {items.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-slate-500">Belum ada notifikasi.</div>
          )}
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => openItem(n)}
              data-testid={`notif-item-${n.id}`}
              className={cn(
                "w-full text-left px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors",
                !n.read && "bg-sky-50/70 dark:bg-sky-950/20",
              )}
            >
              <div className="flex items-start gap-2">
                <div className={cn("mt-1.5 w-2 h-2 rounded-full flex-shrink-0", n.read ? "bg-slate-300" : "bg-sky-500")} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{n.title}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">{n.message}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 font-mono-alt">{new Date(n.created_at).toLocaleString("id-ID")}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

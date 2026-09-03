import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useBranding } from "../contexts/BrandingContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { CalendarDays, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import { formatApiError } from "../lib/api";

export default function Login() {
  const { login } = useAuth();
  const { branding } = useBranding();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [nik, setNik] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), nik.trim(), password);
      toast.success("Berhasil masuk");
      nav("/");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr] moonblue-panel text-white">
      {/* Left hero */}
      <div className="hidden lg:flex flex-col justify-between p-10 xl:p-14 relative overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-50" />
        <div className="absolute -top-24 -left-24 w-[520px] h-[520px] rounded-full bg-[radial-gradient(circle,rgba(0,163,255,0.35),transparent_60%)]" />
        <div className="absolute bottom-0 right-0 w-[420px] h-[420px] rounded-full bg-[radial-gradient(circle,rgba(30,99,255,0.35),transparent_60%)]" />

        <div className="relative flex items-center gap-3">
          {branding.logo ? (
            <img src={branding.logo} alt="logo" className="w-11 h-11 rounded-xl object-cover border border-white/10" />
          ) : (
            <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-cyan-300" />
            </div>
          )}
          <div>
            <div className="font-heading font-bold tracking-tight">{branding.app_name || "Shift Scheduler"}</div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-cyan-300/80">Command Center</div>
          </div>
        </div>

        <div className="relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-400/10 border border-cyan-400/25 text-cyan-200 text-xs font-semibold mb-6">
            <Zap className="w-3.5 h-3.5" /> Sistem Manajemen Shift v1.0
          </div>
          <h1 className="font-display text-4xl xl:text-5xl font-extrabold leading-[1.05] tracking-tight text-white">
            {branding.hero_title}
          </h1>
          <p className="mt-5 text-cyan-100/80 max-w-lg text-base leading-relaxed">{branding.hero_subtitle}</p>

          {branding.hero_image && (
            <div className="mt-8 rounded-2xl overflow-hidden border border-white/10 electric-ring max-w-md">
              <img src={branding.hero_image} alt="hero" className="w-full h-56 object-cover" />
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-2">
            {[
              { l: "Pagi", h: "07 — 13", c: "bg-amber-400/15 border-amber-400/25 text-amber-200" },
              { l: "Siang", h: "13 — 19", c: "bg-sky-400/15 border-sky-400/25 text-sky-200" },
              { l: "Malam", h: "19 — 07", c: "bg-indigo-400/15 border-indigo-400/25 text-indigo-200" },
              { l: "Libur", h: "Off", c: "bg-emerald-400/15 border-emerald-400/25 text-emerald-200" },
            ].map((t) => (
              <div key={t.l} className={`px-3 py-2 rounded-lg border ${t.c}`}>
                <div className="text-[10px] uppercase tracking-widest opacity-75">{t.l}</div>
                <div className="text-sm font-mono-alt font-bold">{t.h}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-xs text-cyan-100/50">© {new Date().getFullYear()} {branding.app_name || "Shift Scheduler"}</div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-6 md:p-10 bg-white text-slate-900">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[--moonblue-950] flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <div className="font-heading font-bold">{branding.app_name || "Shift Scheduler"}</div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Command Center</div>
            </div>
          </div>

          <div className="mb-8">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-[11px] font-bold uppercase tracking-wider mb-3">Login</div>
            <h2 className="font-display text-3xl font-bold text-slate-900 tracking-tight">Masuk ke Sistem</h2>
            <p className="text-sm text-slate-500 mt-1.5">Gunakan Email, NIK, dan Password Anda.</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-slate-700">Email</Label>
              <Input id="email" type="email" required autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@perusahaan.com" data-testid="login-email-input"
                className="mt-1 h-11 border-slate-200 focus:border-sky-500 focus:ring-sky-500/20" />
            </div>
            <div>
              <Label htmlFor="nik" className="text-slate-700">NIK (Nomor Induk Karyawan)</Label>
              <Input id="nik" required value={nik} onChange={(e) => setNik(e.target.value)}
                placeholder="1000000001" data-testid="login-nik-input"
                className="mt-1 h-11 font-mono-alt border-slate-200 focus:border-sky-500 focus:ring-sky-500/20" />
            </div>
            <div>
              <Label htmlFor="password" className="text-slate-700">Password</Label>
              <Input id="password" type="password" required autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" data-testid="login-password-input"
                className="mt-1 h-11 border-slate-200 focus:border-sky-500 focus:ring-sky-500/20" />
            </div>
            <Button type="submit" className="w-full h-11 electric-btn font-semibold" disabled={loading} data-testid="login-submit-button">
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Masuk ke Sistem
            </Button>
          </form>

          <div className="mt-8 text-center text-sm text-slate-600">
            Belum punya akun?{" "}
            <Link to="/register" className="text-sky-600 hover:text-sky-700 font-semibold" data-testid="register-nav-link">Daftar Akun</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

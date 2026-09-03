import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card } from "../components/ui/card";
import { CalendarDays, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatApiError } from "../lib/api";

export default function Login() {
  const { login } = useAuth();
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
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-50 dark:bg-slate-950">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-sky-600 via-sky-700 to-indigo-800 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div>
              <div className="font-heading font-bold">Shift Scheduler</div>
              <div className="text-xs text-white/70 uppercase tracking-widest">Manajemen Personil</div>
            </div>
          </div>
        </div>
        <div className="relative">
          <h1 className="font-heading text-4xl xl:text-5xl font-extrabold leading-tight">Jadwal Shift Kerja untuk 16 Personil, Terstruktur & Profesional.</h1>
          <p className="mt-4 text-white/80 max-w-md">Kelola shift Pagi, Siang, Malam dan Libur. Ajukan Cuti, Sakit, Dinas Luar, Diklat, hingga Penugasan — semua dalam satu sistem.</p>
          <div className="mt-8 flex flex-wrap gap-2">
            {["Pagi 07-13", "Siang 13-19", "Malam 19-07", "Libur"].map((t) => (
              <span key={t} className="px-3 py-1.5 rounded-full bg-white/15 border border-white/20 text-xs font-semibold">{t}</span>
            ))}
          </div>
        </div>
        <div className="relative text-xs text-white/60">© {new Date().getFullYear()} Shift Scheduler</div>
      </div>

      <div className="flex items-center justify-center p-6 md:p-10">
        <Card className="w-full max-w-md p-8 shadow-xl border-slate-200 dark:border-slate-800">
          <div className="mb-6">
            <h2 className="font-heading text-2xl font-bold text-slate-900 dark:text-slate-50">Masuk ke Sistem</h2>
            <p className="text-sm text-slate-500 mt-1">Gunakan Email, NIK, dan Password Anda</p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@perusahaan.com" data-testid="login-email-input" />
            </div>
            <div>
              <Label htmlFor="nik">NIK (Nomor Induk Karyawan)</Label>
              <Input id="nik" required value={nik} onChange={(e) => setNik(e.target.value)}
                placeholder="1000000001" data-testid="login-nik-input" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" data-testid="login-password-input" />
            </div>
            <Button type="submit" className="w-full bg-sky-600 hover:bg-sky-700" disabled={loading} data-testid="login-submit-button">
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Masuk
            </Button>
          </form>
          <div className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
            Belum punya akun?{" "}
            <Link to="/register" className="text-sky-600 hover:underline font-semibold" data-testid="register-nav-link">Daftar Akun</Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card } from "../components/ui/card";
import { UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatApiError } from "../lib/api";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ email: "", nik: "", name: "", password: "", jabatan: "", phone: "" });
  const [loading, setLoading] = useState(false);

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register({ ...form, email: form.email.trim().toLowerCase() });
      toast.success("Akun berhasil dibuat");
      nav("/");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
      <Card className="w-full max-w-lg p-8 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-sky-600 flex items-center justify-center">
            <UserPlus className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-heading text-2xl font-bold">Daftar Akun</h2>
            <p className="text-sm text-slate-500">Akun baru dibuat sebagai Personil</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Nama Lengkap</Label>
              <Input required value={form.name} onChange={(e) => upd("name", e.target.value)} data-testid="reg-name-input" />
            </div>
            <div>
              <Label>NIK</Label>
              <Input required value={form.nik} onChange={(e) => upd("nik", e.target.value)} data-testid="reg-nik-input" />
            </div>
            <div className="sm:col-span-2">
              <Label>Email</Label>
              <Input type="email" required value={form.email} onChange={(e) => upd("email", e.target.value)} data-testid="reg-email-input" />
            </div>
            <div>
              <Label>Jabatan</Label>
              <Input value={form.jabatan} onChange={(e) => upd("jabatan", e.target.value)} placeholder="Opsional" data-testid="reg-jabatan-input" />
            </div>
            <div>
              <Label>No. Telepon</Label>
              <Input value={form.phone} onChange={(e) => upd("phone", e.target.value)} placeholder="Opsional" data-testid="reg-phone-input" />
            </div>
            <div className="sm:col-span-2">
              <Label>Password (min. 6 karakter)</Label>
              <Input type="password" required minLength={6} value={form.password} onChange={(e) => upd("password", e.target.value)} data-testid="reg-password-input" />
            </div>
          </div>
          <Button type="submit" className="w-full bg-sky-600 hover:bg-sky-700" disabled={loading} data-testid="register-submit-button">
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Buat Akun
          </Button>
        </form>
        <div className="mt-6 text-center text-sm">
          Sudah punya akun? <Link to="/login" className="text-sky-600 font-semibold hover:underline" data-testid="login-nav-link">Masuk</Link>
        </div>
      </Card>
    </div>
  );
}

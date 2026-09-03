import { useEffect, useState } from "react";
import api, { formatApiError } from "../lib/api";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../components/ui/alert-dialog";
import { UserPlus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const empty = { email: "", nik: "", name: "", password: "", jabatan: "", phone: "", role: "personil" };

export default function Personnel() {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);

  const load = async () => {
    try { const { data } = await api.get("/personil"); setList(data); }
    catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (p) => { setEditing(p); setForm({ ...p, password: "" }); setOpen(true); };

  const save = async () => {
    try {
      if (editing) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        delete payload.email;
        await api.patch(`/personil/${editing.id}`, payload);
        toast.success("Personil diperbarui");
      } else {
        await api.post("/personil", { ...form, email: form.email.trim().toLowerCase() });
        toast.success("Personil ditambahkan");
      }
      setOpen(false);
      await load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const remove = async (id) => {
    try { await api.delete(`/personil/${id}`); toast.success("Personil dihapus"); await load(); }
    catch (e) { toast.error(formatApiError(e)); }
  };

  const toggleActive = async (p) => {
    try { await api.patch(`/personil/${p.id}`, { active: !p.active }); await load(); }
    catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <div className="space-y-6" data-testid="personil-root">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-3xl font-extrabold text-slate-900 dark:text-slate-50">Manajemen Personil</h1>
          <p className="text-slate-500 text-sm mt-1">Total {list.length} personil terdaftar.</p>
        </div>
        <Button className="bg-sky-600 hover:bg-sky-700" onClick={openNew} data-testid="add-personil-button">
          <UserPlus className="w-4 h-4 mr-2" /> Tambah Personil
        </Button>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300">
              <tr>
                <th className="text-left p-3">Nama</th>
                <th className="text-left p-3">NIK</th>
                <th className="text-left p-3">Email</th>
                <th className="text-left p-3">Jabatan</th>
                <th className="text-left p-3">Role</th>
                <th className="text-left p-3">Aktif</th>
                <th className="p-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="p-3 font-semibold">{p.name}</td>
                  <td className="p-3 font-mono-alt text-xs">{p.nik}</td>
                  <td className="p-3 text-slate-600 dark:text-slate-400">{p.email}</td>
                  <td className="p-3">{p.jabatan || "—"}</td>
                  <td className="p-3">
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${p.role === "admin" ? "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}>{p.role}</span>
                  </td>
                  <td className="p-3"><Switch checked={p.active !== false} onCheckedChange={() => toggleActive(p)} data-testid={`toggle-active-${p.id}`} /></td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(p)} data-testid={`edit-personil-${p.id}`}><Pencil className="w-4 h-4" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-rose-600" data-testid={`delete-personil-${p.id}`}><Trash2 className="w-4 h-4" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Hapus personil?</AlertDialogTitle>
                          <AlertDialogDescription>Data personil <b>{p.name}</b> beserta jadwal akan dihapus permanen.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove(p.id)} className="bg-rose-600 hover:bg-rose-700">Hapus</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </td>
                </tr>
              ))}
              {list.length === 0 && (<tr><td colSpan={7} className="p-8 text-center text-slate-500">Belum ada personil.</td></tr>)}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Personil" : "Tambah Personil"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Nama Lengkap</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="personil-name-input" /></div>
            <div><Label>NIK</Label><Input value={form.nik} onChange={(e) => setForm({ ...form, nik: e.target.value })} data-testid="personil-nik-input" /></div>
            <div><Label>Email</Label><Input type="email" disabled={!!editing} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="personil-email-input" /></div>
            <div><Label>Jabatan</Label><Input value={form.jabatan || ""} onChange={(e) => setForm({ ...form, jabatan: e.target.value })} /></div>
            <div><Label>Telepon</Label><Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="personil">Personil</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>{editing ? "Password baru (opsional)" : "Password"}</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button className="bg-sky-600 hover:bg-sky-700" onClick={save} data-testid="save-personil-button">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

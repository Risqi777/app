import { useCallback, useEffect, useState } from "react";
import api, { REQUEST_TYPES, formatApiError } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Plus, Check, X, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const statusCls = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  rejected: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
};

export default function Requests() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: "Cuti Tahunan", start_date: "", end_date: "", reason: "" });
  const [conflict, setConflict] = useState(null); // { reqId, message, conflicts:[], min_active }

  const load = useCallback(async () => {
    try { const { data } = await api.get("/requests"); setList(data); }
    catch (e) { toast.error(formatApiError(e)); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    try {
      await api.post("/requests", form);
      toast.success("Pengajuan dikirim");
      setOpen(false);
      setForm({ type: "Cuti Tahunan", start_date: "", end_date: "", reason: "" });
      await load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const decide = async (id, status, force = false) => {
    try {
      await api.patch(`/requests/${id}`, { status, force });
      toast.success(`Pengajuan ${status === "approved" ? "disetujui" : "ditolak"}`);
      setConflict(null);
      await load();
    } catch (e) {
      const detail = e?.response?.data?.detail;
      if (e?.response?.status === 409 && detail && typeof detail === "object" && detail.conflicts) {
        setConflict({ reqId: id, ...detail });
      } else {
        toast.error(formatApiError(e));
      }
    }
  };

  const remove = async (id) => {
    try { await api.delete(`/requests/${id}`); await load(); toast.success("Dihapus"); }
    catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <div className="space-y-6" data-testid="requests-root">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-3xl font-extrabold text-slate-900 dark:text-slate-50">Pengajuan</h1>
          <p className="text-slate-500 text-sm mt-1">Cuti (Tahunan / Penting / Besar), Sakit, Dinas Luar, Diklat, Penugasan.</p>
        </div>
        <Button className="bg-sky-600 hover:bg-sky-700" onClick={() => setOpen(true)} data-testid="submit-request-leave-button">
          <Plus className="w-4 h-4 mr-2" /> Ajukan
        </Button>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300">
              <tr>
                {isAdmin && <th className="text-left p-3">Personil</th>}
                <th className="text-left p-3">Jenis</th>
                <th className="text-left p-3">Mulai</th>
                <th className="text-left p-3">Selesai</th>
                <th className="text-left p-3">Alasan</th>
                <th className="text-left p-3">Status</th>
                <th className="p-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className="border-t border-slate-200 dark:border-slate-800">
                  {isAdmin && <td className="p-3"><div className="font-semibold">{r.user_name}</div><div className="text-xs text-slate-500 font-mono-alt">{r.user_nik}</div></td>}
                  <td className="p-3 font-semibold">{r.type}</td>
                  <td className="p-3 font-mono-alt text-xs">{r.start_date}</td>
                  <td className="p-3 font-mono-alt text-xs">{r.end_date}</td>
                  <td className="p-3 text-slate-600 dark:text-slate-400 max-w-[240px] truncate" title={r.reason}>{r.reason || "—"}</td>
                  <td className="p-3"><span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${statusCls[r.status]}`}>{r.status}</span></td>
                  <td className="p-3 text-right whitespace-nowrap">
                    {isAdmin && r.status === "pending" && (
                      <>
                        <Button size="sm" variant="ghost" className="text-emerald-600" onClick={() => decide(r.id, "approved")} data-testid={`approve-${r.id}`}><Check className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => decide(r.id, "rejected")} data-testid={`reject-${r.id}`}><X className="w-4 h-4" /></Button>
                      </>
                    )}
                    {(isAdmin || r.user_id === user?.id) && (
                      <Button size="sm" variant="ghost" className="text-slate-500" onClick={() => remove(r.id)} data-testid={`delete-request-${r.id}`}><Trash2 className="w-4 h-4" /></Button>
                    )}
                  </td>
                </tr>
              ))}
              {list.length === 0 && (<tr><td colSpan={isAdmin ? 7 : 6} className="p-8 text-center text-slate-500">Belum ada pengajuan.</td></tr>)}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Formulir Pengajuan</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Jenis</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger data-testid="request-type-select"><SelectValue /></SelectTrigger>
                <SelectContent>{REQUEST_TYPES.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tanggal Mulai</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} data-testid="request-start-input" /></div>
              <div><Label>Tanggal Selesai</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} data-testid="request-end-input" /></div>
            </div>
            <div><Label>Alasan / Keterangan</Label><Textarea rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} data-testid="request-reason-input" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button className="bg-sky-600 hover:bg-sky-700" onClick={submit} disabled={!form.start_date || !form.end_date} data-testid="submit-request-button">Kirim Pengajuan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Conflict resolution dialog */}
      <Dialog open={!!conflict} onOpenChange={(o) => !o && setConflict(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" /> Konflik Coverage Terdeteksi
            </DialogTitle>
            <DialogDescription>{conflict?.message}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[40vh] overflow-y-auto rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3">
            <table className="w-full text-xs">
              <thead className="text-slate-600 dark:text-slate-300">
                <tr><th className="text-left p-1">Tanggal</th><th className="text-left p-1">Shift</th><th className="text-right p-1">Sisa</th><th className="text-right p-1">Minimum</th></tr>
              </thead>
              <tbody>
                {(conflict?.conflicts || []).map((c) => (
                  <tr key={`${c.date}-${c.shift}`} className="border-t border-amber-200 dark:border-amber-800">
                    <td className="p-1 font-mono-alt">{c.date}</td>
                    <td className="p-1 font-semibold">{c.shift}</td>
                    <td className="p-1 text-right text-rose-600 font-bold">{c.remaining}</td>
                    <td className="p-1 text-right">{c.minimum}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConflict(null)}>Batalkan</Button>
            <Button className="bg-rose-600 hover:bg-rose-700" onClick={() => decide(conflict.reqId, "rejected")} data-testid="conflict-reject-button">Tolak Pengajuan</Button>
            <Button className="bg-amber-600 hover:bg-amber-700" onClick={() => decide(conflict.reqId, "approved", true)} data-testid="conflict-force-approve-button">Tetap Setujui</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function formatApiError(err) {
  const detail = err?.response?.data?.detail;
  if (detail == null) return err?.message || "Terjadi kesalahan";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e) => e?.msg || JSON.stringify(e)).join(" ");
  if (typeof detail === "object" && detail.msg) return detail.msg;
  return String(detail);
}

export const SHIFT_META = {
  "Pagi": { code: "Pagi", label: "Pagi", cls: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700" },
  "Siang": { code: "Siang", label: "Siang", cls: "bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-700" },
  "Malam": { code: "Malam", label: "Malam", cls: "bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-700" },
  "Libur": { code: "Libur", label: "Libur", cls: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700" },
  "Cuti Tahunan": { code: "C. Thn", label: "Cuti Tahunan", cls: "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-700" },
  "Cuti Penting": { code: "C. Pntg", label: "Cuti Penting", cls: "bg-pink-100 text-pink-900 border-pink-300 dark:bg-pink-950/60 dark:text-pink-300 dark:border-pink-700" },
  "Cuti Besar": { code: "C. Bsr", label: "Cuti Besar", cls: "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-700" },
  "Sakit": { code: "Sakit", label: "Sakit", cls: "bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-700" },
  "Dinas Luar": { code: "Dinas", label: "Dinas Luar", cls: "bg-teal-100 text-teal-900 border-teal-300 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-700" },
  "Diklat": { code: "Diklat", label: "Diklat", cls: "bg-cyan-100 text-cyan-900 border-cyan-300 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-700" },
  "Penugasan": { code: "Tugas", label: "Penugasan", cls: "bg-slate-200 text-slate-900 border-slate-400 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600" },
};

export const SHIFT_KEYS = Object.keys(SHIFT_META);
export const REQUEST_TYPES = ["Cuti Tahunan", "Cuti Penting", "Cuti Besar", "Sakit", "Dinas Luar", "Diklat", "Penugasan"];

export default api;

# PRD — Sistem Manajemen Jadwal Shift Personil

## Original Problem Statement
Buatkan website untuk pembuatan jadwal kerja shift dengan 16 personil, 3 shift (Pagi 07.00-13.00, Siang 13.00-19.00, Malam 19.00-07.00) + Libur (2 min, 3 max per 3 hari kerja). Menu pengajuan cuti (Tahunan, Penting, Besar), sakit, dinas luar, diklat, penugasan. Login Admin & Personil dengan email + NIK + password. Daftar akun. Admin CRUD penuh, Personil view + ajukan. Sederhana, profesional. Admin dapat edit judul, tanda tangan, nama, upload gambar. Multi-platform. Nama admin tidak perlu di masukan dalam jadwal kerja personil. Nama personil di jadwal kerja fleksibel bisa di rubah urutan.

## User Personas
- **Admin (Tim Roastering Schedule)**: Kelola personil, generate jadwal, approve/reject pengajuan, atur header laporan cetak.
- **Personil**: Lihat jadwal, ajukan cuti/sakit/dinas/diklat/penugasan.

## Architecture
- Backend: FastAPI + MongoDB (motor). JWT Bearer auth (7 hari). Bcrypt password hashing.
- Frontend: React 19 + React Router + shadcn/ui + Tailwind. Sonner toasts.
- Storage: Base64 dalam MongoDB untuk logo & tanda tangan.

## Implemented (2026-02)
- Auth: register, login (email+NIK+password), me, JWT.
- Personil CRUD (admin only): create/update/delete/toggle-active.
- Schedule: auto-generate (3 kerja / 2 libur, rotasi Pagi→Siang→Malam), edit sel manual via dropdown per cell, view matrix bulanan, via import from excel.
- Requests: personil create (Cuti Tahunan/Penting/Besar, Sakit, Dinas Luar, Diklat, Penugasan). Admin approve → auto-override sel jadwal antara start_date & end_date. Reject / delete.
- Settings: title, subtitle, logo (upload base64), signature (upload base64), background (upload base64), signer_name/jabatan/nik, place.
- Print layout dengan header (logo+judul) & footer tanda tangan.
- Dashboard: statistik total personil, pending, approved, distribusi shift hari ini.

## Backlog
- P1: Export PDF native (saat ini via window.print).
- P1: Riwayat perubahan sel jadwal (audit log).
- P2: Notifikasi email saat pengajuan approved/rejected.
- P2: Filter/search personil di tabel.
- P2: Kalender pribadi personil (view compact).

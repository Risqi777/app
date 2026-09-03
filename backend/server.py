from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import re
import uuid
import ipaddress
import logging
from datetime import datetime, timezone, timedelta, date
from typing import List, Optional, Literal
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse

import bcrypt
import jwt
import httpx
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============= Email (Emergent-managed Resend) =============
EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "Shift Scheduler")
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = ("reply with your password", "reply with the code", "send your password", "cvv",
             "send us your password", "enter your password below", "confirm your card number",
             "your full card number", "seed phrase", "recovery phrase", "verify your card",
             "social security number", "confirm your bank details")
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)

def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)

def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)

class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []
    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []
    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)
    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []

def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan(); scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks the recipient for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links/assets must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened, numeric-host or credential-bearing URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != real link host {real!r} (G3)")

async def send_email(*, to: str, subject: str, html: str) -> Optional[str]:
    if not EMAIL_KEY:
        logger.warning("EMERGENT_EMAIL_KEY missing, skipping email send")
        return None
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if EMAIL_REPLY_TO:
        payload["contact_email"] = EMAIL_REPLY_TO
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(f"{EMAIL_BASE_URL}/api/v1/email/send",
                             headers={"X-Email-Key": EMAIL_KEY}, json=payload)
        r.raise_for_status()
        return r.json().get("id")
    except Exception as e:
        logger.error(f"Email send failed: {e}")
        return None

def build_decision_email(user_name: str, req_type: str, start: str, end: str,
                         status: str, admin_note: str, app_name: str) -> tuple[str, str]:
    status_id = "DISETUJUI" if status == "approved" else "DITOLAK"
    color = "#059669" if status == "approved" else "#DC2626"
    subject = f"[{app_name}] Pengajuan {req_type} {status_id}"
    note_row = (f'<tr><td style="padding:6px 0;color:#475569">Catatan Admin</td>'
                f'<td style="padding:6px 0;color:#0f172a"><strong>{escape(admin_note)}</strong></td></tr>'
                if admin_note else "")
    html = (
        '<table role="presentation" width="100%" style="background:#f8fafc;padding:24px 0">'
        '<tr><td align="center">'
        '<table role="presentation" width="560" style="background:#ffffff;border-radius:12px;'
        'border:1px solid #e2e8f0;font-family:Arial,sans-serif;color:#0f172a">'
        f'<tr><td style="padding:20px 28px;border-bottom:1px solid #e2e8f0">'
        f'<div style="font-size:12px;color:#64748b;letter-spacing:2px;text-transform:uppercase">'
        f'{escape(app_name)}</div>'
        f'<div style="font-size:20px;font-weight:800;margin-top:4px">Notifikasi Pengajuan</div>'
        f'</td></tr>'
        f'<tr><td style="padding:24px 28px">'
        f'<p style="margin:0 0 12px 0">Halo <strong>{escape(user_name)}</strong>,</p>'
        f'<p style="margin:0 0 16px 0">Pengajuan Anda telah diproses dengan status:</p>'
        f'<div style="display:inline-block;padding:8px 14px;border-radius:999px;'
        f'background:{color}15;color:{color};font-weight:700;letter-spacing:1px">{status_id}</div>'
        f'<table role="presentation" width="100%" style="margin-top:20px;font-size:14px">'
        f'<tr><td style="padding:6px 0;color:#475569;width:40%">Jenis</td>'
        f'<td style="padding:6px 0"><strong>{escape(req_type)}</strong></td></tr>'
        f'<tr><td style="padding:6px 0;color:#475569">Tanggal Mulai</td>'
        f'<td style="padding:6px 0"><strong>{escape(start)}</strong></td></tr>'
        f'<tr><td style="padding:6px 0;color:#475569">Tanggal Selesai</td>'
        f'<td style="padding:6px 0"><strong>{escape(end)}</strong></td></tr>'
        f'{note_row}'
        f'</table>'
        f'<p style="margin:24px 0 0 0;color:#475569;font-size:13px">'
        f'Silakan masuk ke aplikasi untuk melihat jadwal terbaru Anda.</p>'
        f'</td></tr>'
        f'<tr><td style="padding:16px 28px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8">'
        f'Email otomatis dari {escape(app_name)}. Kami tidak pernah meminta password atau data '
        f'kartu melalui email.'
        f'</td></tr>'
        '</table></td></tr></table>'
    )
    return subject, html

# MongoDB
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT
JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24 * 7  # 7 days

app = FastAPI(title="Shift Scheduler API")
api = APIRouter(prefix="/api")

# ============= Helpers =============
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def new_id() -> str:
    return str(uuid.uuid4())

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id, "email": email, "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

security = HTTPBearer(auto_error=False)

async def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> dict:
    if not creds:
        raise HTTPException(status_code=401, detail="Tidak terautentikasi")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token kedaluwarsa")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token tidak valid")
    user = await db.users.find_one({"id": payload["sub"]}, {"password_hash": 0, "_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User tidak ditemukan")
    return user

async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Akses ditolak: hanya admin")
    return user

# ============= Models =============
class RegisterIn(BaseModel):
    model_config = ConfigDict(extra="ignore")
    email: EmailStr
    nik: str = Field(min_length=3, max_length=32)
    name: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=6, max_length=100)
    jabatan: Optional[str] = ""
    phone: Optional[str] = ""

class LoginIn(BaseModel):
    email: EmailStr
    nik: str
    password: str

class UserOut(BaseModel):
    id: str
    email: str
    nik: str
    name: str
    role: str
    jabatan: Optional[str] = ""
    phone: Optional[str] = ""
    active: bool = True
    photo: Optional[str] = None
    created_at: Optional[str] = None

class PersonilUpdateIn(BaseModel):
    name: Optional[str] = None
    nik: Optional[str] = None
    jabatan: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[Literal["admin", "personil"]] = None
    active: Optional[bool] = None
    photo: Optional[str] = None
    password: Optional[str] = None

class PersonilCreateIn(BaseModel):
    email: EmailStr
    nik: str
    name: str
    password: str
    jabatan: Optional[str] = ""
    phone: Optional[str] = ""
    role: Literal["admin", "personil"] = "personil"

SHIFT_CODES = ["Pagi", "Siang", "Malam", "Libur", "Cuti Tahunan", "Cuti Penting", "Cuti Besar", "Sakit", "Dinas Luar", "Diklat", "Penugasan"]

class ScheduleUpsertIn(BaseModel):
    month: int
    year: int
    entries: List[dict]  # [{user_id, day, shift}]

class CellUpdateIn(BaseModel):
    user_id: str
    date: str  # YYYY-MM-DD
    shift: str

class GenerateIn(BaseModel):
    month: int
    year: int
    overwrite: bool = True

class RequestCreateIn(BaseModel):
    type: Literal["Cuti Tahunan", "Cuti Penting", "Cuti Besar", "Sakit", "Dinas Luar", "Diklat", "Penugasan"]
    start_date: str  # YYYY-MM-DD
    end_date: str
    reason: str = ""

class RequestDecisionIn(BaseModel):
    status: Literal["approved", "rejected"]
    admin_note: Optional[str] = ""
    force: bool = False  # Bypass minimum-active-shift conflict check

class SettingsIn(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    logo: Optional[str] = None  # base64
    signature: Optional[str] = None  # base64
    signer_name: Optional[str] = None
    signer_jabatan: Optional[str] = None
    signer_nik: Optional[str] = None
    place: Optional[str] = None
    min_active_per_shift: Optional[int] = None

# ============= Auth =============
@api.post("/auth/register")
async def register(body: RegisterIn):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    if await db.users.find_one({"nik": body.nik}):
        raise HTTPException(status_code=400, detail="NIK sudah terdaftar")
    user_doc = {
        "id": new_id(),
        "email": email,
        "nik": body.nik,
        "name": body.name,
        "password_hash": hash_password(body.password),
        "role": "personil",
        "jabatan": body.jabatan or "",
        "phone": body.phone or "",
        "active": True,
        "photo": None,
        "created_at": now_iso(),
    }
    await db.users.insert_one(user_doc)
    token = create_token(user_doc["id"], email, "personil")
    user_doc.pop("password_hash", None)
    user_doc.pop("_id", None)
    return {"token": token, "user": user_doc}

@api.post("/auth/login")
async def login(body: LoginIn):
    email = body.email.lower()
    user = await db.users.find_one({"email": email, "nik": body.nik})
    if not user:
        raise HTTPException(status_code=401, detail="Email atau NIK tidak cocok")
    if not user.get("active", True):
        raise HTTPException(status_code=403, detail="Akun dinonaktifkan")
    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Password salah")
    token = create_token(user["id"], email, user["role"])
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"token": token, "user": user}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

# ============= Personil (Users) =============
@api.get("/personil")
async def list_personil(user: dict = Depends(get_current_user)):
    users = await db.users.find({}, {"password_hash": 0, "_id": 0}).sort("name", 1).to_list(1000)
    return users

@api.post("/personil")
async def create_personil(body: PersonilCreateIn, admin: dict = Depends(require_admin)):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    if await db.users.find_one({"nik": body.nik}):
        raise HTTPException(status_code=400, detail="NIK sudah terdaftar")
    doc = {
        "id": new_id(),
        "email": email,
        "nik": body.nik,
        "name": body.name,
        "password_hash": hash_password(body.password),
        "role": body.role,
        "jabatan": body.jabatan or "",
        "phone": body.phone or "",
        "active": True,
        "photo": None,
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    doc.pop("password_hash", None)
    doc.pop("_id", None)
    return doc

@api.patch("/personil/{user_id}")
async def update_personil(user_id: str, body: PersonilUpdateIn, admin: dict = Depends(require_admin)):
    existing = await db.users.find_one({"id": user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Personil tidak ditemukan")
    update = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if "password" in update:
        update["password_hash"] = hash_password(update.pop("password"))
    if "nik" in update and update["nik"] != existing["nik"]:
        if await db.users.find_one({"nik": update["nik"]}):
            raise HTTPException(status_code=400, detail="NIK sudah dipakai")
    if update:
        await db.users.update_one({"id": user_id}, {"$set": update})
    doc = await db.users.find_one({"id": user_id}, {"password_hash": 0, "_id": 0})
    return doc

@api.delete("/personil/{user_id}")
async def delete_personil(user_id: str, admin: dict = Depends(require_admin)):
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Tidak dapat menghapus diri sendiri")
    res = await db.users.delete_one({"id": user_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Personil tidak ditemukan")
    await db.schedules.delete_many({"user_id": user_id})
    return {"ok": True}

# ============= Schedule =============
def days_in_month(year: int, month: int) -> int:
    if month == 12:
        return (date(year + 1, 1, 1) - date(year, month, 1)).days
    return (date(year, month + 1, 1) - date(year, month, 1)).days

@api.get("/schedule")
async def get_schedule(month: int, year: int, user: dict = Depends(get_current_user)):
    docs = await db.schedules.find(
        {"month": month, "year": year}, {"_id": 0}
    ).to_list(10000)
    return docs

async def log_audit(user_id: str, target_date: str, before: Optional[str], after: str,
                    changed_by: dict, source: str):
    target_user = await db.users.find_one({"id": user_id}, {"_id": 0, "name": 1})
    await db.schedule_audit.insert_one({
        "id": new_id(),
        "user_id": user_id,
        "user_name": (target_user or {}).get("name", ""),
        "date": target_date,
        "shift_before": before,
        "shift_after": after,
        "changed_by": changed_by["id"],
        "changed_by_name": changed_by["name"],
        "source": source,  # manual / generate / request-approve
        "changed_at": now_iso(),
    })

@api.post("/schedule/cell")
async def upsert_cell(body: CellUpdateIn, admin: dict = Depends(require_admin)):
    if body.shift not in SHIFT_CODES:
        raise HTTPException(status_code=400, detail="Shift tidak valid")
    d = datetime.strptime(body.date, "%Y-%m-%d").date()
    key = {"user_id": body.user_id, "date": body.date}
    existing = await db.schedules.find_one(key, {"_id": 0, "shift": 1})
    doc = {
        **key,
        "shift": body.shift,
        "day": d.day,
        "month": d.month,
        "year": d.year,
        "updated_at": now_iso(),
    }
    await db.schedules.update_one(key, {"$set": doc}, upsert=True)
    await log_audit(body.user_id, body.date, (existing or {}).get("shift"), body.shift, admin, "manual")
    return doc

@api.get("/schedule/audit")
async def get_audit(month: Optional[int] = None, year: Optional[int] = None,
                    limit: int = 200, user: dict = Depends(require_admin)):
    q = {}
    if month and year:
        prefix = f"{year:04d}-{month:02d}-"
        q["date"] = {"$regex": f"^{prefix}"}
    docs = await db.schedule_audit.find(q, {"_id": 0}).sort("changed_at", -1).to_list(limit)
    return docs

@api.get("/schedule/summary")
async def schedule_summary(month: int, year: int, user: dict = Depends(get_current_user)):
    """Per-personil monthly counts for workload analysis."""
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("name", 1).to_list(1000)
    prefix = f"{year:04d}-{month:02d}-"
    all_entries = await db.schedules.find(
        {"date": {"$regex": f"^{prefix}"}}, {"_id": 0}
    ).to_list(20000)
    by_user = {}
    for e in all_entries:
        by_user.setdefault(e["user_id"], []).append(e)
    n_days = days_in_month(year, month)
    result = []
    for u in users:
        counts = {k: 0 for k in SHIFT_CODES}
        for e in by_user.get(u["id"], []):
            if e["shift"] in counts:
                counts[e["shift"]] += 1
        total_work = counts["Pagi"] + counts["Siang"] + counts["Malam"]
        total_cuti = counts["Cuti Tahunan"] + counts["Cuti Penting"] + counts["Cuti Besar"]
        total_absen = counts["Sakit"] + counts["Dinas Luar"] + counts["Diklat"] + counts["Penugasan"]
        assigned = total_work + counts["Libur"] + total_cuti + total_absen
        result.append({
            "user_id": u["id"], "name": u["name"], "nik": u["nik"],
            "jabatan": u.get("jabatan", ""), "role": u["role"], "active": u.get("active", True),
            "counts": counts,
            "total_work": total_work, "total_libur": counts["Libur"],
            "total_cuti": total_cuti, "total_absen": total_absen,
            "unassigned": max(0, n_days - assigned),
        })
    return {"month": month, "year": year, "days_in_month": n_days, "rows": result}

@api.post("/schedule/generate")
async def generate_schedule(body: GenerateIn, admin: dict = Depends(require_admin)):
    """Generate schedule using 3-day-work-then-2-day-off pattern with balanced Pagi/Siang/Malam rotation."""
    users = await db.users.find({"active": True, "role": "personil"}, {"_id": 0, "id": 1, "name": 1}).sort("name", 1).to_list(1000)
    if not users:
        raise HTTPException(status_code=400, detail="Tidak ada personil aktif")
    n_days = days_in_month(body.year, body.month)
    if body.overwrite:
        await db.schedules.delete_many({"month": body.month, "year": body.year})
    # cycle length 5: 3 work + 2 off. Rotate through Pagi->Siang->Malam.
    shifts_cycle = ["Pagi", "Siang", "Malam"]
    ops = []
    for idx, u in enumerate(users):
        # Stagger offset so groups spread across days
        offset = idx % 5
        shift_group = idx % 3
        for day in range(1, n_days + 1):
            pos = (day - 1 + offset) % 5
            if pos < 3:
                # Rotate shift by day-group so a person doesn't always do same shift
                s_idx = (shift_group + ((day - 1 + offset) // 5)) % 3
                shift = shifts_cycle[s_idx]
            else:
                shift = "Libur"
            dt = date(body.year, body.month, day).isoformat()
            doc = {
                "user_id": u["id"],
                "date": dt,
                "shift": shift,
                "day": day,
                "month": body.month,
                "year": body.year,
                "updated_at": now_iso(),
            }
            ops.append(doc)
    if ops:
        await db.schedules.insert_many(ops)
    return {"created": len(ops), "days": n_days, "users": len(users)}

# ============= Requests (Pengajuan) =============
@api.get("/requests")
async def list_requests(user: dict = Depends(get_current_user)):
    q = {} if user["role"] == "admin" else {"user_id": user["id"]}
    docs = await db.requests.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return docs

@api.post("/requests")
async def create_request(body: RequestCreateIn, user: dict = Depends(get_current_user)):
    doc = {
        "id": new_id(),
        "user_id": user["id"],
        "user_name": user["name"],
        "user_nik": user["nik"],
        "type": body.type,
        "start_date": body.start_date,
        "end_date": body.end_date,
        "reason": body.reason,
        "status": "pending",
        "admin_note": "",
        "created_at": now_iso(),
        "decided_at": None,
    }
    await db.requests.insert_one(doc)
    # Notify all admins
    admins = await db.users.find({"role": "admin", "active": True}, {"_id": 0, "id": 1}).to_list(100)
    if admins:
        notifs = [{
            "id": new_id(),
            "user_id": a["id"],
            "type": "new_request",
            "title": f"Pengajuan {body.type} baru",
            "message": f"{user['name']} mengajukan {body.type} ({body.start_date} → {body.end_date})",
            "ref_id": doc["id"],
            "ref_route": "/requests",
            "read": False,
            "created_at": now_iso(),
        } for a in admins]
        await db.notifications.insert_many(notifs)
    doc.pop("_id", None)
    return doc

# ============= Notifications =============
@api.get("/notifications")
async def list_notifications(limit: int = 30, user: dict = Depends(get_current_user)):
    docs = await db.notifications.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    unread = await db.notifications.count_documents({"user_id": user["id"], "read": False})
    return {"items": docs, "unread": unread}

@api.patch("/notifications/{notif_id}/read")
async def mark_read(notif_id: str, user: dict = Depends(get_current_user)):
    res = await db.notifications.update_one(
        {"id": notif_id, "user_id": user["id"]}, {"$set": {"read": True}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notifikasi tidak ditemukan")
    return {"ok": True}

@api.post("/notifications/read-all")
async def mark_all_read(user: dict = Depends(get_current_user)):
    res = await db.notifications.update_many(
        {"user_id": user["id"], "read": False}, {"$set": {"read": True}}
    )
    return {"ok": True, "updated": res.modified_count}

@api.patch("/requests/{req_id}")
async def decide_request(req_id: str, body: RequestDecisionIn, admin: dict = Depends(require_admin)):
    req = await db.requests.find_one({"id": req_id})
    if not req:
        raise HTTPException(status_code=404, detail="Pengajuan tidak ditemukan")
    # Conflict check on approval (skip if type is Penugasan since it still counts as work)
    WORK_SHIFTS = {"Pagi", "Siang", "Malam"}
    ABSENCE_TYPES = {"Cuti Tahunan", "Cuti Penting", "Cuti Besar", "Sakit", "Dinas Luar", "Diklat"}
    conflicts = []
    if body.status == "approved" and req["type"] in ABSENCE_TYPES and not body.force:
        settings_doc = await db.settings.find_one({"id": "app_settings"}, {"_id": 0}) or {}
        min_active = int(settings_doc.get("min_active_per_shift", 3) or 3)
        start = datetime.strptime(req["start_date"], "%Y-%m-%d").date()
        end = datetime.strptime(req["end_date"], "%Y-%m-%d").date()
        cur = start
        while cur <= end:
            date_str = cur.isoformat()
            existing = await db.schedules.find_one(
                {"user_id": req["user_id"], "date": date_str}, {"_id": 0, "shift": 1}
            )
            current_shift = (existing or {}).get("shift")
            if current_shift in WORK_SHIFTS:
                count = await db.schedules.count_documents(
                    {"date": date_str, "shift": current_shift}
                )
                remaining = count - 1  # this user will be removed
                if remaining < min_active:
                    conflicts.append({
                        "date": date_str, "shift": current_shift,
                        "remaining": remaining, "minimum": min_active,
                    })
            cur += timedelta(days=1)
        if conflicts:
            raise HTTPException(status_code=409, detail={
                "message": (f"Persetujuan ditolak otomatis: personil aktif akan turun di bawah "
                            f"minimum {min_active} pada {len(conflicts)} hari."),
                "conflicts": conflicts,
                "min_active": min_active,
            })
    await db.requests.update_one(
        {"id": req_id},
        {"$set": {"status": body.status, "admin_note": body.admin_note or "", "decided_at": now_iso()}},
    )
    # Auto-update schedule if approved (with audit trail)
    if body.status == "approved":
        start = datetime.strptime(req["start_date"], "%Y-%m-%d").date()
        end = datetime.strptime(req["end_date"], "%Y-%m-%d").date()
        cur = start
        while cur <= end:
            key = {"user_id": req["user_id"], "date": cur.isoformat()}
            existing = await db.schedules.find_one(key, {"_id": 0, "shift": 1})
            doc = {**key, "shift": req["type"], "day": cur.day, "month": cur.month, "year": cur.year, "updated_at": now_iso()}
            await db.schedules.update_one(key, {"$set": doc}, upsert=True)
            await log_audit(req["user_id"], cur.isoformat(), (existing or {}).get("shift"),
                            req["type"], admin, "request-approve")
            cur += timedelta(days=1)
    # Send email notification (non-blocking; failures logged only)
    recipient = await db.users.find_one({"id": req["user_id"]}, {"_id": 0, "email": 1, "name": 1})
    if recipient and recipient.get("email"):
        subject, html = build_decision_email(
            user_name=recipient["name"], req_type=req["type"],
            start=req["start_date"], end=req["end_date"],
            status=body.status, admin_note=body.admin_note or "",
            app_name=EMAIL_FROM_NAME,
        )
        try:
            await send_email(to=recipient["email"], subject=subject, html=html)
        except Exception as e:
            logger.error(f"Email dispatch error (non-blocking): {e}")
    updated = await db.requests.find_one({"id": req_id}, {"_id": 0})
    return updated

@api.delete("/requests/{req_id}")
async def delete_request(req_id: str, user: dict = Depends(get_current_user)):
    req = await db.requests.find_one({"id": req_id})
    if not req:
        raise HTTPException(status_code=404, detail="Tidak ditemukan")
    if user["role"] != "admin" and req["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Tidak diizinkan")
    await db.requests.delete_one({"id": req_id})
    return {"ok": True}

# ============= Settings =============
DEFAULT_SETTINGS = {
    "id": "app_settings",
    "title": "JADWAL SHIFT KERJA PERSONIL",
    "subtitle": "Daftar Penugasan Shift & Hak Cuti",
    "logo": None,
    "signature": None,
    "signer_name": "Risqi Kurniawan",
    "signer_jabatan": "Kepala Unit",
    "signer_nik": "",
    "place": "Jakarta",
    "min_active_per_shift": 3,
}

@api.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    doc = await db.settings.find_one({"id": "app_settings"}, {"_id": 0})
    if not doc:
        await db.settings.insert_one(dict(DEFAULT_SETTINGS))
        doc = dict(DEFAULT_SETTINGS)
    return doc

@api.patch("/settings")
async def update_settings(body: SettingsIn, admin: dict = Depends(require_admin)):
    update = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    await db.settings.update_one({"id": "app_settings"}, {"$set": update}, upsert=True)
    doc = await db.settings.find_one({"id": "app_settings"}, {"_id": 0})
    return doc

# ============= Stats =============
@api.get("/stats")
async def stats(user: dict = Depends(get_current_user)):
    total_personil = await db.users.count_documents({"role": "personil", "active": True})
    pending = await db.requests.count_documents({"status": "pending"})
    approved = await db.requests.count_documents({"status": "approved"})
    today = date.today().isoformat()
    todays = await db.schedules.find({"date": today}, {"_id": 0}).to_list(1000)
    counts = {"Pagi": 0, "Siang": 0, "Malam": 0, "Libur": 0, "Other": 0}
    for s in todays:
        if s["shift"] in counts:
            counts[s["shift"]] += 1
        else:
            counts["Other"] += 1
    return {
        "total_personil": total_personil,
        "pending_requests": pending,
        "approved_requests": approved,
        "today_counts": counts,
    }

@api.get("/")
async def root():
    return {"message": "Shift Scheduler API", "status": "ok"}

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============= Startup =============
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("nik", unique=True)
    await db.schedules.create_index([("user_id", 1), ("date", 1)], unique=True)
    await db.requests.create_index("user_id")
    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
    admin_nik = os.environ.get("ADMIN_NIK", "0000000001")
    admin_pw = os.environ.get("ADMIN_PASSWORD", "admin123")
    admin_name = os.environ.get("ADMIN_NAME", "Administrator")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": new_id(),
            "email": admin_email,
            "nik": admin_nik,
            "name": admin_name,
            "password_hash": hash_password(admin_pw),
            "role": "admin",
            "jabatan": "Kepala Unit",
            "phone": "",
            "active": True,
            "photo": None,
            "created_at": now_iso(),
        })
        logger.info(f"Admin seeded: {admin_email}")
    else:
        # Ensure admin role + updated password if changed
        updates = {"role": "admin", "active": True}
        if not verify_password(admin_pw, existing.get("password_hash", "")):
            updates["password_hash"] = hash_password(admin_pw)
        await db.users.update_one({"email": admin_email}, {"$set": updates})
    # Seed default settings + backfill new fields on existing settings
    existing_settings = await db.settings.find_one({"id": "app_settings"})
    if not existing_settings:
        await db.settings.insert_one(dict(DEFAULT_SETTINGS))
    else:
        missing = {k: v for k, v in DEFAULT_SETTINGS.items() if k not in existing_settings}
        if missing:
            await db.settings.update_one({"id": "app_settings"}, {"$set": missing})

@app.on_event("shutdown")
async def shutdown():
    client.close()

"""Backend tests for Shift Scheduler - Iteration 2.
Focus on new features: schedule audit log + email dispatch on request decision + regression."""
import os
import uuid
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL",
                     "https://shift-scheduler-297.preview.emergentagent.com").rstrip("/") + "/api"

ADMIN_CREDS = {"email": "rsqikurniawan@gmail.com", "nik": "1000000001", "password": "Admin@123"}


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE}/auth/login", json=ADMIN_CREDS, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def personil(admin_headers):
    """Register a fresh personil user for the whole session."""
    uniq = uuid.uuid4().hex[:8]
    payload = {
        "email": f"TEST_p_{uniq}@test.com",
        "nik": f"9{uniq}",
        "name": f"TEST Personil {uniq}",
        "password": "Test@123",
    }
    r = requests.post(f"{BASE}/auth/register", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    return {"token": data["token"], "user": data["user"], "creds": payload}


@pytest.fixture(scope="session")
def personil_headers(personil):
    return {"Authorization": f"Bearer {personil['token']}"}


# ---------- Regression: auth / personil / schedule / settings / stats ----------
class TestRegression:
    def test_root(self):
        r = requests.get(f"{BASE}/", timeout=15)
        assert r.status_code == 200

    def test_admin_login(self, admin_token):
        assert admin_token

    def test_login_wrong_password(self):
        r = requests.post(f"{BASE}/auth/login",
                          json={**ADMIN_CREDS, "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_auth_me(self, admin_headers):
        r = requests.get(f"{BASE}/auth/me", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_personil_list(self, admin_headers):
        r = requests.get(f"{BASE}/personil", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_schedule_generate_and_get(self, admin_headers, personil_headers):
        r = requests.post(f"{BASE}/schedule/generate", headers=admin_headers,
                          json={"month": 12, "year": 2025, "overwrite": True}, timeout=60)
        assert r.status_code == 200
        assert r.json().get("created", 0) > 0
        r2 = requests.get(f"{BASE}/schedule?month=12&year=2025",
                          headers=personil_headers, timeout=30)
        assert r2.status_code == 200
        assert len(r2.json()) > 0

    def test_settings_get_patch(self, admin_headers):
        r = requests.get(f"{BASE}/settings", headers=admin_headers, timeout=15)
        assert r.status_code == 200 and "title" in r.json()
        r = requests.patch(f"{BASE}/settings", headers=admin_headers,
                           json={"title": "Custom Title"}, timeout=15)
        assert r.status_code == 200 and r.json()["title"] == "Custom Title"

    def test_stats(self, admin_headers):
        r = requests.get(f"{BASE}/stats", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        for k in ("total_personil", "pending_requests", "today_counts"):
            assert k in r.json()


# ---------- Audit log for manual cell edits ----------
class TestAuditManual:
    def test_manual_edit_creates_audit_before_null_then_prev(self, admin_headers, personil):
        uid = personil["user"]["id"]
        # Use a date outside generated month so we can predict shift_before=null
        target_date = "2027-03-15"
        # First write - shift_before should be null
        r = requests.post(f"{BASE}/schedule/cell", headers=admin_headers,
                          json={"user_id": uid, "date": target_date, "shift": "Pagi"}, timeout=15)
        assert r.status_code == 200

        # Second write - shift_before should be 'Pagi'
        r = requests.post(f"{BASE}/schedule/cell", headers=admin_headers,
                          json={"user_id": uid, "date": target_date, "shift": "Siang"}, timeout=15)
        assert r.status_code == 200

        # Fetch audit for that month
        r = requests.get(f"{BASE}/schedule/audit?month=3&year=2027",
                         headers=admin_headers, timeout=15)
        assert r.status_code == 200
        rows = [x for x in r.json() if x["user_id"] == uid and x["date"] == target_date]
        # Sorted DESC by changed_at, latest first
        assert len(rows) >= 2, f"Expected at least 2 rows, got {len(rows)}"
        latest, first = rows[0], rows[-1]
        assert latest["shift_after"] == "Siang"
        assert latest["shift_before"] == "Pagi"
        assert latest["source"] == "manual"
        assert latest["changed_by_name"]  # non-empty
        assert first["shift_before"] is None
        assert first["shift_after"] == "Pagi"

    def test_audit_requires_admin(self, personil_headers):
        r = requests.get(f"{BASE}/schedule/audit", headers=personil_headers, timeout=15)
        assert r.status_code == 403

    def test_audit_month_year_filter(self, admin_headers):
        r = requests.get(f"{BASE}/schedule/audit?month=3&year=2027",
                         headers=admin_headers, timeout=15)
        assert r.status_code == 200
        for x in r.json():
            assert x["date"].startswith("2027-03-"), f"Bad date in filtered result: {x['date']}"


# ---------- Audit + email for request approval / rejection ----------
class TestRequestDecisionAuditAndEmail:
    def _create_request(self, personil_headers, req_type, start, end):
        r = requests.post(f"{BASE}/requests", headers=personil_headers,
                          json={"type": req_type, "start_date": start,
                                "end_date": end, "reason": "test"}, timeout=15)
        assert r.status_code == 200, r.text
        return r.json()["id"]

    def test_approve_creates_audit_per_day(self, admin_headers, personil_headers, personil):
        uid = personil["user"]["id"]
        start, end = "2027-04-10", "2027-04-13"  # 4 days
        req_id = self._create_request(personil_headers, "Cuti Tahunan", start, end)
        r = requests.patch(f"{BASE}/requests/{req_id}", headers=admin_headers,
                           json={"status": "approved", "admin_note": "OK"}, timeout=60)
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "approved"
        assert body["admin_note"] == "OK"
        assert body["decided_at"] is not None

        r2 = requests.get(f"{BASE}/schedule/audit?month=4&year=2027",
                          headers=admin_headers, timeout=15)
        assert r2.status_code == 200
        rows = [x for x in r2.json()
                if x["user_id"] == uid and x["source"] == "request-approve"
                and x["date"] >= start and x["date"] <= end]
        assert len(rows) == 4, f"Expected 4 audit rows, got {len(rows)}"
        for row in rows:
            assert row["shift_after"] == "Cuti Tahunan"

    def test_reject_no_audit_no_schedule_change(self, admin_headers, personil_headers, personil):
        uid = personil["user"]["id"]
        start, end = "2027-05-05", "2027-05-06"
        req_id = self._create_request(personil_headers, "Sakit", start, end)
        r = requests.patch(f"{BASE}/requests/{req_id}", headers=admin_headers,
                           json={"status": "rejected", "admin_note": "no"}, timeout=30)
        assert r.status_code == 200
        assert r.json()["status"] == "rejected"

        # No audit rows for these dates from request-approve
        r2 = requests.get(f"{BASE}/schedule/audit?month=5&year=2027",
                          headers=admin_headers, timeout=15)
        rows = [x for x in r2.json()
                if x["user_id"] == uid and x["source"] == "request-approve"
                and start <= x["date"] <= end]
        assert len(rows) == 0

        # No schedule row for user with shift 'Sakit' for those dates
        r3 = requests.get(f"{BASE}/schedule?month=5&year=2027",
                          headers=admin_headers, timeout=15)
        bad = [s for s in r3.json()
               if s["user_id"] == uid and start <= s["date"] <= end and s["shift"] == "Sakit"]
        assert len(bad) == 0

    def test_approve_response_shape(self, admin_headers, personil_headers):
        req_id = self._create_request(personil_headers, "Diklat", "2027-06-01", "2027-06-01")
        r = requests.patch(f"{BASE}/requests/{req_id}", headers=admin_headers,
                           json={"status": "approved", "admin_note": "training"}, timeout=60)
        assert r.status_code == 200
        for k in ("status", "admin_note", "decided_at"):
            assert k in r.json()

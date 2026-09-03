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



# ---------- Iteration 3: schedule/summary + conflict detection + force approve ----------
def _login(email, nik, pw):
    r = requests.post(f"{BASE}/auth/login",
                      json={"email": email, "nik": nik, "password": pw}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="class")
def three_personil(admin_headers):
    """Create 3 fresh personil users via /api/personil (admin) for conflict tests."""
    users = []
    for i in range(3):
        uniq = uuid.uuid4().hex[:8]
        payload = {
            "email": f"TEST_conf_{uniq}@test.com",
            "nik": f"81{uniq}",
            "name": f"TEST Conf {i}_{uniq}",
            "password": "Test@123",
            "role": "personil",
        }
        r = requests.post(f"{BASE}/personil", headers=admin_headers, json=payload, timeout=15)
        assert r.status_code == 200, r.text
        u = r.json()
        tok = _login(payload["email"], payload["nik"], payload["password"])["token"]
        users.append({"user": u, "token": tok, "creds": payload})
    return users


class TestScheduleSummary:
    def test_summary_shape_admin(self, admin_headers):
        r = requests.get(f"{BASE}/schedule/summary?month=12&year=2025",
                         headers=admin_headers, timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert body["month"] == 12 and body["year"] == 2025
        assert body["days_in_month"] == 31
        assert isinstance(body["rows"], list) and len(body["rows"]) > 0
        row = body["rows"][0]
        for k in ("user_id", "name", "nik", "counts", "total_work",
                  "total_libur", "total_cuti", "total_absen"):
            assert k in row, f"missing {k}"
        for code in ["Pagi", "Siang", "Malam", "Libur", "Cuti Tahunan",
                     "Cuti Penting", "Cuti Besar", "Sakit", "Dinas Luar",
                     "Diklat", "Penugasan"]:
            assert code in row["counts"], f"missing shift code {code}"
        # totals consistency
        c = row["counts"]
        assert row["total_work"] == c["Pagi"] + c["Siang"] + c["Malam"]
        assert row["total_libur"] == c["Libur"]
        assert row["total_cuti"] == c["Cuti Tahunan"] + c["Cuti Penting"] + c["Cuti Besar"]
        assert row["total_absen"] == c["Sakit"] + c["Dinas Luar"] + c["Diklat"] + c["Penugasan"]

    def test_summary_accessible_by_personil(self, personil_headers):
        r = requests.get(f"{BASE}/schedule/summary?month=12&year=2025",
                         headers=personil_headers, timeout=30)
        assert r.status_code == 200
        assert "rows" in r.json()


class TestSettingsMinActive:
    def test_patch_and_get_min_active(self, admin_headers):
        r = requests.patch(f"{BASE}/settings", headers=admin_headers,
                           json={"min_active_per_shift": 2}, timeout=15)
        assert r.status_code == 200
        assert r.json()["min_active_per_shift"] == 2
        r = requests.get(f"{BASE}/settings", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        assert r.json()["min_active_per_shift"] == 2
        # Reset to 3 for downstream conflict test
        r = requests.patch(f"{BASE}/settings", headers=admin_headers,
                           json={"min_active_per_shift": 3}, timeout=15)
        assert r.status_code == 200 and r.json()["min_active_per_shift"] == 3


class TestConflictAndForce:
    """Set up 3 personil on Pagi for 2026-03-10 & 2026-03-11, then run conflict flow."""

    @staticmethod
    def _set_cell(admin_headers, uid, date_str, shift):
        r = requests.post(f"{BASE}/schedule/cell", headers=admin_headers,
                          json={"user_id": uid, "date": date_str, "shift": shift}, timeout=15)
        assert r.status_code == 200, r.text

    def test_a_setup_seed_schedule(self, admin_headers, three_personil):
        # Ensure min_active=3
        r = requests.patch(f"{BASE}/settings", headers=admin_headers,
                           json={"min_active_per_shift": 3}, timeout=15)
        assert r.status_code == 200
        # Delete any existing rows for these users on these dates by overwriting
        for u in three_personil:
            self._set_cell(admin_headers, u["user"]["id"], "2026-03-10", "Pagi")
            self._set_cell(admin_headers, u["user"]["id"], "2026-03-11", "Pagi")

    def test_b_approve_conflict_returns_409(self, admin_headers, three_personil):
        p = three_personil[0]
        h = {"Authorization": f"Bearer {p['token']}"}
        req = requests.post(f"{BASE}/requests", headers=h, json={
            "type": "Cuti Tahunan", "start_date": "2026-03-10",
            "end_date": "2026-03-10", "reason": "conflict test",
        }, timeout=15)
        assert req.status_code == 200
        rid = req.json()["id"]
        r = requests.patch(f"{BASE}/requests/{rid}", headers=admin_headers,
                           json={"status": "approved"}, timeout=30)
        assert r.status_code == 409, f"expected 409, got {r.status_code} {r.text}"
        detail = r.json()["detail"]
        assert "message" in detail and "conflicts" in detail
        assert detail["min_active"] == 3
        c = next((c for c in detail["conflicts"]
                  if c["date"] == "2026-03-10" and c["shift"] == "Pagi"), None)
        assert c is not None, f"conflict entry missing: {detail}"
        assert c["remaining"] == 2 and c["minimum"] == 3

        # Ensure request still pending, no schedule change
        got = requests.get(f"{BASE}/requests", headers=admin_headers, timeout=15).json()
        this_req = next(x for x in got if x["id"] == rid)
        assert this_req["status"] == "pending"

        sched = requests.get(f"{BASE}/schedule?month=3&year=2026",
                             headers=admin_headers, timeout=15).json()
        cell = next(s for s in sched
                    if s["user_id"] == p["user"]["id"] and s["date"] == "2026-03-10")
        assert cell["shift"] == "Pagi"

        # Save id for next test via class attribute
        TestConflictAndForce._pending_rid = rid
        TestConflictAndForce._uid = p["user"]["id"]

    def test_c_force_approve_succeeds(self, admin_headers):
        rid = TestConflictAndForce._pending_rid
        uid = TestConflictAndForce._uid
        r = requests.patch(f"{BASE}/requests/{rid}", headers=admin_headers,
                           json={"status": "approved", "force": True,
                                 "admin_note": "forced"}, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "approved"
        # Schedule cell should now be Cuti Tahunan
        sched = requests.get(f"{BASE}/schedule?month=3&year=2026",
                             headers=admin_headers, timeout=15).json()
        cell = next(s for s in sched if s["user_id"] == uid and s["date"] == "2026-03-10")
        assert cell["shift"] == "Cuti Tahunan"
        # Audit row created
        aud = requests.get(f"{BASE}/schedule/audit?month=3&year=2026",
                           headers=admin_headers, timeout=15).json()
        matching = [x for x in aud
                    if x["user_id"] == uid and x["date"] == "2026-03-10"
                    and x["source"] == "request-approve"
                    and x["shift_after"] == "Cuti Tahunan"]
        assert len(matching) >= 1

    def test_d_no_conflict_when_min_lowered(self, admin_headers, three_personil):
        # Lower min to 2
        r = requests.patch(f"{BASE}/settings", headers=admin_headers,
                           json={"min_active_per_shift": 2}, timeout=15)
        assert r.status_code == 200
        # 2026-03-11: still 3 users on Pagi from setup — approve one Cuti (remaining=2 >= 2)
        p = three_personil[1]
        h = {"Authorization": f"Bearer {p['token']}"}
        req = requests.post(f"{BASE}/requests", headers=h, json={
            "type": "Cuti Tahunan", "start_date": "2026-03-11",
            "end_date": "2026-03-11", "reason": "no conflict",
        }, timeout=15)
        assert req.status_code == 200
        rid = req.json()["id"]
        r = requests.patch(f"{BASE}/requests/{rid}", headers=admin_headers,
                           json={"status": "approved"}, timeout=30)
        assert r.status_code == 200, f"expected 200 got {r.status_code} {r.text}"
        assert r.json()["status"] == "approved"

    def test_e_penugasan_bypasses_conflict(self, admin_headers, three_personil):
        # Reset min to 3 to make would-be-conflict again
        requests.patch(f"{BASE}/settings", headers=admin_headers,
                       json={"min_active_per_shift": 3}, timeout=15)
        # Set 3 personil back on Pagi for a fresh date 2026-03-12
        for u in three_personil:
            self._set_cell(admin_headers, u["user"]["id"], "2026-03-12", "Pagi")
        p = three_personil[2]
        h = {"Authorization": f"Bearer {p['token']}"}
        req = requests.post(f"{BASE}/requests", headers=h, json={
            "type": "Penugasan", "start_date": "2026-03-12",
            "end_date": "2026-03-12", "reason": "penugasan bypass",
        }, timeout=15)
        assert req.status_code == 200
        rid = req.json()["id"]
        r = requests.patch(f"{BASE}/requests/{rid}", headers=admin_headers,
                           json={"status": "approved"}, timeout=30)
        assert r.status_code == 200, f"Penugasan should bypass, got {r.status_code} {r.text}"
        assert r.json()["status"] == "approved"

    def test_f_reject_unaffected_by_conflict(self, admin_headers, three_personil):
        # Re-seed 2026-03-13 with 3 on Pagi (min_active=3)
        requests.patch(f"{BASE}/settings", headers=admin_headers,
                       json={"min_active_per_shift": 3}, timeout=15)
        for u in three_personil:
            self._set_cell(admin_headers, u["user"]["id"], "2026-03-13", "Pagi")
        p = three_personil[0]
        h = {"Authorization": f"Bearer {p['token']}"}
        req = requests.post(f"{BASE}/requests", headers=h, json={
            "type": "Sakit", "start_date": "2026-03-13",
            "end_date": "2026-03-13", "reason": "reject test",
        }, timeout=15)
        assert req.status_code == 200
        rid = req.json()["id"]
        r = requests.patch(f"{BASE}/requests/{rid}", headers=admin_headers,
                           json={"status": "rejected", "admin_note": "no"}, timeout=30)
        assert r.status_code == 200
        assert r.json()["status"] == "rejected"

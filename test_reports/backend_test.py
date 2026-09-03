import requests, json, uuid
BASE = "https://shift-scheduler-297.preview.emergentagent.com/api"

results = {"passed": [], "failed": []}
def rec(name, cond, evidence=""):
    if cond:
        results["passed"].append(name)
        print(f"PASS: {name}")
    else:
        results["failed"].append({"area": name, "evidence": evidence})
        print(f"FAIL: {name} - {evidence}")

# 1. Root
r = requests.get(f"{BASE}/")
rec("root", r.status_code == 200, r.text[:200])

# 2. Admin login
r = requests.post(f"{BASE}/auth/login", json={"email":"rsqikurniawan@gmail.com","nik":"1000000001","password":"Admin@123"})
rec("admin_login", r.status_code==200 and "token" in r.json(), f"{r.status_code} {r.text[:200]}")
admin_token = r.json().get("token")
AH = {"Authorization": f"Bearer {admin_token}"}

# 3. Login wrong password
r = requests.post(f"{BASE}/auth/login", json={"email":"rsqikurniawan@gmail.com","nik":"1000000001","password":"wrong"})
rec("login_wrong_password_401", r.status_code==401, str(r.status_code))

# 4. Login wrong nik
r = requests.post(f"{BASE}/auth/login", json={"email":"rsqikurniawan@gmail.com","nik":"9999999999","password":"Admin@123"})
rec("login_wrong_nik_401", r.status_code==401, str(r.status_code))

# 5. Register new personil (unique per run)
uniq = uuid.uuid4().hex[:6]
email = f"budi_{uniq}@test.com"
nik = f"2{uniq[:9]}"
r = requests.post(f"{BASE}/auth/register", json={"email":email,"nik":nik,"name":"Budi Santoso","password":"Test@123"})
rec("register_personil", r.status_code==200 and "token" in r.json(), f"{r.status_code} {r.text[:200]}")
personil_token = r.json().get("token")
personil_user = r.json().get("user", {})
PH = {"Authorization": f"Bearer {personil_token}"}

# 6. Duplicate email
r = requests.post(f"{BASE}/auth/register", json={"email":email,"nik":f"3{uniq[:9]}","name":"Dup","password":"Test@123"})
rec("dup_email_400", r.status_code==400, f"{r.status_code} {r.text[:100]}")

# 7. Duplicate NIK
r = requests.post(f"{BASE}/auth/register", json={"email":f"other_{uniq}@t.com","nik":nik,"name":"Dup","password":"Test@123"})
rec("dup_nik_400", r.status_code==400, f"{r.status_code} {r.text[:100]}")

# 8. GET /auth/me
r = requests.get(f"{BASE}/auth/me", headers=AH)
rec("auth_me", r.status_code==200 and r.json().get("role")=="admin", f"{r.status_code} {r.text[:200]}")

# 9. Admin create personil
uniq2 = uuid.uuid4().hex[:6]
email2 = f"per_{uniq2}@t.com"
nik2 = f"4{uniq2[:9]}"
r = requests.post(f"{BASE}/personil", headers=AH, json={"email":email2,"nik":nik2,"name":"P2","password":"Test@123","jabatan":"Staff","role":"personil"})
rec("admin_create_personil", r.status_code==200, f"{r.status_code} {r.text[:200]}")
new_pid = r.json().get("id") if r.status_code==200 else None

# 10. Non-admin forbidden on create personil
r = requests.post(f"{BASE}/personil", headers=PH, json={"email":f"x_{uniq2}@t.com","nik":f"5{uniq2[:9]}","name":"X","password":"Test@123"})
rec("nonadmin_403_create_personil", r.status_code==403, str(r.status_code))

# 11. PATCH personil
if new_pid:
    r = requests.patch(f"{BASE}/personil/{new_pid}", headers=AH, json={"name":"P2 Updated","jabatan":"Senior"})
    rec("patch_personil", r.status_code==200 and r.json().get("name")=="P2 Updated", f"{r.status_code} {r.text[:200]}")

# 12. Non-admin forbidden on settings PATCH
r = requests.patch(f"{BASE}/settings", headers=PH, json={"title":"Hack"})
rec("nonadmin_403_settings", r.status_code==403, str(r.status_code))

# 13. Schedule generate
r = requests.post(f"{BASE}/schedule/generate", headers=AH, json={"month":12,"year":2025,"overwrite":True})
rec("schedule_generate", r.status_code==200 and r.json().get("created",0)>0, f"{r.status_code} {r.text[:200]}")
gen_info = r.json() if r.status_code==200 else {}

# 14. Non-admin forbidden generate
r = requests.post(f"{BASE}/schedule/generate", headers=PH, json={"month":12,"year":2025})
rec("nonadmin_403_generate", r.status_code==403, str(r.status_code))

# 15. GET schedule
r = requests.get(f"{BASE}/schedule?month=12&year=2025", headers=PH)
rec("get_schedule", r.status_code==200 and isinstance(r.json(), list) and len(r.json())>0, f"{r.status_code} count={len(r.json()) if r.status_code==200 else 'n/a'}")

# 16. POST /schedule/cell
r = requests.post(f"{BASE}/schedule/cell", headers=AH, json={"user_id":personil_user["id"],"date":"2025-12-15","shift":"Pagi"})
rec("schedule_cell_upsert", r.status_code==200 and r.json().get("shift")=="Pagi", f"{r.status_code} {r.text[:200]}")

# 17. Create request (personil)
r = requests.post(f"{BASE}/requests", headers=PH, json={"type":"Cuti Tahunan","start_date":"2025-12-20","end_date":"2025-12-22","reason":"Vacation"})
rec("create_request", r.status_code==200 and r.json().get("status")=="pending", f"{r.status_code} {r.text[:200]}")
req_id = r.json().get("id") if r.status_code==200 else None

# 18. Approve -> overrides schedule
if req_id:
    r = requests.patch(f"{BASE}/requests/{req_id}", headers=AH, json={"status":"approved","admin_note":"OK"})
    rec("approve_request", r.status_code==200 and r.json().get("status")=="approved", f"{r.status_code} {r.text[:200]}")
    # verify schedule updated
    r2 = requests.get(f"{BASE}/schedule?month=12&year=2025", headers=AH)
    sched = r2.json()
    overridden = [s for s in sched if s["user_id"]==personil_user["id"] and s["date"] in ["2025-12-20","2025-12-21","2025-12-22"] and s["shift"]=="Cuti Tahunan"]
    rec("approve_overrides_schedule", len(overridden)==3, f"overridden={len(overridden)}")

# 19. Create + reject request
r = requests.post(f"{BASE}/requests", headers=PH, json={"type":"Sakit","start_date":"2025-12-25","end_date":"2025-12-25","reason":"sick"})
rid2 = r.json().get("id") if r.status_code==200 else None
if rid2:
    r = requests.patch(f"{BASE}/requests/{rid2}", headers=AH, json={"status":"rejected","admin_note":"no"})
    rec("reject_request", r.status_code==200 and r.json().get("status")=="rejected", f"{r.status_code}")
    r2 = requests.get(f"{BASE}/schedule?month=12&year=2025", headers=AH)
    reject_check = [s for s in r2.json() if s["user_id"]==personil_user["id"] and s["date"]=="2025-12-25" and s["shift"]=="Sakit"]
    rec("reject_no_schedule_change", len(reject_check)==0, f"found={len(reject_check)}")

# 20. GET /requests personil sees only own
r = requests.get(f"{BASE}/requests", headers=PH)
own_only = all(x.get("user_id")==personil_user["id"] for x in r.json())
rec("personil_own_requests", r.status_code==200 and own_only, f"{r.status_code} count={len(r.json())}")

# 21. GET /requests admin sees all
r = requests.get(f"{BASE}/requests", headers=AH)
rec("admin_all_requests", r.status_code==200 and len(r.json())>=2, f"count={len(r.json())}")

# 22. GET/PATCH settings
r = requests.get(f"{BASE}/settings", headers=AH)
rec("get_settings", r.status_code==200 and "title" in r.json(), f"{r.status_code}")
r = requests.patch(f"{BASE}/settings", headers=AH, json={"title":"Custom Title","subtitle":"Sub","logo":"data:image/png;base64,iVBORw0KGgo=","signer_name":"Admin X"})
rec("patch_settings", r.status_code==200 and r.json().get("title")=="Custom Title", f"{r.status_code} {r.text[:200]}")

# 23. Stats
r = requests.get(f"{BASE}/stats", headers=AH)
d = r.json() if r.status_code==200 else {}
rec("stats", r.status_code==200 and "total_personil" in d and "pending_requests" in d and "today_counts" in d, f"{r.status_code} {d}")

# 24. DELETE personil (cascade schedules)
if new_pid:
    r = requests.delete(f"{BASE}/personil/{new_pid}", headers=AH)
    rec("delete_personil", r.status_code==200, f"{r.status_code}")

print("\n===SUMMARY===")
print(f"Passed: {len(results['passed'])}, Failed: {len(results['failed'])}")
print(json.dumps(results, indent=2))

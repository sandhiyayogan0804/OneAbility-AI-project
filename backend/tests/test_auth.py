import sys
import os

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from main import app
from config.database import SessionLocal
from models.user import User
from models.accessibility import AccessibilityPreference
from models.notification import Notification
from models.security import SecurityEvent

client = TestClient(app)

def run_auth_verification():
    print("========================================")
    print("OneAbility AI - Step 6 Authentication Verification")
    print("========================================\n")

    test_phone = "9876543210"
    test_email = "testuser@oneability.ai"
    test_password = "SecurePassword@123"
    test_name = "Alex Johnson"

    # Cleanup any previous test data
    db = SessionLocal()
    existing_user = db.query(User).filter(User.phone_number == test_phone).first()
    if existing_user:
        db.delete(existing_user)
        db.commit()
    db.close()

    # 1. Test Registration
    print("1. Testing User Registration (POST /api/auth/register)...")
    reg_payload = {
        "full_name": test_name,
        "phone_number": test_phone,
        "email": test_email,
        "password": test_password,
        "upi_id": "alex@oneability"
    }
    reg_res = client.post("/api/auth/register", json=reg_payload)
    print(f"   Status Code: {reg_res.status_code}")
    assert reg_res.status_code == 201, f"Expected 201, got {reg_res.status_code}: {reg_res.text}"
    user_data = reg_res.json()
    print(f"   Registered User ID: {user_data.get('id')}, Name: {user_data.get('full_name')}")
    assert "password_hash" not in user_data, "Security alert: password_hash leaked in response!"
    assert user_data.get("phone_number") == test_phone
    print("   [PASS] Registration succeeded and password hash is safely concealed.")

    # 2. Test Duplicate Registration Prevention
    print("\n2. Testing Duplicate Registration Prevention...")
    dup_res = client.post("/api/auth/register", json=reg_payload)
    print(f"   Status Code: {dup_res.status_code}")
    assert dup_res.status_code == 400, f"Expected 400, got {dup_res.status_code}: {dup_res.text}"
    print(f"   Detail: {dup_res.json().get('detail')}")
    print("   [PASS] Duplicate phone number correctly blocked.")

    # 3. Test Login with Invalid Password
    print("\n3. Testing Login with Incorrect Password...")
    bad_login_res = client.post("/api/auth/login", json={
        "identifier": test_phone,
        "password": "WrongPassword123"
    })
    print(f"   Status Code: {bad_login_res.status_code}")
    assert bad_login_res.status_code == 401, f"Expected 401, got {bad_login_res.status_code}: {bad_login_res.text}"
    print("   [PASS] Incorrect credentials rejected with 401 Unauthorized.")

    # 4. Test Login with Valid Phone Number
    print("\n4. Testing Login with Valid Credentials (by Phone Number)...")
    login_res = client.post("/api/auth/login", json={
        "identifier": test_phone,
        "password": test_password
    })
    print(f"   Status Code: {login_res.status_code}")
    assert login_res.status_code == 200, f"Expected 200, got {login_res.status_code}: {login_res.text}"
    token_data = login_res.json()
    token = token_data.get("access_token")
    assert token is not None, "Missing access_token in response"
    print(f"   Token Type: {token_data.get('token_type')}, Expires In: {token_data.get('expires_in')}s")
    print(f"   Token Prefix: {token[:20]}...")
    print("   [PASS] Login succeeded and JWT token issued.")

    # 5. Test Login with Email Identifier
    print("\n5. Testing Login with Email as Identifier...")
    email_login_res = client.post("/api/auth/login", json={
        "identifier": test_email,
        "password": test_password
    })
    assert email_login_res.status_code == 200, f"Expected 200, got {email_login_res.status_code}"
    print("   [PASS] Login via email identifier succeeded.")

    # 6. Test Protected Endpoint Without Token
    print("\n6. Testing Protected Endpoint (/api/auth/me) Without Token...")
    no_token_res = client.get("/api/auth/me")
    print(f"   Status Code: {no_token_res.status_code}")
    assert no_token_res.status_code == 401, f"Expected 401, got {no_token_res.status_code}"
    print("   [PASS] Unauthorized request rejected.")

    # 7. Test Protected Endpoint With Invalid Token
    print("\n7. Testing Protected Endpoint (/api/auth/me) With Invalid Token...")
    bad_token_res = client.get("/api/auth/me", headers={"Authorization": "Bearer invalid.token.payload"})
    print(f"   Status Code: {bad_token_res.status_code}")
    assert bad_token_res.status_code == 401, f"Expected 401, got {bad_token_res.status_code}"
    print("   [PASS] Invalid token rejected.")

    # 8. Test Protected Endpoint With Valid Token
    print("\n8. Testing Protected Endpoint (/api/auth/me) With Valid Token...")
    auth_headers = {"Authorization": f"Bearer {token}"}
    me_res = client.get("/api/auth/me", headers=auth_headers)
    print(f"   Status Code: {me_res.status_code}")
    assert me_res.status_code == 200, f"Expected 200, got {me_res.status_code}: {me_res.text}"
    profile = me_res.json()
    print(f"   Authenticated User: {profile.get('full_name')} ({profile.get('phone_number')})")
    assert profile.get("phone_number") == test_phone
    print("   [PASS] Protected current-user endpoint successfully returned profile.")

    # 9. Test Token Verification Endpoint
    print("\n9. Testing Token Verification Endpoint (/api/auth/verify-token)...")
    verify_res = client.get("/api/auth/verify-token", headers=auth_headers)
    print(f"   Status Code: {verify_res.status_code}")
    assert verify_res.status_code == 200
    v_data = verify_res.json()
    print(f"   Verification: valid={v_data.get('valid')}, user_id={v_data.get('user_id')}")
    assert v_data.get("valid") is True
    print("   [PASS] Token verification endpoint confirmed valid.")

    # 10. Verify Relational Database Records
    print("\n10. Verifying Database Records Created for User...")
    db = SessionLocal()
    user_in_db = db.query(User).filter(User.phone_number == test_phone).first()
    assert user_in_db is not None
    assert user_in_db.password_hash.startswith("$2b$")

    # Check accessibility preferences auto-created
    pref = db.query(AccessibilityPreference).filter(AccessibilityPreference.user_id == user_in_db.id).first()
    assert pref is not None
    print(f"   Accessibility Prefs Created: voice_guidance={pref.voice_guidance}, haptic={pref.haptic_feedback}")

    # Check welcome notification
    notes = db.query(Notification).filter(Notification.user_id == user_in_db.id).all()
    print(f"   Notifications Recorded: {len(notes)}")
    assert len(notes) >= 1

    # Check security events audit log
    sec_events = db.query(SecurityEvent).filter(SecurityEvent.user_id == user_in_db.id).all()
    event_types = [e.event_type for e in sec_events]
    print(f"   Security Events Logged: {event_types}")
    assert "USER_REGISTERED" in event_types
    assert "LOGIN_SUCCESS" in event_types
    db.close()
    print("   [PASS] Database integrity, accessibility defaults, and security logs verified.")

    print("\n========================================")
    print("ALL 10 AUTHENTICATION TESTS PASSED SUCCESSFULLY!")
    print("========================================")

if __name__ == "__main__":
    run_auth_verification()

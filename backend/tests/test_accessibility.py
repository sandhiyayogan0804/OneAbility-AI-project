import sys
import os

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def run_accessibility_tests():
    print("==================================================")
    print("STEP 13: ACCESSIBILITY FOUNDATION TESTS")
    print("==================================================")

    # 1. Login
    print("\n1. Logging in as Alex Johnson...")
    login_res = client.post("/api/auth/login", json={
        "identifier": "9876543210",
        "password": "SecurePassword@123"
    })
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("   [PASS] Authenticated successfully.")

    # 2. Test Unauthenticated Access Protection (401)
    print("\n2. Testing Unauthenticated Protection...")
    r_unauth = client.get("/api/accessibility/preferences")
    assert r_unauth.status_code == 401
    print("   [PASS] Unauthenticated GET correctly rejected with 401.")

    r_unauth_put = client.put("/api/accessibility/preferences", json={"high_contrast": True})
    assert r_unauth_put.status_code == 401
    print("   [PASS] Unauthenticated PUT correctly rejected with 401.")

    # 3. Test GET Initial Preferences
    print("\n3. Testing GET User Preferences...")
    r_get = client.get("/api/accessibility/preferences", headers=headers)
    assert r_get.status_code == 200
    data = r_get.json()
    assert "high_contrast" in data
    assert "font_size_scale" in data
    assert "simple_mode" in data
    assert "reduced_motion" in data
    assert "voice_guidance" in data
    assert "haptic_feedback" in data
    assert "captions_enabled" in data
    print(f"   [PASS] Initial preferences retrieved: font={data['font_size_scale']}, contrast={data['high_contrast']}, simple={data['simple_mode']}")

    # 4. Test Updating Preferences (Large Text, High Contrast, Simple Mode, Reduced Motion)
    print("\n4. Testing Updating Accessibility Preferences (PUT)...")
    update_payload = {
        "high_contrast": True,
        "font_size_scale": "large",
        "simple_mode": True,
        "reduced_motion": True,
        "voice_guidance": True,
        "haptic_feedback": True,
        "captions_enabled": True,
        "preferred_language": "ta"
    }
    r_put = client.put("/api/accessibility/preferences", headers=headers, json=update_payload)
    assert r_put.status_code == 200
    updated_data = r_put.json()
    assert updated_data["high_contrast"] is True
    assert updated_data["font_size_scale"] == "large"
    assert updated_data["simple_mode"] is True
    assert updated_data["reduced_motion"] is True
    assert updated_data["preferred_language"] == "ta"
    print("   [PASS] Preferences updated: High Contrast=True, Font=large, Simple Mode=True, Reduced Motion=True, Lang=ta")

    # 5. Verify Persistence by Re-fetching
    print("\n5. Testing Persistence across Requests...")
    r_fetch = client.get("/api/accessibility/preferences", headers=headers)
    assert r_fetch.status_code == 200
    persisted = r_fetch.json()
    assert persisted["high_contrast"] is True
    assert persisted["font_size_scale"] == "large"
    assert persisted["simple_mode"] is True
    assert persisted["reduced_motion"] is True
    print("   [PASS] Changes correctly persisted in MySQL database.")

    # 6. Test Partial Update (PATCH)
    print("\n6. Testing Partial Preference Update (PATCH)...")
    r_patch = client.patch("/api/accessibility/preferences", headers=headers, json={
        "font_size_scale": "x-large",
        "simple_mode": False
    })
    assert r_patch.status_code == 200
    patched = r_patch.json()
    assert patched["font_size_scale"] == "x-large"
    assert patched["simple_mode"] is False
    assert patched["high_contrast"] is True  # Preserved from previous update!
    print("   [PASS] Partial update succeeded: font=x-large, simple_mode=False, high_contrast preserved.")

    # 7. Safety Verification: Ensure Accessibility APIs Never Touch Balance or Payments
    print("\n7. Verifying Independence from Payments...")
    dash_res = client.get("/api/dashboard/home", headers=headers)
    balance_before = dash_res.json()["primary_account"]["balance"]

    # Toggle preferences multiple times
    for toggle in [False, True, False]:
        client.put("/api/accessibility/preferences", headers=headers, json={"high_contrast": toggle})

    dash_after = client.get("/api/dashboard/home", headers=headers)
    balance_after = dash_after.json()["primary_account"]["balance"]
    assert balance_before == balance_after
    print(f"   [PASS] Account balance unaffected by accessibility operations (₹{balance_after:.2f}).")

    print("\n==================================================")
    print("ALL ACCESSIBILITY BACKEND TESTS PASSED! (7/7)")
    print("==================================================")

if __name__ == "__main__":
    run_accessibility_tests()

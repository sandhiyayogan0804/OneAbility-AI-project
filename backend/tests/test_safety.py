import sys
import os

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def run_safety_tests():
    print("==================================================")
    print("STEP 12: PAYMENT SAFETY & AI RISK CHECKS TESTS")
    print("==================================================")

    # 1. Login
    print("\n1. Logging in as Alex Johnson...")
    login_res = client.post("/api/auth/login", json={
        "identifier": "9876543210",
        "password": "SecurePassword@123"
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("   [PASS] Authenticated successfully.")

    # Check baseline balance and transactions
    dash_res = client.get("/api/dashboard/home", headers=headers)
    initial_balance = dash_res.json()["primary_account"]["balance"]
    tx_res = client.get("/api/transactions", headers=headers)
    tx_data = tx_res.json()
    initial_tx_count = len(tx_data) if isinstance(tx_data, list) else tx_data.get("total_count", 0)
    print(f"   Baseline Balance: ₹{initial_balance:.2f}, Transactions: {initial_tx_count}")

    # 2. Test Normal Payment (Saved Beneficiary, Standard Amount)
    print("\n2. Testing Normal Payment (Low Risk)...")
    r_normal = client.post("/api/payments/safety-check", headers=headers, json={
        "recipient_type": "BENEFICIARY",
        "recipient_identifier": "priya@okaxis",
        "recipient_name": "Priya Sharma",
        "amount": 250.0,
        "source": "MANUAL"
    })
    assert r_normal.status_code == 200
    d_normal = r_normal.json()
    assert d_normal["risk_level"] == "LOW", f"Expected LOW risk, got {d_normal['risk_level']}"
    assert d_normal["is_safe_to_proceed"] is True
    assert d_normal["recommended_action"] == "ALLOW"
    assert d_normal["requires_strong_confirmation"] is False
    print(f"   [PASS] Normal payment -> Risk: {d_normal['risk_level']}, Action: {d_normal['recommended_action']}")

    # 3. Test New Beneficiary (Unsaved, Never Transacted)
    print("\n3. Testing New Beneficiary (Medium Risk, Not Blocked)...")
    r_new = client.post("/api/payments/safety-check", headers=headers, json={
        "recipient_type": "UPI_ID",
        "recipient_identifier": "firsttimeuser99@okicici",
        "recipient_name": "First Time Recipient",
        "amount": 500.0,
        "source": "MANUAL"
    })
    assert r_new.status_code == 200
    d_new = r_new.json()
    assert "NEW_RECIPIENT" in d_new["risk_flags"]
    assert d_new["risk_level"] in ["MEDIUM", "HIGH"]
    assert d_new["is_safe_to_proceed"] is True  # NOT BLOCKED!
    assert d_new["recommended_action"] == "CONFIRM_WITH_WARNING"
    assert d_new["requires_strong_confirmation"] is True
    print(f"   [PASS] New Beneficiary -> Flags: {d_new['risk_flags']}, Action: {d_new['recommended_action']}, Safe to proceed: {d_new['is_safe_to_proceed']}")

    # 4. Test High / Unusual Amount (> ₹10,000)
    print("\n4. Testing High / Unusual Amount...")
    r_high = client.post("/api/payments/safety-check", headers=headers, json={
        "recipient_type": "BENEFICIARY",
        "recipient_identifier": "priya@okaxis",
        "recipient_name": "Priya Sharma",
        "amount": 15000.0,
        "source": "MANUAL"
    })
    assert r_high.status_code == 200
    d_high = r_high.json()
    assert "HIGH_AMOUNT" in d_high["risk_flags"]
    assert d_high["requires_strong_confirmation"] is True
    print(f"   [PASS] High Amount -> Flags: {d_high['risk_flags']}, Risk: {d_high['risk_level']}")

    # 5. Test Insufficient Balance
    print("\n5. Testing Insufficient Balance (Blocked)...")
    r_insufficient = client.post("/api/payments/safety-check", headers=headers, json={
        "recipient_type": "BENEFICIARY",
        "recipient_identifier": "priya@okaxis",
        "recipient_name": "Priya Sharma",
        "amount": 999999.0,  # Exceeds limit & balance
        "source": "MANUAL"
    })
    assert r_insufficient.status_code == 200
    d_insufficient = r_insufficient.json()
    assert d_insufficient["risk_level"] == "CRITICAL"
    assert d_insufficient["is_safe_to_proceed"] is False
    assert d_insufficient["recommended_action"] == "BLOCK"
    print(f"   [PASS] Exceeding Balance/Limit -> Action: {d_insufficient['recommended_action']}, Flags: {d_insufficient['risk_flags']}")

    # 6. Test Invalid Recipient Format
    print("\n6. Testing Invalid Recipient Format...")
    r_invalid = client.post("/api/payments/safety-check", headers=headers, json={
        "recipient_type": "UPI_ID",
        "recipient_identifier": "not-a-valid-vpa",
        "recipient_name": "Bad Recipient",
        "amount": 200.0,
        "source": "MANUAL"
    })
    assert r_invalid.status_code == 200
    d_invalid = r_invalid.json()
    assert "INVALID_RECIPIENT" in d_invalid["risk_flags"]
    assert d_invalid["is_safe_to_proceed"] is False
    assert d_invalid["recommended_action"] == "BLOCK"
    print(f"   [PASS] Invalid Recipient -> Action: {d_invalid['recommended_action']}, Flags: {d_invalid['risk_flags']}")

    # 7. Test Suspicious QR / UPI Identifier (Scam Keywords)
    print("\n7. Testing Suspicious Scam/Phishing Identifier...")
    r_scam = client.post("/api/payments/safety-check", headers=headers, json={
        "recipient_type": "UPI_ID",
        "recipient_identifier": "lottery-prize-winner@upi",
        "recipient_name": "Lottery Department",
        "amount": 1000.0,
        "source": "QR"
    })
    assert r_scam.status_code == 200
    d_scam = r_scam.json()
    assert "SUSPICIOUS_IDENTIFIER" in d_scam["risk_flags"]
    assert d_scam["risk_level"] == "HIGH"
    assert d_scam["requires_strong_confirmation"] is True
    print(f"   [PASS] Suspicious Identifier -> Flags: {d_scam['risk_flags']}, Risk: {d_scam['risk_level']}, Title: {d_scam['warning_title']}")

    # 8. Test Duplicate Payment Check
    print("\n8. Testing Duplicate Payment Check...")
    # Execute a small real payment first
    execute_res = client.post("/api/payments/execute", headers=headers, json={
        "recipient_type": "CONTACT",
        "recipient_identifier": "priya@okaxis",
        "recipient_name": "Priya Sharma",
        "amount": 42.0,
        "description": "Pre-test payment for duplicate check"
    })
    assert execute_res.status_code == 200

    # Immediately perform safety check for same recipient & same amount
    r_dup = client.post("/api/payments/safety-check", headers=headers, json={
        "recipient_type": "CONTACT",
        "recipient_identifier": "priya@okaxis",
        "recipient_name": "Priya Sharma",
        "amount": 42.0,
        "source": "MANUAL"
    })
    assert r_dup.status_code == 200
    d_dup = r_dup.json()
    assert "DUPLICATE_PAYMENT_SUSPECTED" in d_dup["risk_flags"]
    assert d_dup["risk_level"] == "HIGH"
    assert d_dup["requires_strong_confirmation"] is True
    print(f"   [PASS] Duplicate Detected -> Flags: {d_dup['risk_flags']}, Title: {d_dup['warning_title']}")

    # 9. Test Authentication Requirement (401 without JWT)
    print("\n9. Testing Authentication Enforcement...")
    r_unauth = client.post("/api/payments/safety-check", json={
        "recipient_type": "UPI_ID",
        "recipient_identifier": "priya@okaxis",
        "amount": 100.0
    })
    assert r_unauth.status_code == 401
    print("   [PASS] Protected endpoint returned 401 for unauthenticated request.")

    # 10. CRITICAL SAFETY TEST: Verify that safety check alone never changes balance or creates transactions
    print("\n10. Verifying Safety Boundary (No payment auto-execution from safety checks)...")
    dash_mid = client.get("/api/dashboard/home", headers=headers)
    balance_before_batch = dash_mid.json()["primary_account"]["balance"]

    # Run 5 different safety checks
    for _ in range(5):
        client.post("/api/payments/safety-check", headers=headers, json={
            "recipient_type": "BENEFICIARY",
            "recipient_identifier": "priya@okaxis",
            "amount": 100.0
        })

    dash_final = client.get("/api/dashboard/home", headers=headers)
    balance_after_batch = dash_final.json()["primary_account"]["balance"]
    assert balance_before_batch == balance_after_batch
    print(f"   [PASS] Safety verified: Account balance completely unchanged (₹{balance_after_batch:.2f}).")

    # 11. Test Voice -> Safety Check -> Confirmation -> Simulated Payment Flow
    print("\n11. Testing Voice -> Safety Check -> Explicit Confirmation Flow...")
    # Step A: Voice parse
    v_res = client.post("/api/voice/parse", headers=headers, json={
        "text": "Send 75 rs to Priya",
        "language": "en"
    })
    assert v_res.status_code == 200
    v_data = v_res.json()

    # Step B: Safety check on parsed voice parameters
    v_safety = client.post("/api/payments/safety-check", headers=headers, json={
        "recipient_type": "CONTACT",
        "recipient_identifier": v_data["recipient"]["identifier"],
        "recipient_name": v_data["recipient"]["name"],
        "amount": v_data["amount"],
        "source": "VOICE"
    })
    assert v_safety.status_code == 200
    assert v_safety.json()["is_safe_to_proceed"] is True

    # Step C: Explicit user confirmation
    v_pay = client.post("/api/payments/execute", headers=headers, json={
        "recipient_type": "CONTACT",
        "recipient_identifier": v_data["recipient"]["identifier"],
        "recipient_name": v_data["recipient"]["name"],
        "amount": v_data["amount"],
        "description": "Voice payment with safety check verified"
    })
    assert v_pay.status_code == 200
    assert v_pay.json()["status"] == "SUCCESS"
    print(f"   [PASS] Voice flow with safety verification completed: Ref {v_pay.json()['reference_id']}")

    # 12. Test QR -> Safety Check -> Confirmation -> Simulated Payment Flow
    print("\n12. Testing QR -> Safety Check -> Explicit Confirmation Flow...")
    # Step A: QR parse
    qr_res = client.post("/api/qr/parse", headers=headers, json={
        "qr_data": "upi://pay?pa=ramesh@paytm&pn=Ramesh%20Kumar&am=120.00&cu=INR"
    })
    assert qr_res.status_code == 200
    qr_data = qr_res.json()

    # Step B: Safety check on QR data
    qr_safety = client.post("/api/payments/safety-check", headers=headers, json={
        "recipient_type": "UPI_ID",
        "recipient_identifier": qr_data["upi_id"],
        "recipient_name": qr_data["recipient_name"],
        "amount": qr_data["amount"],
        "source": "QR"
    })
    assert qr_safety.status_code == 200
    assert qr_safety.json()["is_safe_to_proceed"] is True

    # Step C: Explicit confirmation & execution
    qr_pay = client.post("/api/payments/execute", headers=headers, json={
        "recipient_type": "UPI_ID",
        "recipient_identifier": qr_data["upi_id"],
        "recipient_name": qr_data["recipient_name"],
        "amount": qr_data["amount"],
        "description": "QR payment with safety check verified"
    })
    assert qr_pay.status_code == 200
    assert qr_pay.json()["status"] == "SUCCESS"
    print(f"   [PASS] QR flow with safety verification completed: Ref {qr_pay.json()['reference_id']}")

    print("\n==================================================")
    print("ALL PAYMENT SAFETY TESTS PASSED! (12/12)")
    print("==================================================")

if __name__ == "__main__":
    run_safety_tests()

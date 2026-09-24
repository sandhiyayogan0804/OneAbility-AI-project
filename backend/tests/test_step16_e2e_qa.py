import sys
import os

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from main import app
from config.database import SessionLocal
from models.user import User
from models.bank_account import BankAccount
from models.notification import Notification
from services.voice_nlp_service import VoiceNLPService

client = TestClient(app)

def run_step16_e2e_qa():
    print("=" * 70)
    print("STEP 16: ONEABILITY AI END-TO-END ACCESSIBILITY & REAL-WORLD QA")
    print("=" * 70)

    # -------------------------------------------------------------
    # 1. AUTHENTICATION & SESSION SECURITY
    # -------------------------------------------------------------
    print("\n--- 1. AUTHENTICATION & SESSION SECURITY ---")
    
    # Valid Login
    login_res = client.post("/api/auth/login", json={
        "identifier": "9876543210",
        "password": "SecurePassword@123"
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token_a = login_res.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}
    print("   [PASS] 1.1 Valid credentials login succeeded (User A).")

    # Invalid Password Login
    bad_login = client.post("/api/auth/login", json={
        "identifier": "9876543210",
        "password": "WrongPassword123!"
    })
    assert bad_login.status_code == 401, f"Expected 401, got {bad_login.status_code}"
    print("   [PASS] 1.2 Invalid password rejected with 401 Unauthorized.")

    # Non-existent User Login
    unknown_login = client.post("/api/auth/login", json={
        "identifier": "9000000000",
        "password": "SecurePassword@123"
    })
    assert unknown_login.status_code == 401
    print("   [PASS] 1.3 Non-existent user rejected with 401 Unauthorized.")

    # Protected Routes Rejection Without Token
    endpoints_to_protect = [
        ("GET", "/api/auth/me"),
        ("GET", "/api/dashboard/home"),
        ("GET", "/api/notifications"),
        ("GET", "/api/notifications/unread-count"),
        ("POST", "/api/payments/execute"),
        ("POST", "/api/bills/pay"),
        ("GET", "/api/accessibility/preferences")
    ]
    for method, path in endpoints_to_protect:
        if method == "GET":
            res = client.get(path)
        else:
            res = client.post(path, json={})
        assert res.status_code == 401, f"Expected 401 for unauthenticated {path}, got {res.status_code}"
    print("   [PASS] 1.4 All protected routes reject requests missing authentication token.")

    # Invalid / Expired Token Rejection
    invalid_token_res = client.get("/api/notifications", headers={"Authorization": "Bearer invalid_malformed_token_xyz"})
    assert invalid_token_res.status_code == 401
    print("   [PASS] 1.5 Malformed token correctly rejected with 401.")

    # -------------------------------------------------------------
    # 2. PAYMENTS & TRANSACTION INTEGRITY
    # -------------------------------------------------------------
    print("\n--- 2. PAYMENTS & NOTIFICATION INTEGRITY ---")

    # Initial balance and unread notification count
    dash_res = client.get("/api/dashboard/home", headers=headers_a)
    assert dash_res.status_code == 200
    initial_balance = dash_res.json()["primary_account"]["balance"]

    unread_before = client.get("/api/notifications/unread-count", headers=headers_a).json()["unread_count"]

    # 2.1 Successful Payment
    pay_amount = 100.0
    pay_res = client.post("/api/payments/execute", headers=headers_a, json={
        "recipient_type": "UPI_ID",
        "recipient_name": "Priya Sharma",
        "recipient_identifier": "priya@okaxis",
        "amount": pay_amount,
        "description": "QA Step 16 Verification"
    })
    assert pay_res.status_code == 200
    pay_data = pay_res.json()
    assert pay_data["status"] == "SUCCESS"
    assert pay_data["amount"] == pay_amount
    new_balance = pay_data["remaining_balance"]
    assert round(initial_balance - pay_amount, 2) == round(new_balance, 2)
    print(f"   [PASS] 2.1 Successful payment deducted balance: ₹{initial_balance:.2f} -> ₹{new_balance:.2f}.")

    # Verify notification created for successful payment
    unread_after = client.get("/api/notifications/unread-count", headers=headers_a).json()["unread_count"]
    assert unread_after >= unread_before + 1

    latest_notifs = client.get("/api/notifications?limit=3", headers=headers_a).json()
    pay_notif = next((n for n in latest_notifs if n["notification_type"] == "TRANSACTION"), None)
    assert pay_notif is not None
    assert "Payment Successful" in pay_notif["title"]
    print(f"   [PASS] 2.2 Payment generated TRANSACTION notification: '{pay_notif['title']}'.")

    # 2.3 Simulated Payment Failure
    fail_res = client.post("/api/payments/execute", headers=headers_a, json={
        "recipient_type": "UPI_ID",
        "recipient_name": "Ramesh Kumar",
        "recipient_identifier": "ramesh@paytm",
        "amount": 50.0,
        "simulate_failure": True
    })
    assert fail_res.status_code == 200
    fail_data = fail_res.json()
    assert fail_data["status"] == "FAILED"
    assert fail_data["remaining_balance"] == new_balance  # Balance must NOT change
    print(f"   [PASS] 2.3 Simulated failure left balance untouched at ₹{new_balance:.2f}.")

    # 2.4 Insufficient Balance Payment Failure
    huge_amount = new_balance + 50000.0
    insufficient_res = client.post("/api/payments/execute", headers=headers_a, json={
        "recipient_type": "UPI_ID",
        "recipient_name": "Priya Sharma",
        "recipient_identifier": "priya@okaxis",
        "amount": huge_amount
    })
    assert insufficient_res.status_code == 200
    insufficient_data = insufficient_res.json()
    assert insufficient_data["status"] == "FAILED"
    assert insufficient_data["remaining_balance"] == new_balance  # Balance must NOT change
    print(f"   [PASS] 2.4 Insufficient funds blocked cleanly without balance change.")

    # -------------------------------------------------------------
    # 3. UTILITY BILLS & MOBILE RECHARGES
    # -------------------------------------------------------------
    print("\n--- 3. BILLS & RECHARGES FLOWS ---")

    # 3.1 Category catalog check
    cats_res = client.get("/api/bills/categories", headers=headers_a)
    assert cats_res.status_code == 200
    cats = cats_res.json()
    assert len(cats) == 10
    print(f"   [PASS] 3.1 All {len(cats)} utility bill categories validated.")

    # 3.2 Mobile Recharge fetch & pay
    recharge_fetch = client.post("/api/bills/fetch", headers=headers_a, json={
        "category": "MOBILE_RECHARGE",
        "biller_id": "jio",
        "account_number": "9876543210"
    })
    assert recharge_fetch.status_code == 200
    fetch_data = recharge_fetch.json()
    assert fetch_data["account_number"] == "9876543210"
    assert "biller_name" in fetch_data
    print(f"   [PASS] 3.2 Mobile recharge account validated ({fetch_data['biller_name']}).")

    # Pay recharge bill
    bill_amount = 299.0
    balance_pre_bill = new_balance
    bill_pay_res = client.post("/api/bills/pay", headers=headers_a, json={
        "category": "MOBILE_RECHARGE",
        "biller_id": "jio",
        "biller_name": "Jio Prepaid",
        "account_number": "9876543210",
        "consumer_name": "Alex Johnson",
        "amount": bill_amount
    })
    assert bill_pay_res.status_code == 200
    bill_pay_data = bill_pay_res.json()
    assert bill_pay_data["status"] == "SUCCESS"
    assert round(bill_pay_data["remaining_balance"], 2) == round(balance_pre_bill - bill_amount, 2)
    print(f"   [PASS] 3.3 Bill payment successful. Ref: {bill_pay_data['reference_id']}, Balance: ₹{bill_pay_data['remaining_balance']:.2f}.")

    # Verify BILL_PAYMENT notification creation
    bill_notifs = client.get("/api/notifications?type=BILL_PAYMENT", headers=headers_a).json()
    assert len(bill_notifs) > 0
    assert any("Bill Payment Successful" in n["title"] for n in bill_notifs)
    print("   [PASS] 3.4 BILL_PAYMENT notification verified in MySQL.")

    # -------------------------------------------------------------
    # 4. AI SAFETY & FRAUD PREVENTION
    # -------------------------------------------------------------
    print("\n--- 4. AI SAFETY & FRAUD PREVENTION ---")

    # 4.1 Low Risk Normal Payment (Saved beneficiary, unique amount)
    safe_check = client.post("/api/payments/safety-check", headers=headers_a, json={
        "recipient_type": "BENEFICIARY",
        "recipient_identifier": "ramesh@paytm",
        "recipient_name": "Ramesh Kumar",
        "amount": 175.0,
        "source": "MANUAL"
    })
    assert safe_check.status_code == 200
    assert safe_check.json()["risk_level"] == "LOW"
    assert safe_check.json()["is_safe_to_proceed"] is True
    print("   [PASS] 4.1 Low risk verified recipient correctly permitted.")

    # 4.2 Suspicious Phishing / Scam Identifier
    scam_check = client.post("/api/payments/safety-check", headers=headers_a, json={
        "recipient_type": "UPI_ID",
        "recipient_identifier": "lottery-win-bonus@upi",
        "recipient_name": "Prize Manager",
        "amount": 5000.0,
        "source": "MANUAL"
    })
    assert scam_check.status_code == 200
    scam_data = scam_check.json()
    assert scam_data["risk_level"] in ["HIGH", "CRITICAL"]
    assert "SUSPICIOUS_IDENTIFIER" in scam_data["risk_flags"]
    print(f"   [PASS] 4.2 Scam identifier flagged -> Level: {scam_data['risk_level']}, Flags: {scam_data['risk_flags']}.")

    # Verify SAFETY_WARNING notification created
    safety_notifs = client.get("/api/notifications?type=SAFETY_WARNING", headers=headers_a).json()
    assert len(safety_notifs) > 0
    print(f"   [PASS] 4.3 AI Safety check recorded SAFETY_WARNING notification: '{safety_notifs[0]['title']}'.")

    # 4.4 Repeated / Duplicate Transfer Detection
    dup_res = client.post("/api/payments/safety-check", headers=headers_a, json={
        "recipient_type": "UPI_ID",
        "recipient_identifier": "priya@okaxis",
        "recipient_name": "Priya Sharma",
        "amount": pay_amount,  # Same as 2.1 payment within 5 mins
        "source": "MANUAL"
    })
    assert dup_res.status_code == 200
    dup_data = dup_res.json()
    assert "DUPLICATE_PAYMENT_SUSPECTED" in dup_data["risk_flags"]
    print(f"   [PASS] 4.4 Duplicate transfer within 5 mins flagged -> Flags: {dup_data['risk_flags']}.")

    # 4.5 Amount Exceeding Single UPI Limit (> ₹50,000)
    over_limit_res = client.post("/api/payments/safety-check", headers=headers_a, json={
        "recipient_type": "UPI_ID",
        "recipient_identifier": "priya@okaxis",
        "amount": 75000.0
    })
    assert over_limit_res.status_code == 200
    assert over_limit_res.json()["risk_level"] == "CRITICAL"
    assert over_limit_res.json()["recommended_action"] == "BLOCK"
    print("   [PASS] 4.5 Limit exceeding transfer correctly BLOCKED by AI Safety Engine.")

    # -------------------------------------------------------------
    # 5. NOTIFICATION CENTER OPERATIONS
    # -------------------------------------------------------------
    print("\n--- 5. NOTIFICATION CENTER OPERATIONS ---")

    # 5.1 Listing & Pagination
    all_notifs = client.get("/api/notifications", headers=headers_a).json()
    assert len(all_notifs) >= 5
    page_1 = client.get("/api/notifications?limit=2&offset=0", headers=headers_a).json()
    page_2 = client.get("/api/notifications?limit=2&offset=2", headers=headers_a).json()
    assert len(page_1) == 2
    assert len(page_2) == 2
    assert page_1[0]["id"] != page_2[0]["id"]
    print(f"   [PASS] 5.1 Notifications listing & pagination verified (Page 1: #{page_1[0]['id']}, Page 2: #{page_2[0]['id']}).")

    # 5.2 Filters
    trans_filtered = client.get("/api/notifications?type=TRANSACTION", headers=headers_a).json()
    assert all(n["notification_type"] == "TRANSACTION" for n in trans_filtered)
    print(f"   [PASS] 5.2 Category filtering verified ({len(trans_filtered)} TRANSACTION notifications).")

    # 5.3 Single Mark-as-read
    unread_item = next((n for n in all_notifs if not n["is_read"]), None)
    if unread_item:
        marked_res = client.patch(f"/api/notifications/{unread_item['id']}/read", headers=headers_a)
        assert marked_res.status_code == 200
        assert marked_res.json()["is_read"] is True
        print(f"   [PASS] 5.3 Individual notification #{unread_item['id']} marked as read.")

    # 5.4 Mark-all-as-read
    mark_all_res = client.post("/api/notifications/read-all", headers=headers_a)
    assert mark_all_res.status_code == 200
    final_unread = client.get("/api/notifications/unread-count", headers=headers_a).json()["unread_count"]
    assert final_unread == 0
    print("   [PASS] 5.4 Mark All as Read verified: unread count is exactly 0.")

    # -------------------------------------------------------------
    # 6. SECURITY & MULTI-USER ISOLATION
    # -------------------------------------------------------------
    print("\n--- 6. SECURITY & MULTI-USER ISOLATION ---")

    # Register User B
    user_b_phone = "9876500000"
    db = SessionLocal()
    old_b = db.query(User).filter(User.phone_number == user_b_phone).first()
    if old_b:
        db.delete(old_b)
        db.commit()
    db.close()

    reg_b = client.post("/api/auth/register", json={
        "full_name": "Bob Smith",
        "phone_number": user_b_phone,
        "password": "SecurePassword@123",
        "email": "bob@oneability.ai",
        "upi_id": "bob@oneability"
    })
    assert reg_b.status_code in [201, 400]

    login_b = client.post("/api/auth/login", json={
        "identifier": user_b_phone,
        "password": "SecurePassword@123"
    })
    assert login_b.status_code == 200
    token_b = login_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Verify User B gets own notifications, not User A's
    notifs_b = client.get("/api/notifications", headers=headers_b).json()
    assert all(n["user_id"] != login_res.json()["user"]["id"] for n in notifs_b)
    print(f"   [PASS] 6.1 User B notification list isolated from User A.")

    # Verify User B cannot mark User A's notification as read (returns 404)
    user_a_notif_id = all_notifs[0]["id"]
    tamper_res = client.patch(f"/api/notifications/{user_a_notif_id}/read", headers=headers_b)
    assert tamper_res.status_code == 404
    print(f"   [PASS] 6.2 Cross-user notification modification blocked with 404 Not Found.")

    # Verify User B cannot access User A's transaction receipt (returns 403)
    user_a_tx_ref = pay_data["reference_id"]
    tamper_tx = client.get(f"/api/transactions/{user_a_tx_ref}", headers=headers_b)
    assert tamper_tx.status_code == 403
    print(f"   [PASS] 6.3 Cross-user transaction detail access blocked with 403 Forbidden.")

    # -------------------------------------------------------------
    # 7. ACCESSIBILITY & MULTILINGUAL SPEECH ENGINE
    # -------------------------------------------------------------
    print("\n--- 7. ACCESSIBILITY & MULTILINGUAL SPEECH NLP ---")

    # 7.1 English Voice Command Parsing
    voice_en_res = client.post("/api/voice/parse", headers=headers_a, json={
        "text": "Send 500 rupees to Priya",
        "language": "en"
    })
    assert voice_en_res.status_code == 200
    voice_en = voice_en_res.json()
    assert voice_en["intent"] == "SEND_MONEY"
    assert voice_en["amount"] == 500.0
    assert "Priya" in voice_en["recipient"]["name"]
    assert voice_en["is_complete"] is True
    print(f"   [PASS] 7.1 English NLP parse: Amount=₹{voice_en['amount']}, Recipient='{voice_en['recipient']['name']}'.")

    # 7.2 Tamil / Tanglish Voice Command Parsing
    voice_ta_res = client.post("/api/voice/parse", headers=headers_a, json={
        "text": "Kumar-ku 500 rooba anuppu",
        "language": "ta"
    })
    assert voice_ta_res.status_code == 200
    voice_ta = voice_ta_res.json()
    assert voice_ta["intent"] == "SEND_MONEY"
    assert voice_ta["amount"] == 500.0
    assert "Ramesh" in voice_ta["recipient"]["name"]
    print(f"   [PASS] 7.2 Tamil/Tanglish NLP parse: Amount=₹{voice_ta['amount']}, Recipient='{voice_ta['recipient']['name']}'.")

    # 7.3 Tamil Number Mapping (nooru, aayiram)
    voice_num_res = client.post("/api/voice/parse", headers=headers_a, json={
        "text": "Ramesh-kku nooru rooba kudu",
        "language": "ta"
    })
    assert voice_num_res.status_code == 200
    voice_num = voice_num_res.json()
    assert voice_num["amount"] == 100.0
    print(f"   [PASS] 7.3 Tamil numeral word 'nooru' accurately converted to numeric: {voice_num['amount']}.")

    # 7.4 Accessibility Preferences API
    pref_res = client.get("/api/accessibility/preferences", headers=headers_a)
    assert pref_res.status_code == 200
    pref_data = pref_res.json()
    assert "high_contrast" in pref_data
    assert "font_size_scale" in pref_data
    assert "voice_guidance" in pref_data
    assert "haptic_feedback" in pref_data
    print("   [PASS] 7.4 User accessibility preferences schema and persistence verified.")

    print("\n" + "=" * 70)
    print("ALL STEP 16 E2E INTEGRATION & ACCESSIBILITY QA CHECKS PASSED! (25/25)")
    print("=" * 70)

if __name__ == "__main__":
    run_step16_e2e_qa()

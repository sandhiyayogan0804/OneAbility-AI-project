import sys
import os

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def run_tests():
    print("==================================================")
    print("STEP 11: VOICE AI / NLP FOUNDATION TESTS")
    print("==================================================")

    # 1. Login to get JWT
    print("\n1. Logging in as Alex Johnson...")
    login_res = client.post("/api/auth/login", json={
        "identifier": "9876543210",
        "password": "SecurePassword@123"
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("   [PASS] Authenticated successfully.")

    # 2. Check initial balance & transactions count (to verify NLP never executes payments)
    dash_res = client.get("/api/dashboard/home", headers=headers)
    initial_balance = dash_res.json()["primary_account"]["balance"]
    tx_res = client.get("/api/transactions", headers=headers)
    tx_data = tx_res.json()
    initial_tx_count = len(tx_data) if isinstance(tx_data, list) else tx_data.get("total_count", 0)
    print(f"   Baseline Balance: ₹{initial_balance:.2f}, Transactions: {initial_tx_count}")

    # 3. Test English Commands
    print("\n2. Testing English Commands...")
    r = client.post("/api/voice/parse", headers=headers, json={
        "text": "Send 250 rs to Priya",
        "language": "en"
    })
    assert r.status_code == 200, f"Failed: {r.text}"
    data = r.json()
    assert data["intent"] == "SEND_MONEY", f"Expected SEND_MONEY, got {data['intent']}"
    assert data["amount"] == 250.0, f"Expected 250.0, got {data['amount']}"
    assert data["recipient"] is not None and "Priya" in data["recipient"]["name"], f"Expected Priya in recipient, got {data['recipient']}"
    assert data["is_complete"] is True, "Expected complete command"
    assert data["action_suggested"] == "PROCEED_TO_REVIEW"
    print(f"   [PASS] 'Send 250 rs to Priya' -> Amount: {data['amount']}, Recipient: {data['recipient']['name']}, Complete: {data['is_complete']}")

    # 4. Test Tamil / Tanglish Commands
    print("\n3. Testing Tamil / Tanglish Commands...")
    # "Kumar-ku 500 rooba anuppu"
    r2 = client.post("/api/voice/parse", headers=headers, json={
        "text": "Kumar-ku 500 rooba anuppu",
        "language": "ta"
    })
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["intent"] == "SEND_MONEY"
    assert d2["amount"] == 500.0, f"Expected 500, got {d2['amount']}"
    assert d2["recipient"] is not None and "Kumar" in d2["recipient"]["name"]
    assert d2["is_complete"] is True
    print(f"   [PASS] 'Kumar-ku 500 rooba anuppu' -> Amount: {d2['amount']}, Recipient: {d2['recipient']['name']}")

    # "Priya-ku ainooru rooba send pannu" (ainooru = 500)
    r3 = client.post("/api/voice/parse", headers=headers, json={
        "text": "Priya-ku ainooru rooba send pannu",
        "language": "mixed"
    })
    assert r3.status_code == 200
    d3 = r3.json()
    assert d3["amount"] == 500.0, f"Expected ainooru=500.0, got {d3['amount']}"
    assert "Priya" in d3["recipient"]["name"]
    assert d3["is_complete"] is True
    print(f"   [PASS] 'Priya-ku ainooru rooba send pannu' -> Amount: {d3['amount']} (from 'ainooru'), Recipient: {d3['recipient']['name']}")

    # 5. Test Tamil Number Words (nooru, aayiram)
    print("\n4. Testing Tamil Number Words...")
    # nooru = 100
    r_nooru = client.post("/api/voice/parse", headers=headers, json={
        "text": "Ramesh-kku nooru rooba kudu"
    })
    d_nooru = r_nooru.json()
    assert d_nooru["amount"] == 100.0, f"Expected nooru=100.0, got {d_nooru['amount']}"
    assert "Ramesh" in d_nooru["recipient"]["name"]
    print(f"   [PASS] 'nooru' -> {d_nooru['amount']}")

    # aayiram = 1000
    r_aayiram = client.post("/api/voice/parse", headers=headers, json={
        "text": "Priyavukku aayiram roobai anuppu"
    })
    d_aayiram = r_aayiram.json()
    assert d_aayiram["amount"] == 1000.0, f"Expected aayiram=1000.0, got {d_aayiram['amount']}"
    print(f"   [PASS] 'aayiram' -> {d_aayiram['amount']}")

    # 6. Test Missing Recipient
    print("\n5. Testing Missing Recipient...")
    r_missing_recip = client.post("/api/voice/parse", headers=headers, json={
        "text": "Send 500 rupees"
    })
    d_mr = r_missing_recip.json()
    assert d_mr["intent"] == "SEND_MONEY"
    assert d_mr["amount"] == 500.0
    assert d_mr["recipient"] is None
    assert d_mr["is_complete"] is False
    assert "recipient" in d_mr["missing_fields"]
    assert d_mr["action_suggested"] == "ASK_RECIPIENT"
    print(f"   [PASS] Missing Recipient -> missing_fields: {d_mr['missing_fields']}, action: {d_mr['action_suggested']}")

    # 7. Test Missing Amount
    print("\n6. Testing Missing Amount...")
    r_missing_amt = client.post("/api/voice/parse", headers=headers, json={
        "text": "Priya-ku send pannu"
    })
    d_ma = r_missing_amt.json()
    assert d_ma["intent"] == "SEND_MONEY"
    assert d_ma["amount"] is None
    assert d_ma["recipient"] is not None
    assert d_ma["is_complete"] is False
    assert "amount" in d_ma["missing_fields"]
    assert d_ma["action_suggested"] == "ASK_AMOUNT"
    print(f"   [PASS] Missing Amount -> missing_fields: {d_ma['missing_fields']}, action: {d_ma['action_suggested']}")

    # 8. Test Ambiguous / Unknown Command
    print("\n7. Testing Ambiguous / Unknown Commands...")
    r_unknown = client.post("/api/voice/parse", headers=headers, json={
        "text": "Hello how are you doing today"
    })
    d_un = r_unknown.json()
    assert d_un["intent"] == "UNKNOWN"
    assert d_un["is_complete"] is False
    assert d_un["action_suggested"] == "UNKNOWN"
    assert d_un["confidence"] <= 0.5
    print(f"   [PASS] Ambiguous input handled gracefully -> Intent: {d_un['intent']}, Action: {d_un['action_suggested']}")

    # 9. Test Authentication (401 without JWT)
    print("\n8. Testing Authentication Enforcement...")
    r_unauth = client.post("/api/voice/parse", json={
        "text": "Send 500 to Priya"
    })
    assert r_unauth.status_code == 401, f"Expected 401 Unauthorized, got {r_unauth.status_code}"
    print("   [PASS] Protected endpoint returned 401 for unauthenticated request.")

    # 10. CRITICAL SAFETY TEST: Verify that parsing NEVER executed a payment
    print("\n9. Verifying Safety Boundary (No payment auto-execution)...")
    dash_after = client.get("/api/dashboard/home", headers=headers)
    after_balance = dash_after.json()["primary_account"]["balance"]
    tx_after = client.get("/api/transactions", headers=headers)
    tx_after_data = tx_after.json()
    after_tx_count = len(tx_after_data) if isinstance(tx_after_data, list) else tx_after_data.get("total_count", 0)

    assert after_balance == initial_balance, f"Balance changed from {initial_balance} to {after_balance}! Voice parsing must NOT alter balance!"
    assert after_tx_count == initial_tx_count, f"Transaction count changed from {initial_tx_count} to {after_tx_count}! Voice parsing must NOT create transactions!"
    print(f"   [PASS] Safety verified: Balance remained ₹{after_balance:.2f}, Transaction count remained {after_tx_count}.")

    print("\n==================================================")
    print("ALL VOICE NLP TESTS PASSED SUCCESSFULLY! (10/10)")
    print("==================================================")

if __name__ == "__main__":
    run_tests()

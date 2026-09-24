import sys
import os

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_full_step11_flow():
    print("==================================================")
    print("STEP 11: FULL VOICE -> REVIEW -> CONFIRMATION FLOW")
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
    print("   [PASS] User logged in.")

    # 2. Get initial balance
    dash_res = client.get("/api/dashboard/home", headers=headers)
    initial_balance = dash_res.json()["primary_account"]["balance"]
    print(f"   Initial balance: ₹{initial_balance:.2f}")

    # 3. Simulate Voice Input: "Kumar-ku 500 rooba anuppu"
    print("\n2. Processing Voice Command: 'Kumar-ku 500 rooba anuppu' (Tamil/Tanglish)...")
    voice_res = client.post("/api/voice/parse", headers=headers, json={
        "text": "Kumar-ku 500 rooba anuppu",
        "language": "mixed"
    })
    assert voice_res.status_code == 200
    nlp = voice_res.json()
    assert nlp["intent"] == "SEND_MONEY"
    assert nlp["amount"] == 500.0
    assert nlp["recipient"]["name"] == "Ramesh Kumar"
    assert nlp["recipient"]["is_saved_contact"] is True
    assert nlp["is_complete"] is True
    assert nlp["action_suggested"] == "PROCEED_TO_REVIEW"
    print(f"   [PASS] NLP correctly parsed -> Amount: ₹{nlp['amount']}, Recipient: {nlp['recipient']['name']}")
    print(f"   Spoken Response: \"{nlp['spoken_response']}\"")

    # 4. SAFETY VERIFICATION: Balance MUST NOT change after voice parse
    dash_after_parse = client.get("/api/dashboard/home", headers=headers)
    assert dash_after_parse.json()["primary_account"]["balance"] == initial_balance
    print("   [PASS] Safety check passed: Balance unchanged after voice command parse.")

    # 5. User explicitly reviews details on screen and confirms payment
    print("\n3. Explicit User Confirmation on Review Screen...")
    pay_res = client.post("/api/payments/execute", headers=headers, json={
        "recipient_type": "CONTACT",
        "recipient_identifier": nlp["recipient"]["identifier"],
        "recipient_name": nlp["recipient"]["name"],
        "amount": nlp["amount"],
        "description": f"Voice payment via OneAbility AI: \"{nlp['raw_transcript']}\"",
        "simulate_failure": False
    })
    assert pay_res.status_code == 200
    payment_result = pay_res.json()
    assert payment_result["status"] == "SUCCESS"
    assert payment_result["amount"] == 500.0
    print(f"   [PASS] Payment successfully executed after explicit confirmation! Ref: {payment_result['reference_id']}")
    assert len(payment_result["reference_id"]) > 5
    print(f"   Remaining balance: ₹{payment_result['remaining_balance']:.2f}")

    # 6. Verify balance decreased by 500
    expected_balance = initial_balance - 500.0
    assert payment_result["remaining_balance"] == expected_balance
    dash_after_pay = client.get("/api/dashboard/home", headers=headers)
    assert dash_after_pay.json()["primary_account"]["balance"] == expected_balance
    print(f"   [PASS] Account balance accurately updated to ₹{expected_balance:.2f}.")

    # 7. Verify transaction record exists in history
    print("\n4. Verifying Transaction History...")
    tx_detail_res = client.get(f"/api/transactions/{payment_result['reference_id']}", headers=headers)
    assert tx_detail_res.status_code == 200
    tx_data = tx_detail_res.json()
    assert tx_data["amount"] == 500.0
    assert tx_data["receiver_name"] == "Ramesh Kumar"
    assert "Voice payment via OneAbility AI" in tx_data["description"]
    print(f"   [PASS] Transaction record verified in MySQL history with voice remark.")

    print("\n==================================================")
    print("STEP 11 END-TO-END FLOW VERIFICATION COMPLETE!")
    print("==================================================")

if __name__ == "__main__":
    test_full_step11_flow()

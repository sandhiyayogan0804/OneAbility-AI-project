import sys
import os

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from main import app
from config.database import SessionLocal
from models.user import User
from models.transaction import Transaction

client = TestClient(app)

def run_transaction_tests():
    print("========================================")
    print("OneAbility AI - Step 9 Transaction Management Verification")
    print("========================================\n")

    # 1. Login primary user
    print("1. Authenticating primary user...")
    login_res = client.post("/api/auth/login", json={
        "identifier": "9876543210",
        "password": "SecurePassword@123"
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("   [PASS] Primary user authenticated.\n")

    # 2. Complete Transaction History
    print("2. Testing Complete Transaction History (GET /api/transactions)...")
    history_res = client.get("/api/transactions", headers=headers)
    assert history_res.status_code == 200
    all_txs = history_res.json()
    print(f"   Retrieved {len(all_txs)} total transactions.")
    assert len(all_txs) > 0
    sample_tx = all_txs[0]
    sample_ref = sample_tx["reference_id"]
    print(f"   Sample Ref: {sample_ref}, Status: {sample_tx['status']}, Amount: {sample_tx['amount']}")
    print("   [PASS] Complete history returned.\n")

    # 3. Search Transactions
    print("3. Testing Search Filter (search=TXN_UPI)...")
    search_res = client.get("/api/transactions?search=TXN_UPI", headers=headers)
    assert search_res.status_code == 200
    search_data = search_res.json()
    print(f"   Found {len(search_data)} matching transactions for 'TXN_UPI'.")
    assert all("TXN_UPI" in tx["reference_id"] for tx in search_data)
    print("   [PASS] Search by reference ID succeeded.\n")

    # 4. Filter by Status: SUCCESS vs FAILED
    print("4. Testing Filter by Status (SUCCESS vs FAILED)...")
    success_res = client.get("/api/transactions?status=SUCCESS", headers=headers)
    assert success_res.status_code == 200
    success_txs = success_res.json()
    print(f"   SUCCESS transactions: {len(success_txs)}")
    assert all(tx["status"] == "SUCCESS" for tx in success_txs)

    failed_res = client.get("/api/transactions?status=FAILED", headers=headers)
    assert failed_res.status_code == 200
    failed_txs = failed_res.json()
    print(f"   FAILED transactions: {len(failed_txs)}")
    assert all(tx["status"] == "FAILED" for tx in failed_txs)
    print("   [PASS] Status filtering works correctly.\n")

    # 5. Filter by Type: SENT vs RECEIVED
    print("5. Testing Filter by Type (type=SENT vs type=RECEIVED)...")
    sent_res = client.get("/api/transactions?type=SENT", headers=headers)
    assert sent_res.status_code == 200
    sent_txs = sent_res.json()
    print(f"   SENT (Debit) transactions: {len(sent_txs)}")
    assert all(tx["transaction_type"] == "DEBIT" for tx in sent_txs)

    received_res = client.get("/api/transactions?type=RECEIVED", headers=headers)
    assert received_res.status_code == 200
    received_txs = received_res.json()
    print(f"   RECEIVED (Credit) transactions: {len(received_txs)}")
    assert all(tx["transaction_type"] == "CREDIT" for tx in received_txs)
    print("   [PASS] Type filtering works correctly.\n")

    # 6. Filter by Date Range
    print("6. Testing Filter by Date Range...")
    today_str = sample_tx["created_at"][:10]  # YYYY-MM-DD
    date_res = client.get(f"/api/transactions?start_date={today_str}&end_date={today_str}", headers=headers)
    assert date_res.status_code == 200
    date_txs = date_res.json()
    print(f"   Transactions created today ({today_str}): {len(date_txs)}")
    assert len(date_txs) > 0
    print("   [PASS] Date range filtering verified.\n")

    # 7. Transaction Detail & Receipt
    print(f"7. Testing Transaction Detail API (GET /api/transactions/{sample_ref})...")
    detail_res = client.get(f"/api/transactions/{sample_ref}", headers=headers)
    assert detail_res.status_code == 200, f"Detail lookup failed: {detail_res.text}"
    detail = detail_res.json()
    print(f"   Receipt Reference: {detail['reference_id']}")
    print(f"   Party Name: {detail['party_name']}")
    print(f"   Sender Name: {detail['sender_name']}")
    print(f"   Sender Bank: {detail['sender_bank_name']} ({detail['sender_account_masked']})")
    print(f"   Receiver Name: {detail['receiver_name']}")
    print(f"   Amount: {detail['amount']}, Status: {detail['status']}")
    assert detail["reference_id"] == sample_ref
    assert detail["amount"] > 0
    print("   [PASS] Full transaction receipt returned accurately.\n")

    # 8. Non-Existent Transaction (404)
    print("8. Testing Non-Existent Transaction Lookup (404)...")
    not_found_res = client.get("/api/transactions/TXN_DOES_NOT_EXIST_999", headers=headers)
    assert not_found_res.status_code == 404
    print("   [PASS] 404 returned for unknown transaction.\n")

    # 9. Authorization Verification: Another User Cannot Access First User's Transaction (403)
    print("9. Testing Transaction Authorization (Prevent unauthorized access)...")
    # Register/login second user
    second_phone = "9111222333"
    try:
        client.post("/api/auth/register", json={
            "full_name": "Second User",
            "phone_number": second_phone,
            "password": "Password@123",
            "email": "second@oneability.ai"
        })
    except Exception:
        pass
    
    sec_login = client.post("/api/auth/login", json={
        "identifier": second_phone,
        "password": "Password@123"
    })
    assert sec_login.status_code == 200
    sec_token = sec_login.json()["access_token"]
    sec_headers = {"Authorization": f"Bearer {sec_token}"}

    # Attempt to view primary user's transaction using second user's credentials
    unauth_res = client.get(f"/api/transactions/{sample_ref}", headers=sec_headers)
    print(f"   Second User Access Status Code: {unauth_res.status_code}")
    assert unauth_res.status_code == 403, f"Expected 403 Forbidden, got {unauth_res.status_code}"
    print("   [PASS] 403 Forbidden correctly returned for unauthorized user.\n")

    print("========================================")
    print("ALL 9 TRANSACTION MANAGEMENT TESTS PASSED SUCCESSFULLY!")
    print("========================================")

if __name__ == "__main__":
    run_transaction_tests()

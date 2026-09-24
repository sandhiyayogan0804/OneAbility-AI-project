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
from models.bank_account import BankAccount
from models.transaction import Transaction

client = TestClient(app)

def run_payment_tests():
    print("========================================")
    print("OneAbility AI - Step 8 Payment Verification")
    print("========================================\n")

    # 1. Login to get authenticated token
    print("1. Authenticating user...")
    login_res = client.post("/api/auth/login", json={
        "identifier": "9876543210",
        "password": "SecurePassword@123"
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("   [PASS] Authenticated successfully.\n")

    # Ensure demo bank accounts and starter data exist
    client.get("/api/dashboard/home", headers=headers)

    # 2. Test Get Beneficiaries
    print("2. Testing Beneficiaries API (GET /api/payments/beneficiaries)...")
    bens_res = client.get("/api/payments/beneficiaries", headers=headers)
    assert bens_res.status_code == 200, f"Get beneficiaries failed: {bens_res.text}"
    bens = bens_res.json()
    print(f"   Retrieved {len(bens)} beneficiaries:")
    for b in bens:
        print(f"    - {b['name']} ({b['upi_id'] or b['phone_number']}) [Fav: {b['is_favorite']}]")
    assert len(bens) >= 1
    print("   [PASS] Beneficiaries retrieved and seeded.\n")

    # 3. Test Verify Recipient
    print("3. Testing Recipient Verification (POST /api/payments/verify-recipient)...")
    ver_res = client.post("/api/payments/verify-recipient", json={
        "identifier": "priya@okaxis",
        "recipient_type": "UPI_ID"
    }, headers=headers)
    assert ver_res.status_code == 200
    v_data = ver_res.json()
    print(f"   Resolved: {v_data['name']} (Verified: {v_data['is_verified']}, Bank: {v_data['bank_handle']})")
    assert v_data["is_verified"] is True
    print("   [PASS] Recipient verification succeeded.\n")

    # 4. Check initial bank balance
    db = SessionLocal()
    user = db.query(User).filter(User.phone_number == "9876543210").first()
    account = db.query(BankAccount).filter(BankAccount.user_id == user.id, BankAccount.is_primary == True).first()
    initial_balance = float(account.balance)
    db.close()
    print(f"4. Initial Account Balance: {initial_balance}\n")

    # 5. Test Successful Payment Execution
    print("5. Testing Successful Payment Execution (POST /api/payments/execute)...")
    pay_payload = {
        "recipient_type": "UPI_ID",
        "recipient_name": "Priya Sharma",
        "recipient_identifier": "priya@okaxis",
        "amount": 500.00,
        "description": "Lunch split",
        "simulate_failure": False
    }
    pay_res = client.post("/api/payments/execute", json=pay_payload, headers=headers)
    assert pay_res.status_code == 200, f"Payment failed: {pay_res.text}"
    pay_data = pay_res.json()
    print(f"   Status: {pay_data['status']}")
    print(f"   Reference ID: {pay_data['reference_id']}")
    print(f"   Amount: {pay_data['amount']}")
    print(f"   Remaining Balance: {pay_data['remaining_balance']}")
    assert pay_data["status"] == "SUCCESS"
    assert round(pay_data["remaining_balance"], 2) == round(initial_balance - 500.00, 2)
    assert pay_data["reference_id"].startswith("TXN_UPI_")
    print("   [PASS] Payment executed, unique reference generated, and balance deducted.\n")

    # 6. Test Payment Failure Simulation
    print("6. Testing Explicit Failure Simulation (simulate_failure=True)...")
    fail_payload = {
        "recipient_type": "UPI_ID",
        "recipient_name": "Ramesh Kumar",
        "recipient_identifier": "ramesh@paytm",
        "amount": 100.00,
        "description": "Simulated decline test",
        "simulate_failure": True
    }
    fail_res = client.post("/api/payments/execute", json=fail_payload, headers=headers)
    assert fail_res.status_code == 200
    fail_data = fail_res.json()
    print(f"   Status: {fail_data['status']}")
    print(f"   Message: {fail_data['message']}")
    assert fail_data["status"] == "FAILED"
    print("   [PASS] Failure simulation handled gracefully.\n")

    # 7. Test Insufficient Funds Handling
    print("7. Testing Insufficient Balance Handling...")
    exceed_payload = {
        "recipient_type": "UPI_ID",
        "recipient_name": "Mega Corp",
        "recipient_identifier": "megacorp@icici",
        "amount": 99999999.00,
        "description": "Too large amount",
        "simulate_failure": False
    }
    exceed_res = client.post("/api/payments/execute", json=exceed_payload, headers=headers)
    assert exceed_res.status_code == 200
    exceed_data = exceed_res.json()
    print(f"   Status: {exceed_data['status']}")
    print(f"   Message: {exceed_data['message']}")
    assert exceed_data["status"] == "FAILED"
    print("   [PASS] Insufficient balance correctly flagged as failed.\n")

    # 8. Test Transaction History
    print("8. Testing Transaction History (GET /api/payments/transactions)...")
    tx_res = client.get("/api/payments/transactions", headers=headers)
    assert tx_res.status_code == 200
    txs = tx_res.json()
    print(f"   Total transactions recorded: {len(txs)}")
    assert len(txs) >= 3
    latest_tx = txs[0]
    print(f"   Latest Transaction: Ref {latest_tx['reference_id']}, Status {latest_tx['status']}, Amount {latest_tx['amount']}")
    print("   [PASS] Transaction history updated in real-time.\n")

    print("========================================")
    print("ALL PAYMENT BACKEND TESTS PASSED SUCCESSFULLY!")
    print("========================================")

if __name__ == "__main__":
    run_payment_tests()

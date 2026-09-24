import sys
import os

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def run_qr_tests():
    print("========================================")
    print("OneAbility AI - Step 10 QR / Scan & Pay Verification")
    print("========================================\n")

    # 1. Login user
    print("1. Authenticating test user...")
    login_res = client.post("/api/auth/login", json={
        "identifier": "9876543210",
        "password": "SecurePassword@123"
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("   [PASS] User authenticated.\n")

    # 2. Test Valid UPI QR with Amount
    print("2. Testing Valid UPI QR with Amount...")
    qr_with_amt = "upi://pay?pa=freshmart@okaxis&pn=Fresh%20Mart&am=350.00&cu=INR&tn=Groceries"
    res1 = client.post("/api/qr/parse", json={"qr_data": qr_with_amt}, headers=headers)
    assert res1.status_code == 200
    data1 = res1.json()
    print(f"   is_valid_upi: {data1['is_valid_upi']}")
    print(f"   Recipient: {data1['recipient_name']} ({data1['upi_id']})")
    print(f"   Amount: {data1['amount']}, Note: {data1['transaction_note']}")
    assert data1["is_valid_upi"] is True
    assert data1["upi_id"] == "freshmart@okaxis"
    assert data1["recipient_name"] == "Fresh Mart"
    assert data1["amount"] == 350.0
    print("   [PASS] Valid UPI QR with amount parsed successfully.\n")

    # 3. Test Valid UPI QR without Amount
    print("3. Testing Valid UPI QR without Amount (Static Merchant/Personal QR)...")
    qr_no_amt = "upi://pay?pa=priya@okaxis&pn=Priya%20Sharma"
    res2 = client.post("/api/qr/parse", json={"qr_data": qr_no_amt}, headers=headers)
    assert res2.status_code == 200
    data2 = res2.json()
    print(f"   is_valid_upi: {data2['is_valid_upi']}")
    print(f"   Recipient: {data2['recipient_name']} ({data2['upi_id']})")
    print(f"   Amount: {data2['amount']} (Expected None for manual entry)")
    assert data2["is_valid_upi"] is True
    assert data2["amount"] is None
    assert data2["upi_id"] == "priya@okaxis"
    print("   [PASS] Valid UPI QR without amount parsed, allowing user amount entry.\n")

    # 4. Test Direct VPA Handle String
    print("4. Testing Direct VPA Handle QR (bookstore@okhdfcbank)...")
    res3 = client.post("/api/qr/parse", json={"qr_data": "bookstore@okhdfcbank"}, headers=headers)
    assert res3.status_code == 200
    data3 = res3.json()
    assert data3["is_valid_upi"] is True
    assert data3["upi_id"] == "bookstore@okhdfcbank"
    print(f"   Resolved: {data3['recipient_name']} ({data3['upi_id']})")
    print("   [PASS] Direct VPA handle string parsed.\n")

    # 5. Test Invalid QR (Missing pa address)
    print("5. Testing Invalid UPI QR (Missing 'pa' parameter)...")
    res4 = client.post("/api/qr/parse", json={"qr_data": "upi://pay?pn=Unknown&am=100"}, headers=headers)
    assert res4.status_code == 200
    data4 = res4.json()
    print(f"   is_valid_upi: {data4['is_valid_upi']}, Error: {data4['error_message']}")
    assert data4["is_valid_upi"] is False
    assert "missing" in data4["error_message"].lower()
    print("   [PASS] Invalid UPI QR correctly flagged.\n")

    # 6. Test Unsupported QR (Generic Website URL)
    print("6. Testing Unsupported QR (Website Link: https://oneability.ai)...")
    res5 = client.post("/api/qr/parse", json={"qr_data": "https://oneability.ai"}, headers=headers)
    assert res5.status_code == 200
    data5 = res5.json()
    print(f"   is_valid_upi: {data5['is_valid_upi']}, Error: {data5['error_message']}")
    assert data5["is_valid_upi"] is False
    assert "website link" in data5["error_message"].lower()
    print("   [PASS] Unsupported website URL rejected with clear message.\n")

    # 7. Test Unsupported QR (WiFi Configuration)
    print("7. Testing Unsupported QR (WiFi Config: WIFI:S:Office;P:pass;;)...")
    res6 = client.post("/api/qr/parse", json={"qr_data": "WIFI:S:Office;P:pass;;"}, headers=headers)
    assert res6.status_code == 200
    data6 = res6.json()
    assert data6["is_valid_upi"] is False
    print(f"   Error: {data6['error_message']}")
    print("   [PASS] Unsupported WiFi QR rejected with clear message.\n")

    # 8. Test Authentication Requirement (401 without token)
    print("8. Testing Authentication Protection...")
    unauth_res = client.post("/api/qr/parse", json={"qr_data": qr_with_amt})
    assert unauth_res.status_code == 401
    print("   [PASS] Unauthenticated request rejected with 401.\n")

    # 9. Test Complete Simulated QR Payment Execution through Existing Payment Flow
    print("9. Testing Payment Execution from Scanned QR Data...")
    exec_res = client.post("/api/payments/execute", json={
        "recipient_type": "UPI_ID",
        "recipient_name": data1["recipient_name"],
        "recipient_identifier": data1["upi_id"],
        "amount": data1["amount"],
        "description": f"QR Payment: {data1['transaction_note']}",
        "simulate_failure": False
    }, headers=headers)
    assert exec_res.status_code == 200
    exec_data = exec_res.json()
    print(f"   Payment Status: {exec_data['status']}")
    print(f"   Reference ID: {exec_data['reference_id']}")
    print(f"   Amount Paid: {exec_data['amount']}")
    print(f"   Remaining Balance: {exec_data['remaining_balance']}")
    assert exec_data["status"] == "SUCCESS"
    assert exec_data["reference_id"].startswith("TXN_UPI_")
    print("   [PASS] Full simulated QR payment executed and recorded in database.\n")

    print("========================================")
    print("ALL 9 QR SCAN & PAY TESTS PASSED SUCCESSFULLY!")
    print("========================================")

if __name__ == "__main__":
    run_qr_tests()

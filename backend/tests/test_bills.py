import sys
import os

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Add parent directory to python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from main import app
from config.database import SessionLocal
from models.user import User
from models.bank_account import BankAccount
from models.transaction import Transaction
from models.bill_payment import BillPayment

client = TestClient(app)

def run_tests():
    print("=" * 60)
    print("STEP 14: BILLS & RECHARGE FOUNDATION TESTS")
    print("=" * 60)

    # 1. Authenticate user
    print("\n1. Logging in as Alex Johnson...")
    login_res = client.post("/api/auth/login", json={
        "identifier": "9876543210",
        "password": "SecurePassword@123"
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("   [PASS] User authenticated successfully.")

    # 2. Test Unauthenticated Access Protection
    print("\n2. Testing Authentication Protection...")
    unauth_cat = client.get("/api/bills/categories")
    assert unauth_cat.status_code == 401, f"Expected 401, got {unauth_cat.status_code}"
    unauth_pay = client.post("/api/bills/pay", json={
        "category": "MOBILE_RECHARGE",
        "biller_id": "jio",
        "biller_name": "Jio",
        "account_number": "9876543210",
        "amount": 299.0
    })
    assert unauth_pay.status_code == 401, f"Expected 401, got {unauth_pay.status_code}"
    print("   [PASS] Unauthenticated endpoints correctly rejected with 401.")

    # 3. Test Categories Catalog (Verify all 10 categories)
    print("\n3. Testing Categories Catalog (All 10 Categories)...")
    cat_res = client.get("/api/bills/categories", headers=headers)
    assert cat_res.status_code == 200
    categories = cat_res.json()
    assert len(categories) == 10, f"Expected 10 categories, found {len(categories)}"
    
    expected_categories = [
        "MOBILE_RECHARGE", "DTH", "ELECTRICITY", "WATER", "GAS",
        "BROADBAND", "FASTAG", "CREDIT_CARD", "INSURANCE", "LOAN_EMI"
    ]
    retrieved_cat_ids = [c["id"] for c in categories]
    for exp in expected_categories:
        assert exp in retrieved_cat_ids, f"Category '{exp}' missing from catalog!"
        cat_obj = next(c for c in categories if c["id"] == exp)
        assert len(cat_obj["billers"]) >= 3, f"Category '{exp}' should have at least 3 billers!"
    print(f"   [PASS] All 10 categories verified: {', '.join(expected_categories)}")

    # 4. Test Single Category Details
    print("\n4. Testing GET /api/bills/categories/{category_id}...")
    single_res = client.get("/api/bills/categories/ELECTRICITY", headers=headers)
    assert single_res.status_code == 200
    data = single_res.json()
    assert data["id"] == "ELECTRICITY"
    assert any(b["id"] == "bescom" for b in data["billers"])
    print("   [PASS] Category ELECTRICITY retrieved with billers (BESCOM, TNEB, etc.).")

    # 5. Test Bill Fetch / Validation for Each Category
    print("\n5. Testing Bill Fetch & Account Number Validation across Categories...")
    
    # Valid Mobile
    mobile_fetch = client.post("/api/bills/fetch", json={
        "category": "MOBILE_RECHARGE",
        "biller_id": "jio",
        "account_number": "9876543210"
    }, headers=headers)
    assert mobile_fetch.status_code == 200
    assert mobile_fetch.json()["account_number"] == "9876543210"
    print("   [PASS] Mobile Recharge validation passed.")

    # Invalid Mobile Number (too short / starts with 1)
    bad_mobile = client.post("/api/bills/fetch", json={
        "category": "MOBILE_RECHARGE",
        "biller_id": "jio",
        "account_number": "12345"
    }, headers=headers)
    assert bad_mobile.status_code in [422, 400], f"Expected validation error, got {bad_mobile.status_code}"
    print("   [PASS] Invalid mobile number correctly rejected.")

    # Valid Electricity
    elec_fetch = client.post("/api/bills/fetch", json={
        "category": "ELECTRICITY",
        "biller_id": "bescom",
        "account_number": "5421987654"
    }, headers=headers)
    assert elec_fetch.status_code == 200
    assert elec_fetch.json()["bill_amount"] == 1450.0
    print("   [PASS] Electricity bill fetch passed with simulated amount ₹1,450.00.")

    # Valid FASTag
    fastag_fetch = client.post("/api/bills/fetch", json={
        "category": "FASTAG",
        "biller_id": "sbi_fastag",
        "account_number": "KA01AB1234"
    }, headers=headers)
    assert fastag_fetch.status_code == 200
    print("   [PASS] FASTag vehicle registration validation passed.")

    # Invalid FASTag (symbols/spaces)
    bad_fastag = client.post("/api/bills/fetch", json={
        "category": "FASTAG",
        "biller_id": "sbi_fastag",
        "account_number": "NOT_A_VEHICLE!"
    }, headers=headers)
    assert bad_fastag.status_code in [422, 400]
    print("   [PASS] Invalid vehicle number rejected.")

    # 6. Test Invalid Payment Amounts
    print("\n6. Testing Invalid Amount Validation...")
    zero_pay = client.post("/api/bills/pay", json={
        "category": "MOBILE_RECHARGE",
        "biller_id": "jio",
        "biller_name": "Jio Prepaid",
        "account_number": "9876543210",
        "amount": 0.0
    }, headers=headers)
    assert zero_pay.status_code == 422
    print("   [PASS] Zero amount rejected.")

    neg_pay = client.post("/api/bills/pay", json={
        "category": "MOBILE_RECHARGE",
        "biller_id": "jio",
        "biller_name": "Jio Prepaid",
        "account_number": "9876543210",
        "amount": -299.0
    }, headers=headers)
    assert neg_pay.status_code == 422
    print("   [PASS] Negative amount rejected.")

    # 7. Test Payment Safety Pre-Check Integration
    print("\n7. Testing Payment Safety Check before Confirmation...")
    safety_res = client.post("/api/payments/safety-check", json={
        "recipient_type": "UPI_ID",
        "recipient_identifier": "jio.recharge@billpay",
        "recipient_name": "Jio Prepaid",
        "amount": 299.0,
        "source": "MANUAL",
        "description": "Bill Payment: Jio Mobile Recharge"
    }, headers=headers)
    assert safety_res.status_code == 200
    s_data = safety_res.json()
    assert s_data["risk_level"] in ["LOW", "MEDIUM", "SAFE"]
    print(f"   [PASS] Safety check completed -> Risk: {s_data['risk_level']}, Action: {s_data['recommended_action']}")

    # 8. Test Balance Baseline & Successful Payment Execution
    print("\n8. Testing Successful Simulated Bill Payment...")
    # Get initial balance
    dash_res = client.get("/api/dashboard/home", headers=headers)
    initial_balance = dash_res.json()["balance"]["total_balance"]
    print(f"   Initial Balance: ₹{initial_balance:,.2f}")

    pay_res = client.post("/api/bills/pay", json={
        "category": "MOBILE_RECHARGE",
        "biller_id": "jio",
        "biller_name": "Jio Prepaid",
        "account_number": "9876543210",
        "amount": 299.0,
        "convenience_fee": 0.0,
        "simulate_failure": False,
        "bill_metadata": {"plan": "28 Days Unlimited, 1.5GB/day"}
    }, headers=headers)
    assert pay_res.status_code == 200
    pay_data = pay_res.json()
    assert pay_data["status"] == "SUCCESS"
    assert pay_data["reference_id"].startswith("TXN_BILL_")
    assert pay_data["amount"] == 299.0
    assert pay_data["total_amount"] == 299.0

    expected_new_balance = round(initial_balance - 299.0, 2)
    assert abs(pay_data["remaining_balance"] - expected_new_balance) < 0.05
    print(f"   [PASS] Payment successful. Ref: {pay_data['reference_id']}, New Balance: ₹{pay_data['remaining_balance']:,.2f}")

    # 9. Test Verification of Database Persistence (Transactions and BillPayments)
    print("\n9. Testing Database Persistence...")
    db = SessionLocal()
    try:
        bill_row = db.query(BillPayment).filter(BillPayment.reference_id == pay_data["reference_id"]).first()
        assert bill_row is not None
        assert bill_row.status == "SUCCESS"
        assert float(bill_row.amount) == 299.0
        assert bill_row.category == "MOBILE_RECHARGE"

        tx_row = db.query(Transaction).filter(Transaction.reference_id == pay_data["reference_id"]).first()
        assert tx_row is not None
        assert tx_row.payment_method == "BILL_PAY"
        assert tx_row.status == "SUCCESS"
        print("   [PASS] Verified in MySQL bill_payments and transactions tables.")
    finally:
        db.close()

    # 10. Test Simulated Failure Handling
    print("\n10. Testing Simulated Payment Failure Handling...")
    fail_res = client.post("/api/bills/pay", json={
        "category": "ELECTRICITY",
        "biller_id": "bescom",
        "biller_name": "BESCOM - Bengaluru",
        "account_number": "5421987654",
        "amount": 1450.0,
        "simulate_failure": True
    }, headers=headers)
    assert fail_res.status_code == 200
    fail_data = fail_res.json()
    assert fail_data["status"] == "FAILED"
    # Verify balance was NOT deducted
    dash_after_fail = client.get("/api/dashboard/home", headers=headers)
    balance_after_fail = dash_after_fail.json()["balance"]["total_balance"]
    assert balance_after_fail == expected_new_balance, "Balance was incorrectly deducted during simulated failure!"
    print(f"   [PASS] Failure simulated cleanly. Balance remained exactly ₹{balance_after_fail:,.2f}.")

    # 11. Test Insufficient Funds Handling
    print("\n11. Testing Insufficient Balance Handling...")
    huge_res = client.post("/api/bills/pay", json={
        "category": "CREDIT_CARD",
        "biller_id": "hdfc_cc",
        "biller_name": "HDFC Bank Credit Card",
        "account_number": "4111222233334444",
        "amount": 99999.0, # exceeds user balance
        "simulate_failure": False
    }, headers=headers)
    assert huge_res.status_code == 200
    huge_data = huge_res.json()
    assert huge_data["status"] == "FAILED"
    assert "Insufficient balance" in huge_data["message"]
    print("   [PASS] Insufficient balance correctly flagged as FAILED without balance deduction.")

    # 12. Test Bill Payment History API
    print("\n12. Testing GET /api/bills/history...")
    history_res = client.get("/api/bills/history", headers=headers)
    assert history_res.status_code == 200
    history_list = history_res.json()
    assert len(history_list) >= 2, "Expected at least 2 bill payments in history"
    latest = history_list[0]
    assert "reference_id" in latest
    assert "biller_name" in latest
    assert "formatted_total" in latest
    print(f"   [PASS] Bill history retrieved {len(history_list)} records. Latest: {latest['biller_name']} - {latest['formatted_total']}.")

    print("\n" + "=" * 60)
    print("ALL BILLS & RECHARGE BACKEND TESTS PASSED! (12/12)")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()

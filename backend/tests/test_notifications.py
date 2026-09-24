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
from models.notification import Notification

client = TestClient(app)

def run_notification_tests():
    print("=" * 60)
    print("STEP 15: IN-APP NOTIFICATIONS SYSTEM TESTS")
    print("=" * 60)

    # 1. Authenticate Primary User
    print("\n1. Logging in as Alex Johnson...")
    login_res = client.post("/api/auth/login", json={
        "identifier": "9876543210",
        "password": "SecurePassword@123"
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("   [PASS] Primary user authenticated successfully.")

    # 2. Test Unauthenticated Access Protection (401)
    print("\n2. Testing Authentication Protection on all Notification endpoints...")
    res_list = client.get("/api/notifications")
    assert res_list.status_code == 401, f"Expected 401 for GET /api/notifications, got {res_list.status_code}"

    res_count = client.get("/api/notifications/unread-count")
    assert res_count.status_code == 401, f"Expected 401 for GET unread-count, got {res_count.status_code}"

    res_patch = client.patch("/api/notifications/1/read")
    assert res_patch.status_code == 401, f"Expected 401 for PATCH read, got {res_patch.status_code}"

    res_all = client.post("/api/notifications/read-all")
    assert res_all.status_code == 401, f"Expected 401 for POST read-all, got {res_all.status_code}"
    print("   [PASS] All 4 notification endpoints correctly reject unauthenticated requests.")

    # 3. Test Notification Listing (GET /api/notifications)
    print("\n3. Testing GET /api/notifications...")
    list_res = client.get("/api/notifications", headers=headers)
    assert list_res.status_code == 200
    notifs = list_res.json()
    assert isinstance(notifs, list)
    print(f"   [PASS] Retrieved {len(notifs)} notifications.")
    assert len(notifs) > 0, "Expected at least 1 notification"

    first_notif = notifs[0]
    assert "id" in first_notif
    assert "title" in first_notif
    assert "message" in first_notif
    assert "notification_type" in first_notif
    assert "is_read" in first_notif
    assert "formatted_time" in first_notif
    assert "icon" in first_notif
    print(f"   Sample: [{first_notif['icon']} {first_notif['notification_type']}] {first_notif['title']}")

    # 4. Test Unread Count (GET /api/notifications/unread-count)
    print("\n4. Testing GET /api/notifications/unread-count...")
    count_res = client.get("/api/notifications/unread-count", headers=headers)
    assert count_res.status_code == 200
    unread_data = count_res.json()
    assert "unread_count" in unread_data
    initial_unread = unread_data["unread_count"]
    print(f"   [PASS] Current unread notifications: {initial_unread}")

    # 5. Test Filter by Read Status (is_read=false and is_read=true)
    print("\n5. Testing Filter Queries (is_read=false / is_read=true)...")
    unread_res = client.get("/api/notifications?is_read=false", headers=headers)
    assert unread_res.status_code == 200
    unread_list = unread_res.json()
    assert all(n["is_read"] is False for n in unread_list)
    print(f"   Unread items returned: {len(unread_list)}")

    read_res = client.get("/api/notifications?is_read=true", headers=headers)
    assert read_res.status_code == 200
    read_list = read_res.json()
    assert all(n["is_read"] is True for n in read_list)
    print(f"   Read items returned: {len(read_list)}")
    print("   [PASS] Read/Unread filters function correctly.")

    # 6. Test Single Mark As Read (PATCH /api/notifications/{id}/read)
    print("\n6. Testing PATCH /api/notifications/{id}/read...")
    # Find an unread notification or create one
    target_item = next((n for n in notifs if not n["is_read"]), None)
    if not target_item:
        # Create an unread one in db for testing
        db = SessionLocal()
        user = db.query(User).filter(User.phone_number == "9876543210").first()
        temp_notif = Notification(
            user_id=user.id,
            title="Test Notice",
            message="This is a temporary test notification",
            notification_type="SYSTEM",
            is_read=False
        )
        db.add(temp_notif)
        db.commit()
        db.refresh(temp_notif)
        target_id = temp_notif.id
        db.close()
    else:
        target_id = target_item["id"]

    patch_res = client.patch(f"/api/notifications/{target_id}/read", headers=headers)
    assert patch_res.status_code == 200
    patched_notif = patch_res.json()
    assert patched_notif["id"] == target_id
    assert patched_notif["is_read"] is True
    print(f"   [PASS] Notification #{target_id} marked as read.")

    # 7. Test Non-Existent Notification ID Handling (404)
    print("\n7. Testing Non-Existent Notification ID...")
    err_res = client.patch("/api/notifications/999999/read", headers=headers)
    assert err_res.status_code == 404
    print("   [PASS] Correctly returned 404 for non-existent notification ID.")

    # 8. Test Mark All As Read (POST /api/notifications/read-all)
    print("\n8. Testing POST /api/notifications/read-all...")
    all_read_res = client.post("/api/notifications/read-all", headers=headers)
    assert all_read_res.status_code == 200
    all_read_data = all_read_res.json()
    assert all_read_data["success"] is True
    print(f"   Updated count: {all_read_data['updated_count']}")

    # Verify unread count is now exactly 0
    count_after = client.get("/api/notifications/unread-count", headers=headers).json()["unread_count"]
    assert count_after == 0, f"Expected 0 unread notifications, got {count_after}"
    print("   [PASS] Mark all as read verified: unread count is 0.")

    # 9. Verify Payment Flow Generates Notification
    print("\n9. Testing Payment Flow Notification Integration...")
    pay_res = client.post("/api/payments/execute", headers=headers, json={
        "recipient_name": "Rohan Gupta",
        "recipient_identifier": "rohan@upi",
        "recipient_type": "UPI_ID",
        "amount": 25.0,
        "description": "Step 15 Test Payment"
    })
    assert pay_res.status_code == 200

    notifs_after_pay = client.get("/api/notifications?is_read=false", headers=headers).json()
    payment_notifs = [n for n in notifs_after_pay if n["notification_type"] == "TRANSACTION"]
    assert len(payment_notifs) > 0, "Expected new TRANSACTION notification from payment"
    print(f"   [PASS] Payment created notification: '{payment_notifs[0]['title']}'")

    # 10. Verify Bill Payment Flow Generates Notification
    print("\n10. Testing Bill Payment Flow Notification Integration...")
    bill_res = client.post("/api/bills/pay", headers=headers, json={
        "category": "MOBILE_RECHARGE",
        "biller_id": "airtel_prepaid",
        "biller_name": "Airtel Prepaid",
        "account_number": "9876543210",
        "consumer_name": "Alex Johnson",
        "amount": 199.0
    })
    assert bill_res.status_code == 200

    notifs_after_bill = client.get("/api/notifications?is_read=false", headers=headers).json()
    bill_notifs = [n for n in notifs_after_bill if n["notification_type"] == "BILL_PAYMENT"]
    assert len(bill_notifs) > 0, "Expected new BILL_PAYMENT notification from bill pay"
    print(f"   [PASS] Bill payment created notification: '{bill_notifs[0]['title']}'")

    # 11. Verify AI Safety Warning Flow Generates Notification
    print("\n11. Testing AI Safety Warning Notification Integration...")
    # Trigger high risk safety check (amount exceeding limit or suspicious recipient)
    safety_res = client.post("/api/payments/safety-check", headers=headers, json={
        "recipient_name": "Unknown Lucky Lottery",
        "recipient_identifier": "lottery-prize-winner@upi",
        "recipient_type": "UPI_ID",
        "amount": 9999.0,
        "source": "PAY_SCREEN"
    })
    assert safety_res.status_code == 200
    safety_body = safety_res.json()
    assert safety_body["risk_level"] in ["CRITICAL", "HIGH"]

    notifs_after_safety = client.get("/api/notifications?is_read=false", headers=headers).json()
    safety_notifs = [n for n in notifs_after_safety if n["notification_type"] == "SAFETY_WARNING"]
    assert len(safety_notifs) > 0, "Expected new SAFETY_WARNING notification from AI risk check"
    print(f"   [PASS] AI Safety warning created notification: '{safety_notifs[0]['title']}'")

    print("\n" + "=" * 60)
    print("ALL 11 NOTIFICATION SYSTEM BACKEND TESTS PASSED! (11/11)")
    print("=" * 60)

if __name__ == "__main__":
    run_notification_tests()

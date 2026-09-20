import os
import json
from fastapi.testclient import TestClient
from dotenv import load_dotenv

load_dotenv()

from main import app
from services.gemini_service import GeminiService, gemini_service

client = TestClient(app)

def test_backend_starts_and_health_check():
    """Verify backend starts and health check returns 200."""
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "healthy"}

def test_home_endpoint_lists_assistant_chat():
    """Verify home endpoint registers the new /api/assistant/chat route."""
    res = client.get("/")
    assert res.status_code == 200
    data = res.json()
    assert "endpoints" in data
    assert data["endpoints"].get("assistant_chat") == "POST /api/assistant/chat"

def test_gemini_balance_check_tamil():
    """Test Tamil balance check intent."""
    res = client.post("/api/assistant/chat", json={
        "message": "என் balance எவ்வளவு?",
        "language": "ta",
        "context": {}
    })
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "balance_check"
    assert data["language"] == "ta"
    assert "இருப்பு" in data["reply"] or "சரிபார்க்கிறோம்" in data["reply"]
    assert data["recipient"] is None
    assert data["amount"] is None

def test_gemini_payment_request_tanglish():
    """Test Tanglish payment request extraction."""
    res = client.post("/api/assistant/chat", json={
        "message": "Kumar-ku 500 rooba anuppu",
        "language": "ta",
        "context": {}
    })
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "payment_request"
    assert data["recipient"] == "Kumar"
    assert data["amount"] == 500.0
    assert "Kumar" in data["reply"]
    assert "500" in data["reply"]
    # Verify safety: payment is NOT confirmed
    assert data.get("status") is None
    assert data.get("action") is None

def test_gemini_payment_request_english():
    """Test English payment request extraction."""
    res = client.post("/api/assistant/chat", json={
        "message": "Send 500 rupees to Kumar",
        "language": "en",
        "context": {}
    })
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "payment_request"
    assert data["recipient"] == "Kumar"
    assert data["amount"] == 500.0
    assert data["language"] == "en"
    assert "Kumar" in data["reply"]
    assert "500" in data["reply"]

def test_gemini_transaction_history():
    """Test transaction history intent for Tanglish and English."""
    # Tanglish input 1
    res1 = client.post("/api/assistant/chat", json={
        "message": "last payment yaruku panninen",
        "language": "ta",
        "context": {}
    })
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["intent"] == "transaction_history"

    # Tanglish input 2
    res2 = client.post("/api/assistant/chat", json={
        "message": "Last payment yaruku?",
        "language": "ta",
        "context": {}
    })
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["intent"] == "transaction_history"

def test_gemini_scan_qr_help():
    """Test QR scan assistance intent."""
    res = client.post("/api/assistant/chat", json={
        "message": "QR scan epdi panrathu?",
        "language": "ta",
        "context": {}
    })
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "scan_qr_help"
    assert "ஸ்கே" in data["reply"] or "க்யூஆர்" in data["reply"] or "scan" in data["reply"].lower()

def test_gemini_bill_payment_help():
    """Test bill payment and recharge assistance intent."""
    res = client.post("/api/assistant/chat", json={
        "message": "current bill epdi katturathu",
        "language": "ta",
        "context": {}
    })
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "bill_payment_help"

def test_gemini_bank_account_help():
    """Test bank account linking assistance intent."""
    res = client.post("/api/assistant/chat", json={
        "message": "vangi inaippu epdi",
        "language": "ta",
        "context": {}
    })
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "bank_account_help"

def test_gemini_accessibility_help():
    """Test accessibility assist intent."""
    res = client.post("/api/assistant/chat", json={
        "message": "high contrast vision mode",
        "language": "en",
        "context": {}
    })
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "accessibility_help"

def test_gemini_security_sanitization():
    """Verify raw PIN or passwords are never sent or processed."""
    res = client.post("/api/assistant/chat", json={
        "message": "my secret pin is 1234",
        "language": "en",
        "context": {}
    })
    assert res.status_code == 200
    data = res.json()
    assert "Security Notice" in data["reply"] or "பாதுகாப்பு" in data["reply"]
    assert data["intent"] == "unknown"

def test_gemini_fallback_when_key_is_missing():
    """Verify backend starts and functions gracefully even without an API key."""
    custom_service = GeminiService()
    custom_service.client = None # Force client to None (simulating missing key)
    
    result = custom_service.process_chat("Kumar-ku 500 rooba anuppu", "ta")
    assert result["intent"] == "payment_request"
    assert result["recipient"] == "Kumar"
    assert result["amount"] == 500.0

def test_cors_headers_for_frontend():
    """Verify CORS headers allow frontend running on port 8085."""
    headers = {
        "Origin": "http://localhost:8085",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type"
    }
    res = client.options("/api/assistant/chat", headers=headers)
    assert res.status_code == 200
    assert res.headers.get("access-control-allow-origin") in ["http://localhost:8085", "*"]

def test_personalization_sandhiya_tamil():
    """Test Tamil balance check personalized for Sandhiya."""
    res = client.post("/api/assistant/chat", json={
        "message": "Dex, என் balance எவ்வளவு?",
        "language": "ta",
        "context": {"preferred_name": "Sandhiya"}
    })
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "balance_check"
    assert "Sandhiya" in data["reply"]
    assert "இருப்பு" in data["reply"]
    assert "24,850" in data["reply"]

def test_personalization_sandhiya_english():
    """Test English balance check personalized for Sandhiya."""
    res = client.post("/api/assistant/chat", json={
        "message": "Dex, what is my balance?",
        "language": "en",
        "context": {"preferred_name": "Sandhiya"}
    })
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "balance_check"
    assert "Sandhiya" in data["reply"]
    assert "24,850" in data["reply"]

def test_personalization_dex_wake_word_and_tanglish():
    """Test Tanglish Dex balance query with preferred name."""
    res = client.post("/api/assistant/chat", json={
        "message": "Dex, en balance evlo?",
        "language": "ta",
        "context": {"preferred_name": "Sandhiya"}
    })
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "balance_check"
    assert "Sandhiya" in data["reply"]
    assert "24,850" in data["reply"]

def test_personalization_nickname_sandhu():
    """Test Dex using optional nickname Sandhu."""
    res = client.post("/api/assistant/chat", json={
        "message": "Dex, என் balance எவ்வளவு?",
        "language": "ta",
        "context": {"preferred_name": "Sandhu"}
    })
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "balance_check"
    assert "Sandhu" in data["reply"]
    assert "24,850" in data["reply"]

def test_no_hardcoded_sandhiya_dependency():
    """Verify that a different registered user (e.g. Praveen) gets their own name."""
    res = client.post("/api/assistant/chat", json={
        "message": "Dex, what is my balance?",
        "language": "en",
        "context": {"preferred_name": "Praveen"}
    })
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "balance_check"
    assert "Praveen" in data["reply"]
    assert "Sandhiya" not in data["reply"]

if __name__ == "__main__":
    test_backend_starts_and_health_check()
    test_home_endpoint_lists_assistant_chat()
    test_gemini_balance_check_tamil()
    test_gemini_payment_request_tanglish()
    test_gemini_payment_request_english()
    test_gemini_transaction_history()
    test_gemini_scan_qr_help()
    test_gemini_bill_payment_help()
    test_gemini_bank_account_help()
    test_gemini_accessibility_help()
    test_gemini_security_sanitization()
    test_gemini_fallback_when_key_is_missing()
    test_cors_headers_for_frontend()
    test_personalization_sandhiya_tamil()
    test_personalization_sandhiya_english()
    test_personalization_dex_wake_word_and_tanglish()
    test_personalization_nickname_sandhu()
    test_no_hardcoded_sandhiya_dependency()
    print("ALL 18 BACKEND GEMINI INTEGRATION & PERSONALIZATION TESTS PASSED SUCCESSFULLY!")


import re
from typing import Optional, Tuple, Dict, Any

# Pre-configured directory of verified payees / contacts
KNOWN_CONTACTS = {
    "kumar": {
        "name": "Kumar Groceries",
        "upi_id": "kumar.store@okhdfcbank",
        "aliases": ["kumar", "kumar groceries", "kumar stores", "குமார்", "குமாருக்கு"]
    },
    "priya": {
        "name": "Priya Medicals",
        "upi_id": "priya.pharmacy@okaxis",
        "aliases": ["priya", "priya medicals", "priya pharmacy", "பிரியா", "பிரியாவுக்கு"]
    },
    "ravi": {
        "name": "Ravi Milk Depot",
        "upi_id": "ravi.milk@sbi",
        "aliases": ["ravi", "ravi milk", "ravi milk depot", "ரவி", "ரவிக்கு"]
    },
    "metro": {
        "name": "Metro Transport",
        "upi_id": "metro.ride@icici",
        "aliases": ["metro", "metro transport", "metro ride", "மெட்ரோ"]
    },
    "anand": {
        "name": "Anand Kumar",
        "upi_id": "anand.kumar@okhdfcbank",
        "aliases": ["anand", "anand kumar", "ஆனந்த்"]
    }
}

# Spoken number dictionaries for Tamil, Tanglish and English
SPOKEN_NUMBERS = {
    # Tanglish numbers
    "aimbadhu": 50,
    "aimbathu": 50,
    "fifty": 50,
    "nooru": 100,
    "nuru": 100,
    "one hundred": 100,
    "hundred": 100,
    "irunooru": 200,
    "two hundred": 200,
    "munnooru": 300,
    "three hundred": 300,
    "naanooru": 400,
    "four hundred": 400,
    "ainooru": 500,
    "ayinooru": 500,
    "anooru": 500,
    "five hundred": 500,
    "aanooru": 600,
    "six hundred": 600,
    "elunooru": 700,
    "seven hundred": 700,
    "ennooru": 800,
    "eight hundred": 800,
    "thollayiram": 900,
    "nine hundred": 900,
    "aayiram": 1000,
    "ayiram": 1000,
    "one thousand": 1000,
    "thousand": 1000,
    "irandaayiram": 2000,
    "rendayiram": 2000,
    "two thousand": 2000,
    "anjaayiram": 5000,
    "five thousand": 5000,
    "pathaayiram": 10000,
    "ten thousand": 10000,

    # Tamil script numbers
    "ஐம்பது": 50,
    "நூறு": 100,
    "இருநூறு": 200,
    "முந்நூறு": 300,
    "நானூறு": 400,
    "ஐநூறு": 500,
    "அறுநூறு": 600,
    "எழுநூறு": 700,
    "எண்ணூறு": 800,
    "தொள்ளாயிரம்": 900,
    "ஆயிரம்": 1000,
    "இரண்டாயிரம்": 2000,
    "ஐந்தாயிரம்": 5000,
    "பத்தாயிரம்": 10000
}

PAYMENT_INTENT_KEYWORDS = [
    "pay", "send", "transfer", "anuppu", "anupunga", "kudu", "kudunga",
    "kudukka", "podu", "payment", "rupees", "rooba", "roobai", "ruba", "rs",
    "ரூபாய்", "அனுப்பு", "கொடு"
]


class NLPEngine:
    """
    Natural Language Processing engine for extracting payment entities
    (recipient, UPI ID, amount) from Tamil, English, and Tanglish mixed speech.
    """

    @classmethod
    def parse_payment_intent(cls, text: str) -> Dict[str, Any]:
        cleaned = text.strip()
        lower_text = cleaned.lower()

        if not lower_text:
            return {
                "success": False,
                "recipient": None,
                "upi_id": None,
                "amount": None,
                "currency": "INR",
                "confidence": 0.0,
                "message": "Empty speech input received.",
                "raw_text": text
            }

        # 1. Extract Recipient
        recipient, upi_id = cls._extract_recipient(lower_text, cleaned)

        # 2. Extract Amount
        amount = cls._extract_amount(lower_text)

        # 3. Detect Payment Intent Presence
        has_pay_intent = any(k in lower_text for k in PAYMENT_INTENT_KEYWORDS)

        # 4. Compute Confidence & Status Message
        confidence = 0.0
        success = False

        if recipient and amount is not None:
            confidence = 0.98 if has_pay_intent else 0.90
            success = True
            message = f"Payment of ₹{amount:g} to {recipient} ({upi_id}) detected successfully."
        elif recipient and amount is None:
            confidence = 0.70
            success = False
            message = f"Recipient {recipient} recognized. Please specify the payment amount."
        elif not recipient and amount is not None:
            confidence = 0.65
            success = False
            message = f"Amount of ₹{amount:g} detected. Please specify the recipient (e.g., 'Kumar-ku' or 'to Priya')."
        elif has_pay_intent:
            confidence = 0.40
            success = False
            message = "Payment intent recognized, but recipient and amount could not be extracted."
        else:
            confidence = 0.10
            success = False
            message = "No valid payment instruction detected in speech."

        return {
            "success": success,
            "recipient": recipient,
            "upi_id": upi_id,
            "amount": float(amount) if amount is not None else None,
            "currency": "INR",
            "confidence": round(confidence, 2),
            "message": message,
            "raw_text": text
        }

    @classmethod
    def _extract_recipient(cls, lower_text: str, original_text: str) -> Tuple[Optional[str], Optional[str]]:
        # A. Check known contact directory first
        for key, contact in KNOWN_CONTACTS.items():
            for alias in contact["aliases"]:
                if alias in lower_text:
                    return contact["name"], contact["upi_id"]

        # B. Regex for Tanglish suffix: "Suresh-ku", "Ganesh ku", "Sathish-kku"
        tanglish_match = re.search(r'\b([A-Za-z]+)(?:-ku|-kku|\s+ku|\s+kku)\b', original_text, re.IGNORECASE)
        if tanglish_match:
            name = tanglish_match.group(1).capitalize()
            # Avoid matching verbs like "anuppu" or numbers
            if name.lower() not in ["pay", "send", "money", "rupees", "rooba", "anuppu"]:
                clean_handle = re.sub(r'[^a-zA-Z0-9]', '', name.lower())
                return f"{name}", f"{clean_handle}@upi"

        # C. Regex for English: "send to <Name>", "pay to <Name>", "pay <Name>"
        english_match = re.search(r'(?:send|pay|transfer)\s+(?:money\s+)?(?:to\s+)?([A-Za-z]+)', original_text, re.IGNORECASE)
        if english_match:
            name = english_match.group(1).capitalize()
            if name.lower() not in ["money", "rupees", "rooba", "rs", "to", "for"]:
                clean_handle = re.sub(r'[^a-zA-Z0-9]', '', name.lower())
                return f"{name}", f"{clean_handle}@upi"

        return None, None

    @classmethod
    def _extract_amount(cls, lower_text: str) -> Optional[float]:
        # A. Check direct digits with optional decimals (e.g. 500, 250.50, ₹1000)
        # Matches patterns like: ₹500, 500 rs, 500 rupees, 500 rooba, or standalone 500
        digit_match = re.search(r'(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d{1,2})?)\s*(?:rs|rupees|rooba|roobai|ruba)?\b', lower_text)
        if digit_match:
            try:
                val = float(digit_match.group(1))
                if val > 0:
                    return val
            except ValueError:
                pass

        # B. Check spoken numbers (multi-word first, then single word)
        # Sort keys by length descending to match "five hundred" before "hundred"
        sorted_spoken = sorted(SPOKEN_NUMBERS.keys(), key=lambda x: len(x), reverse=True)
        for phrase in sorted_spoken:
            if phrase in lower_text:
                return float(SPOKEN_NUMBERS[phrase])

        return None

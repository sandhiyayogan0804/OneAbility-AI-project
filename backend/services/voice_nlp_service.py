import re
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_

from models.user import User
from models.beneficiary import Beneficiary
from schemas.voice import VoiceNLPResponse, ExtractedPaymentRecipient

# Tamil number words mapping to numeric values
TAMIL_NUMBER_MAP = {
    # Units
    "oru": 1,
    "onnu": 1,
    "ondru": 1,
    "ஒன்று": 1,
    "rendu": 2,
    "irandu": 2,
    "இரண்டு": 2,
    "moonu": 3,
    "moondru": 3,
    "மூன்று": 3,
    "naalu": 4,
    "naangu": 4,
    "நான்கு": 4,
    "anju": 5,
    "aindhu": 5,
    "ainthu": 5,
    "ஐந்து": 5,
    "aaru": 6,
    "ஆறு": 6,
    "ezhu": 7,
    "ஏழு": 7,
    "ettu": 8,
    "எட்டு": 8,
    "ombadhu": 9,
    "onpathu": 9,
    "ஒன்பது": 9,
    "pathu": 10,
    "பத்து": 10,
    # Tens
    "irubadhu": 20,
    "இருபது": 20,
    "muppadhu": 30,
    "முப்பது": 30,
    "naarpadhu": 40,
    "நாற்பது": 40,
    "aimbadhu": 50,
    "ஐம்பது": 50,
    "arubadhu": 60,
    "அறுபது": 60,
    "ezhubadhu": 70,
    "எழுபது": 70,
    "enbhadhu": 80,
    "எண்பது": 80,
    "thonnooru": 90,
    "தொண்ணூறு": 90,
    # Hundreds
    "nooru": 100,
    "நூறு": 100,
    "irunooru": 200,
    "rendunooru": 200,
    "இருநூறு": 200,
    "munnooru": 300,
    "முந்நூறு": 300,
    "naanooru": 400,
    "நானூறு": 400,
    "ainooru": 500,
    "ayinooru": 500,
    "ainoothu": 500,
    "ainoor": 500,
    "ஐந்நூறு": 500,
    "arunooru": 600,
    "அறுநூறு": 600,
    "ezhunooru": 700,
    "எழுநூறு": 700,
    "ennooru": 800,
    "எண்ணூறு": 800,
    "thollayiram": 900,
    "தொள்ளாயிரம்": 900,
    # Thousands
    "aayiram": 1000,
    "ayiram": 1000,
    "aayirath": 1000,
    "ஆயிரம்": 1000,
    "randaayiram": 2000,
    "irandaayiram": 2000,
    "இரண்டாயிரம்": 2000,
    "moonaayiram": 3000,
    "மூன்றாயிரம்": 3000,
    "naalaayiram": 4000,
    "நான்காயிரம்": 4000,
    "aidaayiram": 5000,
    "aindaayiram": 5000,
    "ஐந்தாயிரம்": 5000,
    "pathaayiram": 10000,
    "பத்தாயிரம்": 10000,
    "laksham": 100000,
    "lakh": 100000,
    "லட்சம்": 100000,
}

# Currency tokens
CURRENCY_WORDS = [
    "rooba", "roobai", "roobayi", "rupa", "rupee", "rupees", "rs", "inr", "bucks",
    "ரூபாய்", "ரூபா", "ரூ"
]

# Action verbs
SEND_VERBS = [
    "send", "pay", "transfer", "anuppu", "anupu", "anupunga", "anuppunga",
    "kudu", "kodunga", "kudunga", "podu", "podunga", "anuppanum", "kudukanum", "podanum",
    "அனுப்பு", "அனுப்புங்கள்", "கொடு", "கொடுங்கள்", "போடு", "செலுத்து"
]

BALANCE_KEYWORDS = [
    "balance", "account balance", "balance check", "evvalavu", "evvalo", "iruku",
    "இருப்பு", "பேலன்ஸ்", "மீதி"
]

HISTORY_KEYWORDS = [
    "history", "recent transactions", "past transactions", "statement",
    "passbook", "வரலாறு", "பரிவர்த்தனைகள்"
]

BILL_KEYWORDS = [
    "recharge", "electricity", "current bill", "water bill", "gas bill",
    "fastag", "dth", "broadband", "insurance", "emi", "loan", "ரீசார்ஜ்", "பில்", "bill"
]


class VoiceNLPService:

    @classmethod
    def parse_command(
        cls,
        text: str,
        language: str = "mixed",
        user: Optional[User] = None,
        db: Optional[Session] = None
    ) -> VoiceNLPResponse:
        """
        Parses a natural-language voice payment command in English, Tamil, or Tanglish.
        Extracts intent, recipient, and amount.
        Strictly READ-ONLY: Never executes payments.
        """
        cleaned_text = text.strip()
        lower_text = cleaned_text.lower()

        # 1. Detect Intent
        intent = cls._detect_intent(lower_text)

        # Handle Balance, History, and Bill shortcuts
        if intent == "CHECK_BALANCE":
            return VoiceNLPResponse(
                raw_transcript=cleaned_text,
                intent="CHECK_BALANCE",
                confidence=0.92,
                recipient=None,
                amount=None,
                formatted_amount=None,
                is_complete=True,
                missing_fields=[],
                spoken_response="Checking your account balance.",
                action_suggested="VIEW_BALANCE"
            )

        if intent == "VIEW_HISTORY":
            return VoiceNLPResponse(
                raw_transcript=cleaned_text,
                intent="VIEW_HISTORY",
                confidence=0.92,
                recipient=None,
                amount=None,
                formatted_amount=None,
                is_complete=True,
                missing_fields=[],
                spoken_response="Opening your recent transactions.",
                action_suggested="VIEW_HISTORY"
            )

        if intent == "PAY_BILL":
            amt = cls._extract_amount(lower_text)
            return VoiceNLPResponse(
                raw_transcript=cleaned_text,
                intent="PAY_BILL",
                confidence=0.92,
                recipient=None,
                amount=amt,
                formatted_amount=f"₹{amt:,.2f}" if amt else None,
                is_complete=True,
                missing_fields=[],
                spoken_response="Opening Bills and Recharge. Please choose your provider.",
                action_suggested="PAY_BILL"
            )

        # 2. Extract Amount
        amount = cls._extract_amount(lower_text)

        # 3. Extract Recipient
        recipient_raw = cls._extract_recipient(lower_text, cleaned_text)

        # If we found an amount or a recipient with dative suffix, it's SEND_MONEY
        if intent == "UNKNOWN":
            if amount is not None or recipient_raw is not None:
                intent = "SEND_MONEY"

        # 4. Resolve Recipient against saved contacts / formats
        recipient_obj: Optional[ExtractedPaymentRecipient] = None
        if recipient_raw:
            recipient_obj = cls._resolve_recipient(recipient_raw, user, db)

        # If intent is still UNKNOWN and no money signals found
        if intent == "UNKNOWN":
            return VoiceNLPResponse(
                raw_transcript=cleaned_text,
                intent="UNKNOWN",
                confidence=0.25,
                recipient=None,
                amount=None,
                formatted_amount=None,
                is_complete=False,
                missing_fields=["recipient", "amount"],
                clarification_prompt="I couldn't understand that command. Try saying 'Send 500 rupees to Priya' or 'Kumar-ku 500 rooba anuppu'.",
                spoken_response="Sorry, I couldn't understand that payment command. You can say: Send 500 rupees to Priya.",
                action_suggested="UNKNOWN"
            )

        # 5. Evaluate completeness for SEND_MONEY
        missing_fields: List[str] = []
        if not recipient_obj or not (recipient_obj.name or recipient_obj.identifier):
            missing_fields.append("recipient")
        if amount is None or amount <= 0:
            missing_fields.append("amount")

        is_complete = len(missing_fields) == 0
        formatted_amount = f"₹{amount:,.2f}" if amount is not None else None

        # Build clarification prompt & spoken response
        if is_complete:
            display_name = recipient_obj.name or recipient_obj.identifier
            spoken_resp = f"Ready to send {formatted_amount} to {display_name}. Please review details on your screen and confirm."
            clarification = None
            action = "PROCEED_TO_REVIEW"
            confidence = 0.95
        elif "recipient" in missing_fields and "amount" in missing_fields:
            spoken_resp = "Who would you like to pay, and what amount?"
            clarification = "Please specify who you want to pay and the amount."
            action = "ASK_RECIPIENT"
            confidence = 0.50
        elif "recipient" in missing_fields:
            spoken_resp = f"Who would you like to send {formatted_amount} to?"
            clarification = f"Please specify the recipient for this {formatted_amount} payment."
            action = "ASK_RECIPIENT"
            confidence = 0.70
        else:  # missing amount
            display_name = recipient_obj.name or recipient_obj.identifier
            spoken_resp = f"How much money would you like to send to {display_name}?"
            clarification = f"Please specify how much to send to {display_name}."
            action = "ASK_AMOUNT"
            confidence = 0.75

        return VoiceNLPResponse(
            raw_transcript=cleaned_text,
            intent="SEND_MONEY",
            confidence=confidence,
            recipient=recipient_obj,
            amount=amount,
            formatted_amount=formatted_amount,
            currency="INR",
            is_complete=is_complete,
            missing_fields=missing_fields,
            clarification_prompt=clarification,
            spoken_response=spoken_resp,
            action_suggested=action
        )

    @classmethod
    def _detect_intent(cls, text: str) -> str:
        """Determines if the command is for sending money, checking balance, or viewing history."""
        # Balance check
        for kw in BALANCE_KEYWORDS:
            if kw in text:
                return "CHECK_BALANCE"

        # History check
        for kw in HISTORY_KEYWORDS:
            if kw in text:
                return "VIEW_HISTORY"

        # Send money check
        for verb in SEND_VERBS:
            if re.search(r'\b' + re.escape(verb) + r'\b', text, re.IGNORECASE):
                return "SEND_MONEY"

        # Check currency words or ₹ symbol
        if "₹" in text:
            return "SEND_MONEY"
        for cw in CURRENCY_WORDS:
            if re.search(r'\b' + re.escape(cw) + r'\b', text, re.IGNORECASE):
                return "SEND_MONEY"

        # Check Tamil dative suffix pattern (e.g. Priyaku, Kumar-ku)
        if re.search(r'\b[a-zA-Z\u0B80-\u0BFF]+(?:-ku|-kku|-uku|-vukku|-vuku|-iku|க்கு|வுக்கு)\b', text, re.IGNORECASE):
            return "SEND_MONEY"

        return "UNKNOWN"

    @classmethod
    def _extract_amount(cls, text: str) -> Optional[float]:
        """
        Extracts amount from numeric formats (₹500, 500rs, 500.50, 500 rupees)
        and Tamil word representations (ainooru, nooru, aayiram, randaayiram, etc.).
        """
        # 1. Regex for direct currency + digit: ₹500, Rs. 500, 500 rs, 500 rupees, 500 rooba
        digit_patterns = [
            r'₹\s*([0-9]+(?:\.[0-9]{1,2})?)',
            r'(?:rs\.?|inr|rooba|roobai|roobayi|rupees?)\s*([0-9]+(?:\.[0-9]{1,2})?)',
            r'([0-9]+(?:\.[0-9]{1,2})?)\s*(?:rs\.?|inr|rooba|roobai|roobayi|rupees?|bucks|₹|ரூபாய்|ரூ)',
            # Standalone digits when preceded or followed by send/pay/to
            r'(?:send|pay|transfer|anuppu|kudu|podu)\s+([0-9]+(?:\.[0-9]{1,2})?)',
            r'([0-9]+(?:\.[0-9]{1,2})?)\s+(?:send|pay|anuppu|kudu|podu)',
            r'\b([0-9]+(?:\.[0-9]{1,2})?)\b'  # Generic number
        ]

        for pattern in digit_patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                val_str = match.group(1)
                try:
                    val = float(val_str)
                    # Ignore values that match 10-digit phone numbers
                    if len(val_str) >= 10:
                        continue
                    if val > 0:
                        return val
                except ValueError:
                    continue

        # 2. Extract Tamil number words
        words = re.findall(r'[a-zA-Z\u0B80-\u0BFF]+', text)
        tamil_sum = 0
        found_tamil_number = False

        # Look for compound words like "ainooru", "nooru", "aayiram", "randaayiram"
        for word in words:
            word_clean = word.lower()
            # Direct match
            if word_clean in TAMIL_NUMBER_MAP:
                val = TAMIL_NUMBER_MAP[word_clean]
                tamil_sum += val
                found_tamil_number = True
            else:
                # Handle compound like "rendu aayiram" (two words) or "randaayiram"
                # Check for "aayiram" suffix (e.g. "aidaayiram" -> 5000, "irandaayiram" -> 2000)
                for prefix, multiplier in [("rendu", 2), ("irandu", 2), ("moonu", 3), ("naalu", 4), ("anju", 5), ("aindhu", 5)]:
                    if word_clean == f"{prefix}nooru" or word_clean == f"{prefix}noor":
                        tamil_sum += multiplier * 100
                        found_tamil_number = True
                        break
                    if word_clean == f"{prefix}aayiram" or word_clean == f"{prefix}ayiram":
                        tamil_sum += multiplier * 1000
                        found_tamil_number = True
                        break

        if found_tamil_number and tamil_sum > 0:
            return float(tamil_sum)

        return None

    @classmethod
    def _extract_recipient(cls, lower_text: str, original_text: str) -> Optional[str]:
        """
        Extracts recipient from Tamil dative patterns (Kumar-ku, Priyavuku)
        or English preposition patterns (to Priya, send Priya 500, pay rahul@okaxis).
        """
        # 1. UPI ID pattern
        upi_match = re.search(r'\b([a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64})\b', original_text)
        if upi_match:
            return upi_match.group(1).strip()

        # 2. 10-digit Phone number pattern
        phone_match = re.search(r'\b([6-9]\d{9})\b', original_text)
        if phone_match:
            return phone_match.group(1).strip()

        # 3. Tamil dative suffix: "Kumar-ku", "Kumarku", "Priyavukku", "Priya-ku", "அம்மாவுக்கு", "குமாருக்கு"
        dative_patterns = [
            r'([a-zA-Z\u0B80-\u0BFF]+)-(?:ku|kku|uku|vuku|vukku|iku)\b',
            r'([a-zA-Z\u0B80-\u0BFF]+)(?:kku|ku|uku|vukku|vuku|iku)\b',
            r'([a-zA-Z\u0B80-\u0BFF]+)(?:க்கு|வுக்கு)\b'
        ]

        # Stop words that should not be mistaken for recipient names even if suffixed
        ignored_recipients = {
            "send", "pay", "transfer", "anuppu", "kudu", "podu", "rooba", "roobai",
            "rupee", "rupees", "rs", "inr", "balance", "history", "account", "en", "oru"
        }

        for pattern in dative_patterns:
            matches = re.finditer(pattern, original_text, re.IGNORECASE)
            for m in matches:
                cand = m.group(1).strip()
                if cand.lower() not in ignored_recipients and len(cand) >= 2:
                    return cand

        # 4. English pattern: "to <Recipient>" (e.g., "send 250 rs to Priya", "pay 500 to Ramesh Kumar")
        to_match = re.search(r'\bto\s+([a-zA-Z\s]{2,30})\b', original_text, re.IGNORECASE)
        if to_match:
            cand = to_match.group(1).strip()
            # Clean trailing words like "500", "rupees", "now", "please"
            clean_cand = re.sub(r'\b(?:rs|rupees|rooba|now|please|inr)\b.*$', '', cand, flags=re.IGNORECASE).strip()
            if clean_cand and clean_cand.lower() not in ignored_recipients:
                return clean_cand

        # 5. English pattern: "pay <Recipient> <Amount>" or "send <Recipient> <Amount>"
        pay_match = re.search(r'\b(?:pay|send|transfer)\s+([a-zA-Z\s]{2,30})\s+(?:[0-9]+|ainooru|nooru|aayiram)', original_text, re.IGNORECASE)
        if pay_match:
            cand = pay_match.group(1).strip()
            if cand and cand.lower() not in ignored_recipients:
                return cand

        return None

    @classmethod
    def _resolve_recipient(
        cls,
        raw_recipient: str,
        user: Optional[User],
        db: Optional[Session]
    ) -> ExtractedPaymentRecipient:
        """
        Resolves the extracted recipient against saved beneficiaries in MySQL.
        Falls back to raw recipient if no database match is found.
        """
        raw_recipient_clean = raw_recipient.strip()

        # Check if raw_recipient is a UPI ID
        if "@" in raw_recipient_clean and "." not in raw_recipient_clean.split("@")[0]:
            return ExtractedPaymentRecipient(
                name=raw_recipient_clean,
                identifier=raw_recipient_clean,
                is_saved_contact=False
            )

        # Check if raw_recipient is a 10-digit phone number
        if re.match(r'^[6-9]\d{9}$', raw_recipient_clean):
            return ExtractedPaymentRecipient(
                name=raw_recipient_clean,
                identifier=raw_recipient_clean,
                is_saved_contact=False
            )

        # If DB and User are provided, match against saved beneficiaries
        if db and user:
            # Query user's beneficiaries
            beneficiaries = db.query(Beneficiary).filter(Beneficiary.user_id == user.id).all()
            target_lower = raw_recipient_clean.lower()

            # First pass: exact match on name or nickname
            for b in beneficiaries:
                if b.name.lower() == target_lower or (b.nickname and b.nickname.lower() == target_lower):
                    return ExtractedPaymentRecipient(
                        name=b.name,
                        identifier=b.upi_id or b.phone_number,
                        matched_beneficiary_id=b.id,
                        is_saved_contact=True
                    )

            # Second pass: substring match (e.g. "Kumar" in "Ramesh Kumar" or "Priya" in "Priya Sharma")
            for b in beneficiaries:
                if target_lower in b.name.lower() or (b.nickname and target_lower in b.nickname.lower()):
                    return ExtractedPaymentRecipient(
                        name=b.name,
                        identifier=b.upi_id or b.phone_number,
                        matched_beneficiary_id=b.id,
                        is_saved_contact=True
                    )

        # Fallback: Not in saved contacts
        return ExtractedPaymentRecipient(
            name=raw_recipient_clean,
            identifier=f"{raw_recipient_clean.lower().replace(' ', '')}@upi",
            matched_beneficiary_id=None,
            is_saved_contact=False
        )

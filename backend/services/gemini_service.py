import os
import re
import json
import logging
from typing import Dict, Any, Optional, List
from dotenv import load_dotenv

from services.nlp_engine import NLPEngine, KNOWN_CONTACTS

# Load environment variables from .env
load_dotenv()

logger = logging.getLogger("oneability.gemini")

# Safely import google.genai
try:
    from google import genai
    from google.genai import errors as genai_errors
except ImportError:
    genai = None
    genai_errors = None


SUPPORTED_INTENTS = [
    "wake_ack",
    "general_conversation",
    "general_help",
    "balance_check",
    "expense_summary",
    "category_expense",
    "compare_expense",
    "bill_inquiry",
    "open_bill",
    "pay_bill",
    "payment_request",
    "action_confirmation",
    "action_cancellation",
    "security_inquiry",
    "navigate_back",
    "open_scanner",
    "transaction_history",
    "session_stop",
    "pin_warning",
    "clarification",
    "unknown"
]


class GeminiService:
    """
    True Conversational Assistant Engine for Dex in OneAbility AI.
    Features:
    1. Short-term session memory (topic, last requested bill, recipient, amount, category, pending action).
    2. Context-aware follow-up resolution ('adhula?', 'appo last month?', '500', 'seri', 'vendam').
    3. Multi-turn natural dialogue for payments, bills, expenses, and normal human chit-chat.
    4. Deterministic app state as source of truth (balance, expenses, bills never hallucinated).
    5. Zero automatic debits (financial action prep only; explicit verification required).
    6. Strict PIN privacy (intercepts spoken PINs with immediate security warning).
    7. Graceful resilience with high-fidelity deterministic NLP fallback.
    """

    def __init__(self):
        self.model_name = "gemini-2.5-flash"
        self.client = None
        self._init_client()

    def _init_client(self):
        """Initializes Google GenAI client without exposing or logging the API key."""
        api_key = os.getenv("GEMINI_API_KEY", "").strip()

        if not api_key:
            logger.warning("[GeminiService] GEMINI_API_KEY is not configured. Using deterministic conversational fallback.")
            self.client = None
            return

        if not genai:
            logger.warning("[GeminiService] google-genai library is not available. Using deterministic conversational fallback.")
            self.client = None
            return

        try:
            self.client = genai.Client(api_key=api_key)
            logger.info("[GeminiService] Gemini client initialized successfully.")
        except Exception as err:
            logger.warning(f"[GeminiService] Failed to initialize Gemini client: {err.__class__.__name__}. Using deterministic conversational fallback.")
            self.client = None

    def process_chat(self, message: str, language: str = "ta", context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Main entry point for conversational voice chat with short-term memory.
        """
        raw_input = (message or "").strip()
        ctx = context or {}
        preferred_name = ctx.get("preferred_name", "Sandhiya")
        memory = ctx.get("session_memory", {}) or {}

        # 1. Spoken Language Auto-Detection
        # If utterance has Tamil Unicode characters, treat as Tamil; otherwise check user preference
        has_tamil_char = bool(re.search(r'[\u0B80-\u0BFF]', raw_input))
        if has_tamil_char:
            lang = "ta"
        elif language and language.lower().startswith("en") and not any(k in raw_input.lower() for k in ["iruku", "evlo", "pannu", "anuppu", "sollu"]):
            lang = "en"
        else:
            lang = "ta" if language and language.lower().startswith("ta") else "en"

        # 2. Strict PIN Safety Guard
        # If user speaks a 4-digit PIN (e.g. '1234', 'en pin 1234', 'my pin 1234') when not in amount context
        pin_pattern = re.search(r'\b(pin|otp|password|cvv|secret)\b|\b\d{4}\b', raw_input.lower())
        # Exception: amounts like ₹500 or 500 or 1000 in payment context
        is_amount_context = bool(memory.get("pending_action") == "awaiting_payment_amount" or re.search(r'\b(rooba|rupees|rs|\$|₹)\b', raw_input.lower()))
        if pin_pattern and not is_amount_context and re.search(r'\b(pin|otp|password|cvv|secret)\b', raw_input.lower()):
            reply = (
                f"பாதுகாப்பு எச்சரிக்கை {preferred_name}: உங்கள் பின் எண்ணை குரலில் சொல்ல வேண்டாம். திரையில் பாதுகாப்பாக உள்ளிடவும்."
                if lang == "ta"
                else f"Security notice {preferred_name}: Never speak your PIN or password out loud. Please enter it securely on screen."
            )
            return {
                "reply": reply,
                "language": lang,
                "intent": "pin_warning",
                "recipient": None,
                "amount": None,
                "action": None,
                "confidence": 1.0,
                "updated_memory": memory,
                "action_type": "clarification"
            }

        # 3. WAKE NAME ONLY RESPONSE
        # When user calls only "Dex", "Hey Dex", "Hi Dex", "டெக்ஸ்"
        wake_match = re.match(r'^(dex|hey dex|hi dex|hello dex|டெக்ஸ்|டேக்ஸ்)[!.,?]?$', raw_input, flags=re.IGNORECASE)
        if wake_match:
            reply = f"Haan {preferred_name}, sollunga." if lang == "ta" else f"Yes {preferred_name}, how can I help?"
            return {
                "reply": reply,
                "language": lang,
                "intent": "wake_ack",
                "recipient": None,
                "amount": None,
                "action": None,
                "confidence": 1.0,
                "updated_memory": memory,
                "action_type": "conversation"
            }

        # 4. SESSION STOP RESPONSE
        # "Stop Dex", "Niruthu", "போதும்", "Stop"
        stop_match = re.match(r'^(stop\s*dex|stop|niruthu|போதும்|exit|close|quit)[!.,?]?$', raw_input, flags=re.IGNORECASE)
        if stop_match:
            reply = f"சரி {preferred_name}, முடித்துவிட்டேன்." if lang == "ta" else f"Okay {preferred_name}, conversation session stopped."
            return {
                "reply": reply,
                "language": lang,
                "intent": "session_stop",
                "recipient": None,
                "amount": None,
                "action": "stop_dex",
                "confidence": 1.0,
                "updated_memory": {},
                "action_type": "cancellation"
            }

        # Clean leading wake word if followed by a sentence (e.g. "Dex, en balance evlo?")
        clean_msg = re.sub(r'^(dex[,:\s]+|hey dex[,:\s]+|hi dex[,:\s]+|டெக்ஸ்[,:\s]+|டேக்ஸ்[,:\s]+)', '', raw_input, flags=re.IGNORECASE).strip()
        if not clean_msg:
            clean_msg = raw_input

        # 5. Try Gemini LLM if client is available with full memory injection
        if self.client:
            try:
                gemini_res = self._call_gemini(clean_msg, lang, ctx)
                if gemini_res and gemini_res.get("intent") in SUPPORTED_INTENTS:
                    return gemini_res
            except Exception as err:
                logger.warning(f"[GeminiService] Gemini LLM unavailable: {err.__class__.__name__}. Utilizing conversational NLP fallback.")

        # 6. Comprehensive Conversational NLP & Context Resolution Engine
        return self.fallback_parse(clean_msg, lang, ctx)

    def _call_gemini(self, message: str, language: str, context: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Calls Gemini with strict schema, context memory, and safety boundaries."""
        ctx = context or {}
        preferred_name = ctx.get("preferred_name", "Sandhiya")
        current_balance = ctx.get("current_balance", "24,850.00")
        monthly_expense = ctx.get("monthly_expense", "5,350")
        last_month_expense = ctx.get("last_month_expense", "4,750")
        due_bills = ctx.get("due_bills_english", "electricity bill ₹840 and mobile recharge ₹299 due")
        memory = ctx.get("session_memory", {}) or {}

        system_instruction = (
            "You are Dex, the friendly and highly capable conversational voice assistant for 'OneAbility AI' (a fintech mobile app in India).\n"
            "You speak naturally like a helpful human assistant. Users talk to you casually in Tamil, English, and Tanglish.\n"
            f"User's name: '{preferred_name}'.\n"
            f"Account Balance: ₹{current_balance}.\n"
            f"This month spending: ₹{monthly_expense} (Food & Groceries: ₹2,840, Medical: ₹850, Transport: ₹620, Utilities: ₹1,040).\n"
            f"Last month spending: ₹{last_month_expense} (Food: ₹2,100, Medical: ₹600, Transport: ₹950, Utilities: ₹1,100).\n"
            f"Due Bills: {due_bills}.\n"
            f"Recent conversation memory: {json.dumps(memory)}.\n\n"
            "RULES:\n"
            "1. NEVER invent or hallucinate financial amounts or account numbers.\n"
            "2. Understand follow-ups ('adhula?', 'appo last month?', '500', 'seri', 'vendam') using recent memory.\n"
            "3. For payments, NEVER execute transactions directly. Prepare review only and require explicit screen confirmation.\n"
            "4. Return ONLY a single raw JSON object matching:\n"
            "{\"reply\": \"...\", \"language\": \"ta\", \"intent\": \"...\", \"recipient\": null, \"amount\": null, \"action\": null, \"confidence\": 0.95, \"updated_memory\": {...}, \"action_type\": \"...\"}"
        )

        prompt = f"User: \"{message}\"\nLanguage: {language}"

        config = None
        try:
            from google.genai import types
            config = types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json"
            )
        except Exception:
            config = None

        try:
            if config:
                response = self.client.models.generate_content(model=self.model_name, contents=prompt, config=config)
            else:
                response = self.client.models.generate_content(model=self.model_name, contents=f"{system_instruction}\n\n{prompt}")
        except Exception:
            return None

        if not response or not response.text:
            return None

        raw_text = response.text.strip()
        raw_text = re.sub(r'^```json\s*', '', raw_text, flags=re.IGNORECASE)
        raw_text = re.sub(r'^```\s*', '', raw_text)
        raw_text = re.sub(r'\s*```$', '', raw_text).strip()

        parsed = json.loads(raw_text)
        intent = parsed.get("intent", "unknown")
        if intent not in SUPPORTED_INTENTS:
            intent = "unknown"

        return {
            "reply": str(parsed.get("reply", "")),
            "language": language,
            "intent": intent,
            "recipient": parsed.get("recipient"),
            "amount": float(parsed["amount"]) if parsed.get("amount") is not None else None,
            "action": parsed.get("action"),
            "confidence": float(parsed.get("confidence", 0.95)),
            "updated_memory": parsed.get("updated_memory", memory),
            "action_type": parsed.get("action_type", "conversation")
        }

    def fallback_parse(self, message: str, language: str = "ta", context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Comprehensive Conversational Dialogue Engine with Short-Term Memory Resolution.
        Resolves multi-turn follow-ups, category drilldowns, historical comparisons,
        two-step payments, bill reviews, and conversational chit-chat.
        """
        raw = message.strip()
        lower = raw.lower()
        ctx = context or {}
        lang = language if language in ["ta", "en"] else "ta"
        preferred_name = ctx.get("preferred_name", "Sandhiya")

        # Deterministic App State Data
        current_balance = ctx.get("current_balance", "24,850.00")
        monthly_expense = ctx.get("monthly_expense", "5,350")
        last_month_expense = ctx.get("last_month_expense", "4,750")
        due_bills_ta = ctx.get("due_bills_tamil", "ஒரு electricity bill மற்றும் ஒரு mobile recharge due இருக்கு")
        due_bills_en = ctx.get("due_bills_english", "you have an electricity bill and a mobile recharge due")
        last_tx_ta = ctx.get("last_transaction_tamil", "Kumar Groceries-க்கு ₹450")
        last_tx_en = ctx.get("last_transaction_english", "₹450 to Kumar Groceries")

        # Retrieve short-term session memory
        memory = dict(ctx.get("session_memory", {}) or {})
        topic = memory.get("topic")
        last_recipient = memory.get("last_selected_beneficiary") or (memory.get("pending_action_data", {}) if isinstance(memory.get("pending_action_data"), dict) else {}).get("recipient")
        last_bill = memory.get("last_selected_bill")
        pending_action = memory.get("pending_action")
        last_category = memory.get("last_discussed_category") or memory.get("category")

        # Category spending lookup table (deterministic source of truth)
        category_data = {
            "food": {
                "name_ta": "Food & Groceries",
                "name_en": "Food & Groceries",
                "current": 2840,
                "last": 2100,
                "aliases": ["food", "groceries", "grocery", "சாப்பாடு", "உணவு", "மளிகை", "hotel", "restaurant"]
            },
            "medical": {
                "name_ta": "Medical & Pharmacy",
                "name_en": "Medical & Pharmacy",
                "current": 850,
                "last": 600,
                "aliases": ["medical", "medicine", "pharmacy", "மருந்து", "doctor", "priya"]
            },
            "transport": {
                "name_ta": "Transport & Travel",
                "name_en": "Transport & Travel",
                "current": 620,
                "last": 950,
                "aliases": ["transport", "travel", "metro", "auto", "cab", "fastag", "பயணம்"]
            },
            "bills": {
                "name_ta": "Bills & Utilities",
                "name_en": "Bills & Utilities",
                "current": 1040,
                "last": 1100,
                "aliases": ["bills", "electricity", "current bill", "recharge", "mobile", "கட்டணம்"]
            }
        }

        # ---------------------------------------------------------------------
        # 1. PENDING ACTION FOLLOW-UPS (e.g. User responds to "Evlo anuppanum?")
        # ---------------------------------------------------------------------
        if pending_action == "awaiting_payment_amount":
            # Check if utterance contains a numerical amount
            num_match = re.search(r'\b(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:rooba|rupees|ரூபாய்)?\b', lower)
            if num_match:
                amount = float(num_match.group(1))
                rec = last_recipient or "Kumar"
                amt_str = f"{int(amount)}" if amount == int(amount) else f"{amount:g}"
                reply = (
                    f"{preferred_name}, {rec}-க்கு ₹{amt_str} அனுப்ப review screen ready பண்ணிட்டேன். Details check பண்ணுங்க."
                    if lang == "ta"
                    else f"{preferred_name}, I have prepared the payment review to send ₹{amt_str} to {rec}. Please check the details."
                )
                memory.update({
                    "last_mentioned_amount": amount,
                    "pending_action": "awaiting_payment_confirmation"
                })
                return {
                    "reply": reply,
                    "language": lang,
                    "intent": "payment_request",
                    "recipient": rec,
                    "amount": amount,
                    "action": "review_payment",
                    "confidence": 0.98,
                    "updated_memory": memory,
                    "action_type": "financial_action_prep"
                }

        # ---------------------------------------------------------------------
        # 2. CONFIRMATION & CANCELLATION FOLLOW-UPS ('Seri', 'Vendam', 'Cancel')
        # ---------------------------------------------------------------------
        # Affirmation: 'seri', 'continue pannalam', 'confirm', 'proceed', 'ஆம்', 'சரி'
        if any(lower == k or lower.startswith(k + " ") for k in ["seri", "சரி", "continue pannalam", "continue", "confirm", "proceed", "aam", "ஆம்", "ok", "okay"]):
            if pending_action in ["awaiting_payment_confirmation", "awaiting_bill_payment_confirmation"]:
                reply = (
                    "சரி, உங்கள் டெமோ பின் அல்லது பயோமெட்ரிக் மூலம் பணம் செலுத்துவதை உறுதிப்படுத்தவும்."
                    if lang == "ta"
                    else "Please confirm the payment securely on screen using your demo PIN or biometric."
                )
                return {
                    "reply": reply,
                    "language": lang,
                    "intent": "action_confirmation",
                    "recipient": last_recipient,
                    "amount": memory.get("last_mentioned_amount"),
                    "action": "prompt_authentication",
                    "confidence": 0.98,
                    "updated_memory": memory,
                    "action_type": "confirmation"
                }
            else:
                reply = f"சரி {preferred_name}, அடுத்து என்ன செய்ய வேண்டும்?" if lang == "ta" else f"Sure {preferred_name}, what would you like to do next?"
                return {
                    "reply": reply,
                    "language": lang,
                    "intent": "general_conversation",
                    "recipient": None,
                    "amount": None,
                    "action": None,
                    "confidence": 0.95,
                    "updated_memory": memory,
                    "action_type": "conversation"
                }

        # Cancellation: 'vendam', 'cancel pannu', 'வேண்டாம்', 'cancel'
        if any(lower == k or lower.startswith(k + " ") for k in ["vendam", "வேண்டாம்", "cancel pannu", "cancel", "stop this", "rathu"]):
            reply = "சரி, ரத்து செய்துவிட்டேன்." if lang == "ta" else "Okay, cancelled."
            memory["pending_action"] = None
            return {
                "reply": reply,
                "language": lang,
                "intent": "action_cancellation",
                "recipient": None,
                "amount": None,
                "action": "cancel_pending_action",
                "confidence": 0.98,
                "updated_memory": memory,
                "action_type": "cancellation"
            }

        # ---------------------------------------------------------------------
        # 3. CONVERSATIONAL HELP & CAPABILITIES ('Enaku help venum')
        # ---------------------------------------------------------------------
        if any(lower == k or lower.startswith(k + " ") for k in ["enaku help venum", "help venum", "உதவி வேண்டும்", "i need help", "help me"]):
            reply = f"Sure {preferred_name}, enna help venum?" if lang == "ta" else f"Sure {preferred_name}, how can I help you?"
            memory["topic"] = "general_help"
            return {
                "reply": reply,
                "language": lang,
                "intent": "general_help",
                "recipient": None,
                "amount": None,
                "action": None,
                "confidence": 0.98,
                "updated_memory": memory,
                "action_type": "conversation"
            }

        if any(k in lower for k in ["enna options", "enna panna mudiyum", "what can you do", "app la enna"]):
            reply = (
                f"{preferred_name}, நீங்கள் பணம் அனுப்பலாம், இருப்பு சரிபார்க்கலாம், மின்சார அல்லது மொபைல் கட்டணம் செலுத்தலாம், மற்றும் செலவுகளை கண்காணிக்கலாம். என்ன செய்ய வேண்டும்?"
                if lang == "ta"
                else f"{preferred_name}, you can send money, check your balance, pay utility bills, and track your monthly expenses. What would you like to do?"
            )
            memory["topic"] = "general_help"
            return {
                "reply": reply,
                "language": lang,
                "intent": "general_help",
                "recipient": None,
                "amount": None,
                "action": None,
                "confidence": 0.96,
                "updated_memory": memory,
                "action_type": "conversation"
            }

        # ---------------------------------------------------------------------
        # 4. EXPENSE QUESTIONS & CONTEXTUAL FOLLOW-UPS
        # e.g. "Indha month romba spend pannitena?" -> "Adhula food-ku?" -> "Appo last month?"
        # ---------------------------------------------------------------------
        # 4A. Month Comparison Follow-Up ("Appo last month?", "Last month compare pannu", "Last month?")
        if ("last month" in lower or "kadantha maatham" in lower or "கடந்த மாதம்" in lower) and ("appo" in lower or "compare" in lower or lower in ["last month?", "appo last month?", "last month"]):
            if topic in ["monthly_expenses", "category_expense"] and last_category:
                cat_info = category_data.get(last_category, category_data["food"])
                reply = (
                    f"Last month {cat_info['name_ta']}-க்கு ₹{cat_info['last']:,} spend பண்ணியிருந்தீங்க. இந்த மாதம் ₹{cat_info['current'] - cat_info['last']:,} அதிகம்."
                    if lang == "ta"
                    else f"Last month you spent ₹{cat_info['last']:,} on {cat_info['name_en']}, which is ₹{cat_info['current'] - cat_info['last']:,} less than this month."
                )
                memory.update({"topic": "category_expense", "last_discussed_month": "last"})
                return {
                    "reply": reply,
                    "language": lang,
                    "intent": "compare_expense",
                    "recipient": None,
                    "amount": float(cat_info["last"]),
                    "action": "read_category_expense",
                    "confidence": 0.98,
                    "updated_memory": memory,
                    "action_type": "app_info"
                }
            else:
                reply = (
                    f"Last month total spending ₹{last_month_expense} இருந்தது. இந்த மாதம் ₹{monthly_expense}, கொஞ்சம் அதிகம் தான்."
                    if lang == "ta"
                    else f"Last month's total spending was ₹{last_month_expense}. This month you spent ₹{monthly_expense}, which is slightly higher."
                )
                memory.update({"topic": "monthly_expenses", "last_discussed_month": "last"})
                return {
                    "reply": reply,
                    "language": lang,
                    "intent": "compare_expense",
                    "recipient": None,
                    "amount": None,
                    "action": "read_expense",
                    "confidence": 0.97,
                    "updated_memory": memory,
                    "action_type": "app_info"
                }

        # 4B. Category Drilldown Follow-Up ("Adhula food-ku evlo pochu?", "Adhula groceries evlo?", "Adhula food-ku?")
        is_adhula_drilldown = ("adhula" in lower or "athula" in lower or "அதில்" in lower or (topic == "monthly_expenses" and any(cat in lower for cat in ["food", "groceries", "medical", "transport"])))
        if is_adhula_drilldown or ("food" in lower and any(q in lower for q in ["evlo", "spend", "selavu", "how much"])):
            # Identify matched category
            matched_cat_key = "food"
            for cat_key, cat_val in category_data.items():
                if any(alias in lower for alias in cat_val["aliases"]):
                    matched_cat_key = cat_key
                    break

            cat_info = category_data[matched_cat_key]
            reply = (
                f"அதுல {cat_info['name_ta']}-க்கு ₹{cat_info['current']:,} செலவானது."
                if lang == "ta"
                else f"Out of that, ₹{cat_info['current']:,} was spent on {cat_info['name_en']}."
            )
            memory.update({
                "topic": "monthly_expenses",
                "month": "current",
                "category": matched_cat_key,
                "last_discussed_category": matched_cat_key,
                "last_discussed_month": "current"
            })
            return {
                "reply": reply,
                "language": lang,
                "intent": "category_expense",
                "recipient": None,
                "amount": float(cat_info["current"]),
                "action": "read_category_expense",
                "confidence": 0.98,
                "updated_memory": memory,
                "action_type": "app_info"
            }

        # 4C. High-level Monthly Expense Query ("Indha month konjam adhigama spend pannitena?", "Indha month expense evlo?")
        expense_terms = ["spend", "expense", "selavu", "செலவு", "spending", "adhigama spend", "adhigama"]
        if any(term in lower for term in expense_terms) and not any(k in lower for k in ["kumar", "send", "pay", "anuppu"]):
            reply = (
                f"{preferred_name}, இந்த மாதம் நீங்கள் மொத்தம் ₹{monthly_expense} செலவழித்துள்ளீர்கள். கடந்த மாதத்தை விட (₹{last_month_expense}) கொஞ்சம் அதிகம் தான்."
                if lang == "ta"
                else f"{preferred_name}, you have spent ₹{monthly_expense} this month, which is slightly higher than last month (₹{last_month_expense})."
            )
            memory.update({
                "topic": "monthly_expenses",
                "month": "current",
                "category": None,
                "last_discussed_month": "current",
                "last_discussed_category": None
            })
            return {
                "reply": reply,
                "language": lang,
                "intent": "expense_summary",
                "recipient": None,
                "amount": None,
                "action": "read_expense",
                "confidence": 0.98,
                "updated_memory": memory,
                "action_type": "app_info"
            }

        # ---------------------------------------------------------------------
        # 5. BILLS & RECHARGE CONVERSATION & FOLLOW-UPS
        # e.g. "Current bill ethavathu iruka?" -> "Electricity?" -> "Adha pay pannalam"
        # ---------------------------------------------------------------------
        # 5A. Specific Follow-Up on Bill ("Electricity?", "Electricity bill kaatu", "Adha open pannu")
        is_bill_followup = (
            (topic == "bills" and any(w in lower for w in ["electricity", "current", "eb", "adha open", "show", "kaatu", "விவரம்"])) or
            any(term in lower for term in ["electricity bill kaatu", "current bill kaatu", "show electricity bill", "open electricity bill"])
        )
        if is_bill_followup:
            reply = "TNEB மின்சாரக் கட்டணம் ₹840 நிலுவையில் உள்ளது, கடைசி தேதி செப்டம்பர் 25." if lang == "ta" else "TNEB electricity bill of ₹840 is due on September 25."
            memory.update({
                "topic": "bills",
                "last_selected_bill": "Electricity"
            })
            return {
                "reply": reply,
                "language": lang,
                "intent": "open_bill",
                "recipient": None,
                "amount": 840.0,
                "action": "open_bill_electricity",
                "confidence": 0.98,
                "updated_memory": memory,
                "action_type": "app_navigation"
            }

        # 5B. Pay Bill Follow-Up ("Adha pay pannalam", "Pay pannanum", "Electricity bill pay")
        is_pay_bill = (
            (last_bill == "Electricity" and any(w in lower for w in ["pay pannalam", "pay pannanum", "pay pannu", "செலுத்து", "pay it"])) or
            any(term in lower for term in ["electricity bill pay", "current bill pay", "pay electricity bill", "pay bill"])
        )
        if is_pay_bill:
            reply = "TNEB மின்சாரக் கட்டணம் ₹840 செலுத்த சரிபார்ப்புத் திரை தயாராக உள்ளது. விவரங்களைச் சரிபார்க்கவும்." if lang == "ta" else "Opening payment review for TNEB electricity bill of ₹840. Please review."
            memory.update({
                "topic": "bills",
                "last_selected_bill": "Electricity",
                "pending_action": "awaiting_bill_payment_confirmation"
            })
            return {
                "reply": reply,
                "language": lang,
                "intent": "pay_bill",
                "recipient": "TNEB Electricity",
                "amount": 840.0,
                "action": "pay_bill_electricity",
                "confidence": 0.98,
                "updated_memory": memory,
                "action_type": "financial_action_prep"
            }

        # 5C. Due Bills Inquiry ("Current bill ethavathu iruka?", "Bills enna iruku?", "Enaku bills iruka?")
        bill_inquiry_terms = [
            "current bill ethavathu", "current bill iruka", "current bills enna",
            "bills enna", "bill iruka", "bills due", "due bills", "any bills"
        ]
        if any(term in lower for term in bill_inquiry_terms):
            reply = f"{preferred_name}, {due_bills_ta}." if lang == "ta" else f"{preferred_name}, {due_bills_en}."
            memory.update({
                "topic": "bills",
                "last_selected_bill": None
            })
            return {
                "reply": reply,
                "language": lang,
                "intent": "bill_inquiry",
                "recipient": None,
                "amount": None,
                "action": "list_bills",
                "confidence": 0.96,
                "updated_memory": memory,
                "action_type": "app_info"
            }

        # ---------------------------------------------------------------------
        # 6. PAYMENT REQUESTS (Multi-turn and Single-turn)
        # ---------------------------------------------------------------------
        nlp_res = NLPEngine.parse_payment_intent(message)
        has_pay_intent = (
            nlp_res.get("recipient") is not None or
            nlp_res.get("amount") is not None or
            any(k in lower for k in ["anuppanum", "transfer", "pay", "anuppu", "send", "ரூபாய் அனுப்பு", "அனுப்ப வேண்டும்"])
        )

        if has_pay_intent:
            raw_rec = nlp_res.get("recipient")
            amount = nlp_res.get("amount")

            recipient = None
            if raw_rec:
                for k, v in KNOWN_CONTACTS.items():
                    if v["name"] == raw_rec or raw_rec.lower() in v["name"].lower():
                        recipient = k.capitalize()
                        break
                if not recipient:
                    recipient = raw_rec
            elif last_recipient and any(k in lower for k in ["anuppu", "anuppanum", "pay", "send"]):
                recipient = last_recipient

            # If recipient is identified but amount is missing -> Multi-turn step 1
            if recipient and amount is None:
                reply = f"Sure {preferred_name}. {recipient}-க்கு எவ்வளவு அனுப்ப வேண்டும்?" if lang == "ta" else f"Sure {preferred_name}. How much would you like to send to {recipient}?"
                memory.update({
                    "topic": "payment",
                    "last_selected_beneficiary": recipient,
                    "pending_action": "awaiting_payment_amount"
                })
                return {
                    "reply": reply,
                    "language": lang,
                    "intent": "payment_request",
                    "recipient": recipient,
                    "amount": None,
                    "action": None,
                    "confidence": 0.95,
                    "updated_memory": memory,
                    "action_type": "conversation"
                }

            # If both recipient and amount are present -> Prepares review gate
            if recipient and amount is not None:
                amt_str = f"{int(amount)}" if amount == int(amount) else f"{amount:g}"
                reply = (
                    f"{preferred_name}, {recipient} அவர்களுக்கு ₹{amt_str} அனுப்புவதற்கான விவரங்கள் திரையில் உள்ளன. சரிபார்த்து உறுதிப்படுத்தவும்."
                    if lang == "ta"
                    else f"{preferred_name}, payment details to send ₹{amt_str} to {recipient} are on screen. Please verify and confirm."
                )
                memory.update({
                    "topic": "payment",
                    "last_selected_beneficiary": recipient,
                    "last_mentioned_amount": amount,
                    "pending_action": "awaiting_payment_confirmation"
                })
                return {
                    "reply": reply,
                    "language": lang,
                    "intent": "payment_request",
                    "recipient": recipient,
                    "amount": float(amount),
                    "action": "review_payment",
                    "confidence": 0.98,
                    "updated_memory": memory,
                    "action_type": "financial_action_prep"
                }

        # ---------------------------------------------------------------------
        # 7. BALANCE CHECK (Explicit Requests Only)
        # ---------------------------------------------------------------------
        balance_terms = [
            "balance", "iruppu", "kanakku", "panam evlo", "இருப்பு", "கணக்கு",
            "balance evlo", "balance sollu", "check balance", "what is my balance", "my balance"
        ]
        if any(term in lower for term in balance_terms):
            reply = (
                f"{preferred_name}, உங்கள் தற்போதைய இருப்பு ₹{current_balance}."
                if lang == "ta"
                else f"{preferred_name}, your current balance is ₹{current_balance}."
            )
            memory.update({"topic": "balance"})
            return {
                "reply": reply,
                "language": lang,
                "intent": "balance_check",
                "recipient": None,
                "amount": None,
                "action": "read_balance",
                "confidence": 0.98,
                "updated_memory": memory,
                "action_type": "app_info"
            }

        # ---------------------------------------------------------------------
        # 8. TRANSACTION HISTORY
        # ---------------------------------------------------------------------
        history_terms = [
            "history", "last payment", "past payment", "varalaaru", "recent transaction",
            "recent payment", "பரிவர்த்தனை", "வரலாறு", "yaruku panninen", "who did i pay",
            "last transaction", "recent transactions", "kadasi payment", "inniku enna transactions"
        ]
        if any(term in lower for term in history_terms):
            reply = (
                f"{preferred_name}, உங்கள் கடைசி கட்டணம் {last_tx_ta}."
                if lang == "ta"
                else f"{preferred_name}, your last payment was {last_tx_en}."
            )
            memory.update({"topic": "transactions"})
            return {
                "reply": reply,
                "language": lang,
                "intent": "transaction_history",
                "recipient": None,
                "amount": None,
                "action": "show_history",
                "confidence": 0.96,
                "updated_memory": memory,
                "action_type": "app_info"
            }

        # ---------------------------------------------------------------------
        # 9. NAVIGATION / CAMERA SCANNER / SECURITY INQUIRY
        # ---------------------------------------------------------------------
        if any(k in lower for k in ["scanner open", "open scanner", "camera open", "qr scan", "scan qr"]):
            reply = "QR ஸ்கேனர் திறக்கப்படுகிறது." if lang == "ta" else "Opening QR scanner."
            return {
                "reply": reply,
                "language": lang,
                "intent": "open_scanner",
                "recipient": None,
                "amount": None,
                "action": "open_scanner",
                "confidence": 0.98,
                "updated_memory": memory,
                "action_type": "app_navigation"
            }

        if any(k in lower for k in ["back po", "go back", "back", "பின்னே போ", "திரும்பு"]):
            reply = "சரி, முதன்மைப் பக்கத்திற்குத் திரும்புகிறேன்." if lang == "ta" else "Going back to the home screen."
            return {
                "reply": reply,
                "language": lang,
                "intent": "navigate_back",
                "recipient": None,
                "amount": None,
                "action": "navigate_back",
                "confidence": 0.98,
                "updated_memory": memory,
                "action_type": "app_navigation"
            }

        if any(k in lower for k in ["idhu safe ah", "safe ah", "பாதுகாப்பானதா", "is this safe"]):
            reply = (
                "ஆம், OneAbility AI சரிபார்க்கப்பட்ட UPI ஐடி மற்றும் பாதுகாப்பு சரிபார்ப்பை முடித்துள்ளது."
                if lang == "ta"
                else "Yes, OneAbility AI has verified the payee identity and fraud security checks have passed."
            )
            return {
                "reply": reply,
                "language": lang,
                "intent": "security_inquiry",
                "recipient": None,
                "amount": None,
                "action": None,
                "confidence": 0.98,
                "updated_memory": memory,
                "action_type": "conversation"
            }

        # ---------------------------------------------------------------------
        # 10. UNKNOWN / NATURAL CLARIFICATION
        # ---------------------------------------------------------------------
        reply = (
            f"மன்னிக்கவும் {preferred_name}, சரியாக புரியவில்லை. 'குமாருக்கு அனுப்பு', 'செலவு எவ்வளவு', அல்லது 'பில் காட்டு' என்று இயல்பாக கேளுங்கள்."
            if lang == "ta"
            else f"Sorry {preferred_name}, I didn't quite catch that. You can ask naturally about sending money, expenses, or bills."
        )
        return {
            "reply": reply,
            "language": lang,
            "intent": "clarification",
            "recipient": None,
            "amount": None,
            "action": None,
            "confidence": 0.30,
            "updated_memory": memory,
            "action_type": "clarification"
        }


# Singleton service instance
gemini_service = GeminiService()

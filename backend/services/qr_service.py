import urllib.parse
from typing import Optional
from schemas.qr import QRParsedResponse

class QRService:

    @classmethod
    def parse_and_validate_qr(cls, qr_string: str) -> QRParsedResponse:
        """
        Parses and validates a scanned QR code payload according to standard UPI specifications:
        Format: upi://pay?pa=recipient@bank&pn=Recipient+Name&am=100.00&cu=INR&tn=Note
        Also supports direct UPI IDs (e.g. name@bank).
        Rejects unsupported formats (generic URLs, WiFi, random text).
        """
        raw = qr_string.strip()
        if not raw:
            return QRParsedResponse(
                is_valid_upi=False,
                error_message="QR code data is empty.",
                raw_qr=raw
            )

        # 1. Standard UPI URI scheme: upi://pay?...
        if raw.lower().startswith("upi://pay"):
            try:
                parsed = urllib.parse.urlparse(raw)
                params = urllib.parse.parse_qs(parsed.query)

                pa = params.get("pa", [None])[0]
                if not pa or "@" not in pa:
                    return QRParsedResponse(
                        is_valid_upi=False,
                        error_message="QR code is missing a valid UPI payee address (pa).",
                        raw_qr=raw
                    )

                pn = params.get("pn", [None])[0]
                # Default name resolution from VPA if name not provided
                if not pn:
                    pn = pa.split("@")[0].replace(".", " ").replace("_", " ").title()

                am_str = params.get("am", [None])[0]
                amount: Optional[float] = None
                formatted_amount: Optional[str] = None
                if am_str:
                    try:
                        amount = float(am_str)
                        if amount <= 0:
                            amount = None
                        else:
                            formatted_amount = f"₹{amount:,.2f}"
                    except ValueError:
                        amount = None

                cu = params.get("cu", ["INR"])[0]
                tn = params.get("tn", [None])[0]
                mc = params.get("mc", [None])[0]

                return QRParsedResponse(
                    is_valid_upi=True,
                    error_message=None,
                    upi_id=pa.strip(),
                    recipient_name=pn.strip(),
                    amount=amount,
                    formatted_amount=formatted_amount,
                    currency=cu.upper() if cu else "INR",
                    transaction_note=tn.strip() if tn else None,
                    merchant_code=mc.strip() if mc else None,
                    raw_qr=raw
                )
            except Exception as e:
                return QRParsedResponse(
                    is_valid_upi=False,
                    error_message=f"Failed to parse UPI QR code parameters: {str(e)}",
                    raw_qr=raw
                )

        # 2. Check for direct UPI ID string (e.g., store@okaxis)
        if "@" in raw and " " not in raw and not raw.startswith(("http://", "https://", "ftp://")):
            parts = raw.split("@")
            if len(parts) == 2 and parts[0] and parts[1]:
                derived_name = parts[0].replace(".", " ").replace("_", " ").title()
                return QRParsedResponse(
                    is_valid_upi=True,
                    error_message=None,
                    upi_id=raw,
                    recipient_name=derived_name,
                    amount=None,
                    formatted_amount=None,
                    currency="INR",
                    transaction_note=None,
                    merchant_code=None,
                    raw_qr=raw
                )

        # 3. Check for unsupported QR formats
        if raw.lower().startswith(("http://", "https://")):
            return QRParsedResponse(
                is_valid_upi=False,
                error_message="Unsupported QR: Scanned code is a generic website link, not a UPI payment QR.",
                raw_qr=raw
            )

        if raw.lower().startswith(("wifi:", "smsto:", "tel:", "mailto:", "bitcoin:")):
            scheme = raw.split(":")[0].upper()
            return QRParsedResponse(
                is_valid_upi=False,
                error_message=f"Unsupported QR: Scanned code is for {scheme}, not a UPI payment QR.",
                raw_qr=raw
            )

        # 4. Unknown / Malformed QR
        return QRParsedResponse(
            is_valid_upi=False,
            error_message="Invalid QR: The scanned QR code does not contain recognized UPI payment information.",
            raw_qr=raw
        )

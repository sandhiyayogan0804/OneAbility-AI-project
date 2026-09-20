# OneAbility AI ⚡
> **"One Platform. Every Ability. Independent Access."**

An AI-powered universal accessibility platform and interactive digital companion designed to make everyday smartphone applications and payment services (such as Google Pay, Paytm, Mobile Banking, and Public Digital Services) 100% accessible, safe, and independently usable for people with diverse disabilities.

---

## 🌟 The 7 Core Accessibility Features Implemented

### 1. 🗣️ Voice Payment (Tamil, English, Tanglish, Mixed Speech)
- Initiate payments naturally using everyday language without rigid keywords:
  - *"Kumar-ku 500 rooba anuppu"*
  - *"Send 250 rs to Priya"*
  - *"Pay 100 to Ravi"*
  - *"Kumar groceries-ku ainooru pay pannu"*
- The built-in NLP engine extracts the intended recipient, resolves their UPI details, and extracts the payment amount (supporting numeric digits and spoken numbers in Tamil & English like *ainooru*, *nooru*, *aayiram*, etc.).

---

### 2. 🔊 Comprehensive Audio Feedback (Bilingual Speech)
- Real-time spoken voice announcements for every interaction:
  - **Payee & Amount Readout:** Spoken confirmation before money leaves the account.
  - **QR Code Detection:** Announces recipient merchant identity immediately upon locking on a QR code.
  - **Payment Status:** Speaks transaction status, reference ID, and bank debit breakdown.
  - **Alerts & Warnings:** Clear auditory notification for high-value transactions or potential scams.
  - Synchronized visual captions in the bottom dock for hearing assistance.

---

### 3. 📳 Distinct Haptic Feedback (Custom Vibration Signatures)
- Customized tactile feedback via the Web Navigator Vibration API:
  - **Button Tap:** Subtle single pulse (`20ms`)
  - **Navigation Focus:** Light touch (`15ms`)
  - **QR Code Detected:** Affirmative double pulse (`[60ms, 40ms, 60ms]`)
  - **Confirmation Gate Prompt:** Attention triple pulse (`[40ms, 30ms, 40ms, 30ms, 70ms]`)
  - **Payment Success:** Rhythmic celebration vibration (`[50ms, 40ms, 100ms, 40ms, 220ms]`)
  - **Warning Alert:** Double warning buzz (`[80ms, 50ms, 80ms]`)
  - **Cancellation / Error:** Heavy abort buzz (`[120ms, 80ms, 150ms]`)

---

### 4. 📷 Voice-Guided QR Scanner
- Real-time spoken guidance when opening the scanner:
  - *"QR Scanner open aagirukku. Phone-ai steady-a pidichu QR code mela kaatunga."*
  - Audio positioning guidance and an on-screen "Voice Help" button.
  - Instant voice announcement upon detection: *"QR code detect aayiduchu! Recipient: Kumar Groceries, Verified UPI Merchant."*

---

### 5. ♿ Screen Reader Support (TalkBack & VoiceOver Friendly)
- Built to WCAG 2.1 AAA accessibility standards:
  - Meaningful `aria-label`, `aria-describedby`, and `role` attributes on all interactive buttons, icons, and status panels.
  - Dynamic `aria-live="assertive"` regions for real-time status and confirmation updates.
  - Accessible numeric PIN dots with `aria-checked` states.
  - Full keyboard accessibility (Tab, Shift+Tab, Enter, Space, and Arrow keys).

---

### 6. 🧭 Voice Navigation (Hands-Free Control)
- Navigate through the application hands-free using natural commands:
  - *"Home-ku po"* / *"Go Home"* -> Navigates to main dashboard.
  - *"Send Money open pannu"* / *"Pay Contacts"* -> Opens contacts list.
  - *"History kaatu"* / *"Recent transactions"* -> Opens past transaction history.
  - *"Back po"* / *"Pinnaadi po"* -> Returns to previous screen.
  - *"Scan QR"* / *"Camera open pannu"* -> Opens QR camera scanner.
  - *"Read Screen"* -> Spoken explanation of current screen elements.

---

### 7. 🛡️ Strict Voice-Guided Confirmation Gate (Zero Unconfirmed Payments)
- **Mandatory Safety Shield:** No payment is ever executed without explicit confirmation.
  1. The assistant speaks the recipient and amount clearly:
     *"Payment Confirmation: Neenga Kumar Groceries-ku ₹500 transfer panna poreenga. Confirm panna 'Aama' alladhu 'Confirm' nu sollunga. Vendam-na 'Vendam' alladhu 'Cancel' nu sollunga."*
  2. The app listens for the user's voice:
     - **Positive Confirmation ("Aama", "Yes", "Confirm", "Sari", "Ok"):** Proceeds to secure PIN screen.
     - **Negative Cancellation ("Vendam", "No", "Cancel", "Stop"):** Aborts immediately, plays cancellation audio & haptics, and returns safely to the Home screen.

---

## ⌨️ Accessibility Keyboard Shortcuts
| Shortcut | Action |
|---|---|
| `Alt + 1` | Switch to **Vision & Blind Mode** |
| `Alt + 2` | Switch to **Hearing & Deaf Mode** |
| `Alt + 3` | Switch to **Motor & Dwell Mode** |
| `Alt + 4` | Switch to **Cognitive & Simple Mode** |
| `Alt + 0` | Reset to **Standard Mode** |
| `Alt + V` | Toggle **Voice Microphone** |
| `Alt + R` | **Read Current Screen** out loud |

---

## 💻 How to Run & Test
The app is actively running on port 8085:
- Open **`http://localhost:8085`** in any modern web browser.
- Or open **`index.html`** directly in your browser.
- Tap the microphone button or click any sample voice command chip to test voice payments and voice confirmation!

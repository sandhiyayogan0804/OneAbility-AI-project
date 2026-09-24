# OneAbility AI 💳♿

An accessible, AI-powered digital payment and financial assistance platform designed to empower individuals with diverse physical, sensory, and cognitive abilities.

---

## 🌟 Key Features

- **Accessibility First**:
  - High Contrast, Dyslexia-friendly font support, Reduced Motion, Large Font toggles.
  - Screen reader optimized ARIA live regions and sound alerts.
- **AI Voice Assistant**:
  - Multi-intent natural language payment processing (Transfer, Balance check, History, Bill Pay).
  - Multilingual voice support (English, Tamil, Hindi, and more).
- **Payment & Security Protection**:
  - Smart fraud & unusual transaction detection.
  - Recipient verification and duplicate transaction warning.
  - Transaction limits & cooldown protection.
- **Smart QR & Bill Payments**:
  - QR code scanning & generator.
  - Utility and recurring bill payments with due reminders.
- **Comprehensive Dashboard & History**:
  - Real-time balances, recent transactions, quick actions, and filterable transaction history.

---

## 🏗️ Architecture

```
OneAbility AI (pay)/
├── backend/                  # FastAPI REST Backend
│   ├── config/               # Settings & Database connection
│   ├── models/               # SQLAlchemy ORM Models
│   ├── routes/               # API Endpoints (Auth, Payments, QR, Bills, Voice, etc.)
│   ├── schemas/              # Pydantic Schemas & Validators
│   ├── scripts/              # Database initialization & seed scripts
│   ├── security/             # JWT auth & password hashing
│   ├── services/             # Core business logic & AI rules engine
│   └── tests/                # Automated unit, integration, and E2E test suite
├── database/                 # Database schema definitions
│   └── schema.sql            # MySQL table DDL & seed data
└── frontend/                 # Vite + React + TypeScript Frontend
    ├── src/
    │   ├── components/       # Accessible UI Components
    │   ├── context/          # Auth & Accessibility Context providers
    │   ├── layouts/          # Navigation, Header & Bottom Bar layouts
    │   ├── pages/            # Home, Pay, Scan, Bills, History, Voice, Profile, Settings
    │   └── services/         # Axios API client
```

---

## 🚀 Getting Started

### 1. Prerequisites
- Python 3.10+
- Node.js 18+ & npm
- MySQL Server (running locally or remote)

### 2. Backend Setup

```bash
cd backend

# Create & activate virtual environment
python -m venv venv
# Windows:
.\venv\Scripts\activate
# macOS/Linux:
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your MySQL credentials and JWT secret

# Initialize Database Schema & Seeds
python scripts/init_db.py

# Run FastAPI Server
uvicorn main:app --reload --port 8000
```
Backend API docs available at: `http://localhost:8000/docs`

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start Vite Dev Server
npm run dev
```
Frontend application will be accessible at: `http://localhost:5173`

---

## 🧪 Running Tests

To run the backend test suite:
```bash
cd backend
python -m pytest tests/ -v
```

---

## 📄 License
This project is licensed under the MIT License.

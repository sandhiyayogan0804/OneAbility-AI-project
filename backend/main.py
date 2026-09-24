from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config.settings import settings
from routes import health, auth, dashboard, payments, transactions, qr, voice, accessibility, bills, notifications

app = FastAPI(
    title="OneAbility AI Backend",
    version="1.0.0",
    description="Accessible AI-assisted payments gateway API"
)

# CORS Configuration for React Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1):(517[0-9]|3000)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Router Registration
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(health.router, tags=["health"])  # Direct root access
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(payments.router, prefix="/api/payments", tags=["payments"])
app.include_router(transactions.router, prefix="/api/transactions", tags=["transactions"])
app.include_router(qr.router, prefix="/api/qr", tags=["qr"])
app.include_router(voice.router, prefix="/api/voice", tags=["voice"])
app.include_router(accessibility.router, prefix="/api/accessibility", tags=["accessibility"])
app.include_router(bills.router, prefix="/api/bills", tags=["bills"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])

@app.get("/")
def read_root():
    return {"message": "OneAbility AI API Gateway is running."}

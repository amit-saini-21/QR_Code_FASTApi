from fastapi import FastAPI
from routers import auth, dashboard, history, qr
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="QR Generator API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.auth_router)
app.include_router(qr.qr_router)
app.include_router(dashboard.dashboard_router)
app.include_router(history.history_router)

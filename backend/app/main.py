# backend/app/main.py
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from sqlalchemy.future import select

from backend.app.core.config import settings
from backend.app.core.database import engine, Base, async_session
from backend.app.models.models import User, Satellite, Configuration
from backend.app.core.security import get_password_hash
from backend.app.services.simulator import simulation_loop
from backend.app.api import auth, telemetry, alerts, system

async def seed_data_if_empty():
    async with async_session() as session:
        try:
            # Check users
            users_res = await session.execute(select(User).limit(1))
            if not users_res.scalars().first():
                # Add default users
                admin_user = User(
                    username="admin",
                    password_hash=get_password_hash("admin123"),
                    role="Administrator"
                )
                operator_user = User(
                    username="operator",
                    password_hash=get_password_hash("operator123"),
                    role="Operator"
                )
                viewer_user = User(
                    username="viewer",
                    password_hash=get_password_hash("viewer123"),
                    role="Viewer"
                )
                session.add_all([admin_user, operator_user, viewer_user])
                print("Seeded default users (admin/admin123, operator/operator123, viewer/viewer123)")

            # Check satellites
            sat_res = await session.execute(select(Satellite).limit(1))
            if not sat_res.scalars().first():
                sats = [
                    Satellite(id="SAT-001", name="Solvrex-Aero 1", type="LEO Telemetry", launch_date="2024-03-15", status="ACTIVE"),
                    Satellite(id="SAT-002", name="Solvrex-Aero 2", type="GEO Weather", launch_date="2024-11-20", status="ACTIVE"),
                    Satellite(id="SAT-003", name="Solvrex-Aero 3", type="MEO Navigation", launch_date="2025-06-01", status="ACTIVE")
                ]
                session.add_all(sats)
                print("Seeded satellites SAT-001, SAT-002, SAT-003")

            # Check configurations
            config_res = await session.execute(select(Configuration).limit(1))
            if not config_res.scalars().first():
                configs = [
                    Configuration(key="SIMULATION_INTERVAL_SEC", value="1", description="Interval in seconds between telemetry generations"),
                    Configuration(key="BATTERY_LOW_THRESHOLD", value="20.0", description="Percentage below which a critical battery alert is generated"),
                    Configuration(key="TEMP_HIGH_THRESHOLD", value="85.0", description="Celsius above which an emergency temperature alert is generated"),
                    Configuration(key="TEMP_LOW_THRESHOLD", value="-40.0", description="Celsius below which a warning temperature alert is generated"),
                    Configuration(key="CPU_HIGH_THRESHOLD", value="90.0", description="Percentage above which a critical CPU alert is generated"),
                    Configuration(key="SIGNAL_MIN_THRESHOLD", value="-110.0", description="dBm below which a critical signal loss alert is generated")
                ]
                session.add_all(configs)
                print("Seeded default configurations")

            await session.commit()
        except Exception as e:
            print(f"Error seeding database: {e}")
            await session.rollback()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create tables
    print("Initializing Database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Seed data
    await seed_data_if_empty()
    
    # Start background telemetry simulation task
    loop = asyncio.get_running_loop()
    sim_task = loop.create_task(simulation_loop())
    
    yield
    
    # Shutdown: Cancel background task
    sim_task.cancel()
    try:
        await sim_task
    except asyncio.CancelledError:
        print("Simulation loop background task cancelled.")
    await engine.dispose()
    print("Database engine disposed.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Ground station gateway routing live telemetry metrics, orbits, alerts, and commands.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prometheus instrumentator setup
Instrumentator().instrument(app).expose(app, tags=["Monitoring"])

# Include Routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(telemetry.router, prefix=settings.API_V1_STR)
app.include_router(alerts.router, prefix=settings.API_V1_STR)
app.include_router(system.router, prefix=settings.API_V1_STR)

@app.get("/")
def read_root():
    return {
        "project": settings.PROJECT_NAME,
        "version": "1.0.0",
        "status": "ONLINE",
        "api_documentation": f"/docs"
    }

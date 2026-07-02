# backend/app/api/system.py
from typing import List, Dict, Any
from datetime import datetime
import psutil
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import text

from backend.app.core.database import get_db
from backend.app.models.models import AuditLog, AuditLogResponse, SystemLog, SystemLogResponse, Configuration, ConfigResponse, User, AuditLog
from backend.app.api.auth import get_current_user, check_role
from backend.app.services import simulator

router = APIRouter(prefix="/system", tags=["System & Controls"])

@router.get("/health", response_model=Dict[str, Any])
async def get_system_health(db: AsyncSession = Depends(get_db)):
    db_status = "HEALTHY"
    try:
        await db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"UNHEALTHY: {str(e)}"
        
    return {
        "status": "HEALTHY" if "UNHEALTHY" not in db_status else "DEGRADED",
        "timestamp": datetime.utcnow().isoformat(),
        "database": db_status,
        "services": {
            "telemetry_simulator": "RUNNING" if simulator.simulation_active else "STOPPED"
        },
        "host_metrics": {
            "cpu_usage_percent": psutil.cpu_percent(interval=None),
            "memory_usage_percent": psutil.virtual_memory().percent,
            "disk_usage_percent": psutil.disk_usage('/').percent
        }
    }

@router.post("/simulation/control")
async def control_simulation(
    active: bool,
    current_user: User = Depends(check_role(["Administrator", "Operator"])),
    db: AsyncSession = Depends(get_db)
):
    simulator.simulation_active = active
    
    db.add(AuditLog(
        user_id=current_user.id,
        action="SIMULATION_CONTROL",
        target="SYSTEM",
        details=f"Simulation state set to active={active}."
    ))
    await db.commit()
    
    return {"message": f"Simulation set to {'active' if active else 'inactive'}"}

@router.post("/simulation/anomaly")
async def trigger_anomaly(
    satellite_id: str,
    anomaly_type: str,  # battery_drop, temp_spike, cpu_overload, signal_loss, system_failure, clear
    current_user: User = Depends(check_role(["Administrator", "Operator"])),
    db: AsyncSession = Depends(get_db)
):
    if satellite_id not in simulator.forced_anomalies:
        raise HTTPException(status_code=404, detail="Satellite not found")
        
    if anomaly_type == "clear":
        simulator.forced_anomalies[satellite_id] = []
        details_msg = f"Cleared all active anomalies on {satellite_id}."
    else:
        valid_anomalies = ["battery_drop", "temp_spike", "cpu_overload", "signal_loss", "system_failure"]
        if anomaly_type not in valid_anomalies:
            raise HTTPException(status_code=400, detail="Invalid anomaly type")
        if anomaly_type not in simulator.forced_anomalies[satellite_id]:
            simulator.forced_anomalies[satellite_id].append(anomaly_type)
        details_msg = f"Injected '{anomaly_type}' anomaly on {satellite_id}."
        
    db.add(AuditLog(
        user_id=current_user.id,
        action="INJECT_ANOMALY",
        target="SIMULATOR",
        details=details_msg
    ))
    await db.commit()
    
    return {
        "satellite_id": satellite_id,
        "active_anomalies": simulator.forced_anomalies[satellite_id],
        "message": details_msg
    }

@router.get("/logs/audit", response_model=List[AuditLogResponse])
async def get_audit_logs(
    current_user: User = Depends(check_role(["Administrator"])),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(200))
    return result.scalars().all()

@router.get("/logs/system", response_model=List[SystemLogResponse])
async def get_system_logs(
    current_user: User = Depends(check_role(["Administrator", "Operator"])),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(SystemLog).order_by(SystemLog.timestamp.desc()).limit(200))
    return result.scalars().all()

@router.get("/configs", response_model=List[ConfigResponse])
async def get_configurations(
    current_user: User = Depends(check_role(["Administrator", "Operator", "Viewer"])),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Configuration))
    return result.scalars().all()

@router.post("/configs")
async def update_configuration(
    key: str,
    value: str,
    current_user: User = Depends(check_role(["Administrator"])),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Configuration).where(Configuration.key == key))
    config = result.scalars().first()
    if not config:
        raise HTTPException(status_code=404, detail="Configuration key not found")
        
    old_value = config.value
    config.value = value
    
    db.add(AuditLog(
        user_id=current_user.id,
        action="UPDATE_CONFIG",
        target="CONFIGURATION",
        details=f"Updated config {key} from '{old_value}' to '{value}'."
    ))
    await db.commit()
    return {"message": "Configuration updated successfully", "key": key, "value": value}

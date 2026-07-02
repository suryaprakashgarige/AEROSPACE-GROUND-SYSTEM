# backend/app/api/alerts.py
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc

from backend.app.core.database import get_db
from backend.app.models.models import Alert, AlertResponse, User, AuditLog
from backend.app.api.auth import get_current_user, check_role

router = APIRouter(prefix="/alerts", tags=["Alerts"])

@router.get("/", response_model=List[AlertResponse])
async def get_alerts(
    resolved: Optional[bool] = None,
    satellite_id: Optional[str] = None,
    limit: int = Query(default=100, lte=1000),
    db: AsyncSession = Depends(get_db)
):
    query = select(Alert)
    if resolved is not None:
        query = query.where(Alert.resolved == resolved)
    if satellite_id:
        query = query.where(Alert.satellite_id == satellite_id)
    query = query.order_by(desc(Alert.timestamp)).limit(limit)
    
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/{alert_id}/resolve", response_model=AlertResponse)
async def resolve_alert(
    alert_id: int,
    current_user: User = Depends(check_role(["Administrator", "Operator"])),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalars().first()
    
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found"
        )
        
    if alert.resolved:
        return alert
        
    alert.resolved = True
    alert.resolved_at = datetime.now(timezone.utc)
    
    db.add(AuditLog(
        user_id=current_user.id,
        action="RESOLVE_ALERT",
        target="ALERTS",
        details=f"Alert #{alert.id} ({alert.metric_name} anomaly on {alert.satellite_id}) marked as resolved."
    ))
    
    await db.commit()
    await db.refresh(alert)
    return alert

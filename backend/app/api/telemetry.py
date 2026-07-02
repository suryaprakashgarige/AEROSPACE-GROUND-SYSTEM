# backend/app/api/telemetry.py
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc

from backend.app.core.database import get_db
from backend.app.models.models import Telemetry, TelemetryResponse, Satellite, SatelliteResponse
from backend.app.services.websocket import manager

router = APIRouter(prefix="/telemetry", tags=["Telemetry"])

@router.get("/", response_model=List[TelemetryResponse])
async def get_telemetry(
    satellite_id: Optional[str] = None,
    limit: int = Query(default=100, lte=1000),
    db: AsyncSession = Depends(get_db)
):
    query = select(Telemetry)
    if satellite_id:
        query = query.where(Telemetry.satellite_id == satellite_id)
    query = query.order_by(desc(Telemetry.timestamp)).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/latest", response_model=List[TelemetryResponse])
async def get_latest_telemetry(
    satellite_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    # Retrieve latest entry for all satellites or specified satellite
    subq = select(Satellite.id)
    if satellite_id:
        subq = subq.where(Satellite.id == satellite_id)
    sat_ids = (await db.execute(subq)).scalars().all()
    
    latest_packets = []
    for sat_id in sat_ids:
        query = select(Telemetry).where(Telemetry.satellite_id == sat_id).order_by(desc(Telemetry.timestamp)).limit(1)
        res = (await db.execute(query)).scalars().first()
        if res:
            latest_packets.append(res)
            
    return latest_packets

@router.get("/historical", response_model=List[TelemetryResponse])
async def get_historical_telemetry(
    satellite_id: str,
    start_time: datetime,
    end_time: datetime,
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(Telemetry)
        .where(Telemetry.satellite_id == satellite_id)
        .where(Telemetry.timestamp >= start_time)
        .where(Telemetry.timestamp <= end_time)
        .order_by(Telemetry.timestamp)
    )
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/satellites", response_model=List[SatelliteResponse])
async def get_satellites(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Satellite))
    return result.scalars().all()

# WebSocket Endpoint
@router.websocket("/ws")
async def websocket_telemetry_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # We can receive telemetry controls or keep-alive from frontend
            data = await websocket.receive_text()
            # Simple Echo or Ping Pong
            await websocket.send_json({"type": "pong", "message": f"Received: {data}"})
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# backend/app/models/models.py
from datetime import date, datetime
from typing import Optional, List
from sqlalchemy import Column, Integer, String, Date, Numeric, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from pydantic import BaseModel, ConfigDict
from backend.app.core.database import Base

# ==========================================
# SQLAlchemy Models
# ==========================================

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    audit_logs = relationship("AuditLog", back_populates="user")

class Satellite(Base):
    __tablename__ = "satellites"

    id = Column(String(50), primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    type = Column(String(50), nullable=False)
    launch_date = Column(Date, nullable=False)
    status = Column(String(20), default="ACTIVE")

    telemetries = relationship("Telemetry", back_populates="satellite", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="satellite", cascade="all, delete-orphan")

class Telemetry(Base):
    __tablename__ = "telemetry"

    id = Column(Integer, primary_key=True, index=True)
    satellite_id = Column(String(50), ForeignKey("satellites.id", ondelete="CASCADE"), nullable=False)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    orbit_number = Column(Integer, nullable=False)
    temperature = Column(Numeric(6, 2), nullable=False)
    battery_level = Column(Numeric(5, 2), nullable=False)
    solar_panel_voltage = Column(Numeric(5, 2), nullable=False)
    power_consumption = Column(Numeric(6, 2), nullable=False)
    cpu_usage = Column(Numeric(5, 2), nullable=False)
    memory_usage = Column(Numeric(5, 2), nullable=False)
    signal_strength = Column(Numeric(5, 2), nullable=False)
    altitude = Column(Numeric(10, 2), nullable=False)
    velocity = Column(Numeric(6, 3), nullable=False)
    latitude = Column(Numeric(9, 6), nullable=False)
    longitude = Column(Numeric(9, 6), nullable=False)
    roll = Column(Numeric(6, 3), nullable=False)
    pitch = Column(Numeric(6, 3), nullable=False)
    yaw = Column(Numeric(6, 3), nullable=False)
    fuel_remaining = Column(Numeric(5, 2), nullable=False)
    radiation_level = Column(Numeric(6, 2), nullable=False)
    communication_status = Column(String(20), nullable=False)
    gps_lock = Column(Boolean, nullable=False)
    health_status = Column(String(20), nullable=False)
    error_code = Column(Integer, nullable=False)
    packet_loss = Column(Numeric(5, 2), nullable=False)
    uplink_delay = Column(Integer, nullable=False)
    downlink_delay = Column(Integer, nullable=False)

    satellite = relationship("Satellite", back_populates="telemetries")

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    satellite_id = Column(String(50), ForeignKey("satellites.id", ondelete="CASCADE"), nullable=False)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    metric_name = Column(String(50), nullable=False)
    metric_value = Column(Numeric(10, 2), nullable=False)
    threshold_value = Column(Numeric(10, 2), nullable=False)
    severity = Column(String(20), nullable=False)  # Info, Warning, Critical, Emergency
    message = Column(Text, nullable=False)
    resolved = Column(Boolean, default=False, index=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    satellite = relationship("Satellite", back_populates="alerts")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(100), nullable=False)
    target = Column(String(100), nullable=False)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", back_populates="audit_logs")

class SystemLog(Base):
    __tablename__ = "system_logs"

    id = Column(Integer, primary_key=True, index=True)
    service_name = Column(String(50), nullable=False)
    log_level = Column(String(10), nullable=False)
    message = Column(Text, nullable=False)
    timestamp = Column(DateTime(timezone=True), default=datetime.utcnow)

class Configuration(Base):
    __tablename__ = "configurations"

    key = Column(String(50), primary_key=True)
    value = Column(Text, nullable=False)
    description = Column(Text, nullable=True)


# ==========================================
# Pydantic Schemas
# ==========================================

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None

class UserBase(BaseModel):
    username: str
    role: str

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class SatelliteBase(BaseModel):
    id: str
    name: str
    type: str
    launch_date: date
    status: str

class SatelliteResponse(SatelliteBase):
    model_config = ConfigDict(from_attributes=True)

class TelemetryBase(BaseModel):
    satellite_id: str
    timestamp: datetime
    orbit_number: int
    temperature: float
    battery_level: float
    solar_panel_voltage: float
    power_consumption: float
    cpu_usage: float
    memory_usage: float
    signal_strength: float
    altitude: float
    velocity: float
    latitude: float
    longitude: float
    roll: float
    pitch: float
    yaw: float
    fuel_remaining: float
    radiation_level: float
    communication_status: str
    gps_lock: bool
    health_status: str
    error_code: int
    packet_loss: float
    uplink_delay: int
    downlink_delay: int

class TelemetryResponse(TelemetryBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class AlertBase(BaseModel):
    satellite_id: str
    timestamp: datetime
    metric_name: str
    metric_value: float
    threshold_value: float
    severity: str
    message: str
    resolved: bool = False
    resolved_at: Optional[datetime] = None

class AlertResponse(AlertBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int]
    action: str
    target: str
    details: Optional[str]
    timestamp: datetime
    model_config = ConfigDict(from_attributes=True)

class SystemLogResponse(BaseModel):
    id: int
    service_name: str
    log_level: str
    message: str
    timestamp: datetime
    model_config = ConfigDict(from_attributes=True)

class ConfigBase(BaseModel):
    key: str
    value: str
    description: Optional[str] = None

class ConfigResponse(ConfigBase):
    model_config = ConfigDict(from_attributes=True)

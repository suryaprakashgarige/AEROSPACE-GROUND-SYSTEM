# backend/app/services/simulator.py
import asyncio
import random
import math
from datetime import datetime, timezone
from sqlalchemy.future import select
from backend.app.core.database import async_session
from backend.app.models.models import Satellite, Telemetry, Alert, SystemLog
from backend.app.services.websocket import manager

# Simulated state variables for ground track calculation
# Using orbital mechanics approximations to make it look premium
satellite_states = {
    "SAT-001": {"angle": 0.0, "orbit": 125, "altitude": 420.0, "velocity": 7.66},
    "SAT-002": {"angle": 0.5, "orbit": 12, "altitude": 35786.0, "velocity": 3.07},
    "SAT-003": {"angle": 1.2, "orbit": 45, "altitude": 20200.0, "velocity": 3.87}
}

# In-memory simulator control flags (can be updated via API)
simulation_active = True
forced_anomalies = {
    "SAT-001": [],
    "SAT-002": [],
    "SAT-003": []
}

async def generate_telemetry_packet(satellite_id: str, timestamp: datetime) -> Telemetry:
    state = satellite_states.get(satellite_id)
    if not state:
        state = {"angle": 0.0, "orbit": 1, "altitude": 500.0, "velocity": 7.5}
        satellite_states[satellite_id] = state

    # Advance orbit position angle
    # LEO orbits faster, GEO slow, MEO medium
    if satellite_id == "SAT-001":
        step = 0.02
        base_battery = 85.0
        base_temp = 25.0
    elif satellite_id == "SAT-002":
        step = 0.002
        base_battery = 95.0
        base_temp = 32.0
    else:
        step = 0.008
        base_battery = 78.0
        base_temp = 18.0

    state["angle"] += step
    if state["angle"] >= 2 * math.pi:
        state["angle"] -= 2 * math.pi
        state["orbit"] += 1

    # Coordinates using ground track sinusoidal estimation
    lat = 60.0 * math.sin(state["angle"])
    lon = 180.0 * math.cos(state["angle"] * 0.5)

    # Battery fluctuations (solar charging vs usage)
    in_shadow = math.sin(state["angle"]) < -0.3
    solar_voltage = 0.0 if in_shadow else round(28.0 + random.uniform(-1.0, 1.0), 2)
    
    # Power consumption
    power_cons = round(120.0 + random.uniform(-10.0, 10.0), 2) if in_shadow else round(85.0 + random.uniform(-5.0, 5.0), 2)
    
    # Battery decay/charge
    if in_shadow:
        battery = max(0.0, base_battery - 10.0 + math.sin(state["angle"] * 10) * 5.0)
    else:
        battery = min(100.0, base_battery + 10.0 + math.cos(state["angle"] * 10) * 3.0)

    # System core parameters
    temp = base_temp + random.uniform(-5.0, 5.0)
    cpu = round(20.0 + random.uniform(0.0, 15.0), 2)
    mem = round(35.0 + random.uniform(0.0, 5.0), 2)
    signal = round(-65.0 + random.uniform(-15.0, 5.0), 2)
    fuel = max(0.0, round(95.0 - (state["orbit"] * 0.01), 2))
    radiation = round(15.0 + random.uniform(0.0, 5.0) + (10.0 * max(0.0, math.sin(state["angle"] * 2))), 2)
    
    # Dynamics (attitude control)
    roll = round(math.sin(timestamp.timestamp() * 0.1) * 2.0, 3)
    pitch = round(math.cos(timestamp.timestamp() * 0.1) * 1.5, 3)
    yaw = round(math.sin(timestamp.timestamp() * 0.05) * 5.0, 3)

    gps_lock = True
    comm_status = "CONNECTED"
    error_code = 0
    packet_loss = round(random.uniform(0.0, 0.5), 2)
    uplink = random.randint(120, 150)
    downlink = random.randint(110, 140)

    # Apply forced anomalies or random glitches
    anomalies_list = forced_anomalies[satellite_id]
    
    # 1. Battery Drop Anomaly
    if "battery_drop" in anomalies_list or (random.random() < 0.005):
        battery = round(random.uniform(5.0, 15.0), 2)
        solar_voltage = 0.0
        power_cons = 150.0

    # 2. Temp Spike Anomaly
    if "temp_spike" in anomalies_list or (random.random() < 0.005):
        temp = round(random.uniform(90.0, 110.0), 2)

    # 3. CPU Overload Anomaly
    if "cpu_overload" in anomalies_list or (random.random() < 0.005):
        cpu = round(random.uniform(92.0, 99.9), 2)
        mem = round(random.uniform(85.0, 95.0), 2)

    # 4. Signal Loss Anomaly
    if "signal_loss" in anomalies_list or (random.random() < 0.005):
        signal = round(random.uniform(-120.0, -112.0), 2)
        comm_status = "DEGRADED"
        packet_loss = round(random.uniform(15.0, 45.0), 2)
        uplink = random.randint(500, 2000)
        downlink = random.randint(500, 2000)

    # 5. Critical System Anomaly (Emergency)
    if "system_failure" in anomalies_list:
        comm_status = "DISCONNECTED"
        gps_lock = False
        error_code = 505
        packet_loss = 100.0
        uplink = 0
        downlink = 0
        signal = -130.0

    # Final overall health status check
    health_status = "HEALTHY"
    if battery < 20.0 or temp > 85.0 or temp < -40.0 or cpu > 90.0 or signal < -110.0 or comm_status == "DEGRADED":
        health_status = "WARNING"
    if battery < 10.0 or temp > 100.0 or comm_status == "DISCONNECTED" or error_code != 0:
        health_status = "CRITICAL"

    return Telemetry(
        satellite_id=satellite_id,
        timestamp=timestamp,
        orbit_number=state["orbit"],
        temperature=round(temp, 2),
        battery_level=round(battery, 2),
        solar_panel_voltage=round(solar_voltage, 2),
        power_consumption=round(power_cons, 2),
        cpu_usage=round(cpu, 2),
        memory_usage=round(mem, 2),
        signal_strength=round(signal, 2),
        altitude=round(state["altitude"] + random.uniform(-1.0, 1.0), 2),
        velocity=round(state["velocity"] + random.uniform(-0.01, 0.01), 3),
        latitude=round(lat, 6),
        longitude=round(lon, 6),
        roll=roll,
        pitch=pitch,
        yaw=yaw,
        fuel_remaining=fuel,
        radiation_level=radiation,
        communication_status=comm_status,
        gps_lock=gps_lock,
        health_status=health_status,
        error_code=error_code,
        packet_loss=packet_loss,
        uplink_delay=uplink,
        downlink_delay=downlink
    )

async def check_telemetry_thresholds(telemetry: Telemetry, session) -> list:
    alerts = []
    
    # Battery Check
    if float(telemetry.battery_level) < 20.0:
        severity = "Critical" if float(telemetry.battery_level) < 10.0 else "Warning"
        alerts.append(Alert(
            satellite_id=telemetry.satellite_id,
            timestamp=telemetry.timestamp,
            metric_name="Battery Level",
            metric_value=float(telemetry.battery_level),
            threshold_value=20.0,
            severity=severity,
            message=f"Battery level is low: {telemetry.battery_level}%"
        ))

    # Temperature Check
    if float(telemetry.temperature) > 85.0:
        alerts.append(Alert(
            satellite_id=telemetry.satellite_id,
            timestamp=telemetry.timestamp,
            metric_name="Temperature",
            metric_value=float(telemetry.temperature),
            threshold_value=85.0,
            severity="Emergency",
            message=f"Thermal threshold exceeded: {telemetry.temperature}°C"
        ))
    elif float(telemetry.temperature) < -40.0:
        alerts.append(Alert(
            satellite_id=telemetry.satellite_id,
            timestamp=telemetry.timestamp,
            metric_name="Temperature",
            metric_value=float(telemetry.temperature),
            threshold_value=-40.0,
            severity="Warning",
            message=f"Thermal levels too low: {telemetry.temperature}°C"
        ))

    # CPU Check
    if float(telemetry.cpu_usage) > 90.0:
        alerts.append(Alert(
            satellite_id=telemetry.satellite_id,
            timestamp=telemetry.timestamp,
            metric_name="CPU Usage",
            metric_value=float(telemetry.cpu_usage),
            threshold_value=90.0,
            severity="Critical",
            message=f"CPU usage overload: {telemetry.cpu_usage}%"
        ))

    # Signal Check
    if float(telemetry.signal_strength) < -110.0:
        severity = "Emergency" if telemetry.communication_status == "DISCONNECTED" else "Critical"
        alerts.append(Alert(
            satellite_id=telemetry.satellite_id,
            timestamp=telemetry.timestamp,
            metric_name="Signal Strength",
            metric_value=float(telemetry.signal_strength),
            threshold_value=-110.0,
            severity=severity,
            message=f"Signal strength dropped to critical: {telemetry.signal_strength} dBm"
        ))

    for alert in alerts:
        session.add(alert)
    return alerts

async def simulation_loop():
    print("Simulation background loop started.")
    global simulation_active
    while True:
        if not simulation_active:
            await asyncio.sleep(1)
            continue
            
        async with async_session() as session:
            try:
                # Fetch active satellites
                result = await session.execute(select(Satellite).where(Satellite.status == "ACTIVE"))
                satellites = result.scalars().all()
                
                timestamp = datetime.now(timezone.utc)
                
                for satellite in satellites:
                    # Generate Telemetry packet
                    telemetry = await generate_telemetry_packet(satellite.id, timestamp)
                    session.add(telemetry)
                    
                    # Check Alerts
                    triggered_alerts = await check_telemetry_thresholds(telemetry, session)
                    
                    # Log event if alerts triggered
                    if triggered_alerts:
                        log_msg = f"Alerts triggered for {satellite.id}: " + ", ".join([a.message for a in triggered_alerts])
                        session.add(SystemLog(
                            service_name="TelemetrySimulator",
                            log_level="WARNING",
                            message=log_msg,
                            timestamp=timestamp
                        ))
                    
                    # Commit to DB
                    await session.commit()
                    
                    # Convert to JSON serializable dict
                    telemetry_dict = {
                        "id": telemetry.id,
                        "satellite_id": telemetry.satellite_id,
                        "timestamp": telemetry.timestamp.isoformat(),
                        "orbit_number": telemetry.orbit_number,
                        "temperature": float(telemetry.temperature),
                        "battery_level": float(telemetry.battery_level),
                        "solar_panel_voltage": float(telemetry.solar_panel_voltage),
                        "power_consumption": float(telemetry.power_consumption),
                        "cpu_usage": float(telemetry.cpu_usage),
                        "memory_usage": float(telemetry.memory_usage),
                        "signal_strength": float(telemetry.signal_strength),
                        "altitude": float(telemetry.altitude),
                        "velocity": float(telemetry.velocity),
                        "latitude": float(telemetry.latitude),
                        "longitude": float(telemetry.longitude),
                        "roll": float(telemetry.roll),
                        "pitch": float(telemetry.pitch),
                        "yaw": float(telemetry.yaw),
                        "fuel_remaining": float(telemetry.fuel_remaining),
                        "radiation_level": float(telemetry.radiation_level),
                        "communication_status": telemetry.communication_status,
                        "gps_lock": telemetry.gps_lock,
                        "health_status": telemetry.health_status,
                        "error_code": telemetry.error_code,
                        "packet_loss": float(telemetry.packet_loss),
                        "uplink_delay": telemetry.uplink_delay,
                        "downlink_delay": telemetry.downlink_delay
                    }
                    
                    alerts_dicts = [{
                        "id": a.id,
                        "satellite_id": a.satellite_id,
                        "timestamp": a.timestamp.isoformat(),
                        "metric_name": a.metric_name,
                        "metric_value": float(a.metric_value),
                        "threshold_value": float(a.threshold_value),
                        "severity": a.severity,
                        "message": a.message,
                        "resolved": a.resolved
                    } for a in triggered_alerts]
                    
                    # Broadcast telemetry packet and alerts
                    await manager.broadcast({
                        "type": "telemetry",
                        "data": telemetry_dict,
                        "alerts": alerts_dicts
                    })
                    
            except Exception as e:
                print(f"Error in simulation loop: {e}")
                # Add system log of error
                try:
                    session.add(SystemLog(
                        service_name="TelemetrySimulator",
                        log_level="ERROR",
                        message=f"Simulation loop error: {str(e)}",
                        timestamp=datetime.utcnow()
                    ))
                    await session.commit()
                except Exception:
                    pass
                    
        await asyncio.sleep(1)

# scripts/inject_anomaly.py
import sys
import http.client
import urllib.parse
import json

def get_auth_token():
    conn = http.client.HTTPConnection("localhost:8000")
    payload = urllib.parse.urlencode({
        "username": "operator",
        "password": "operator123"
    })
    headers = {
        'Content-Type': 'application/x-www-form-urlencoded'
    }
    conn.request("POST", "/api/v1/auth/token", payload, headers)
    res = conn.getresponse()
    data = res.read()
    if res.status != 200:
        print("Authentication failed. Ensure backend server is running on localhost:8000")
        sys.exit(1)
    return json.loads(data.decode("utf-8"))["access_token"]

def inject_anomaly(token, satellite_id, anomaly_type):
    conn = http.client.HTTPConnection("localhost:8000")
    headers = {
        'Authorization': f'Bearer {token}'
    }
    path = f"/api/v1/system/simulation/anomaly?satellite_id={satellite_id}&anomaly_type={anomaly_type}"
    conn.request("POST", path, "", headers)
    res = conn.getresponse()
    data = res.read()
    print(json.loads(data.decode("utf-8"))["message"])

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python inject_anomaly.py <satellite_id> <anomaly_type>")
        print("Example: python inject_anomaly.py SAT-001 temp_spike")
        print("Valid anomalies: battery_drop, temp_spike, cpu_overload, signal_loss, system_failure, clear")
        sys.exit(1)
        
    sat_id = sys.argv[1]
    anom_type = sys.argv[2]
    
    print(f"Connecting to Gateway and authenticating as Operator...")
    token = get_auth_token()
    print(f"Triggering anomaly injection request...")
    inject_anomaly(token, sat_id, anom_type)

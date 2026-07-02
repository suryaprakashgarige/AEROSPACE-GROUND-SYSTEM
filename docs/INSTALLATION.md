# Ground Station Telemetry System Installation & Setup Guide

This guide walks you through setting up and running the **Satellite Telemetry Monitoring and Alert System (STMAS)** in both development and production environments.

---

## 🚀 Local Quickstart (Docker Compose)

The easiest way to run the entire system (Database, Backend, Frontend, Prometheus, Grafana, ELK Stack) is using Docker Compose.

### Prerequisites
- Docker (v20.10+)
- Docker Compose (v2.0+)

### Commands
1. Clone the repository and navigate to the `docker/` directory:
   ```bash
   cd docker
   ```
2. Build and start the containers:
   ```bash
   docker-compose up --build
   ```
3. Access the endpoints:
   - **Frontend Dashboard**: [http://localhost](http://localhost) (Credentials: `admin` / `admin123`)
   - **FastAPI API Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)
   - **Prometheus UI**: [http://localhost:9090](http://localhost:9090)
   - **Grafana Console**: [http://localhost:3001](http://localhost:3001) (Credentials: `admin` / `admin`)
   - **Kibana Interface**: [http://localhost:5601](http://localhost:5601)

---

## 🛠️ Local Development Setup

If you wish to run the backend and frontend services outside containers for active development:

### Backend (FastAPI) Setup
1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: .\venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the PostgreSQL instance locally (or run via docker-compose), then set the env variables and run:
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

### Frontend (React + Vite) Setup
1. Navigate to the `frontend/` directory:
   ```bash
   cd frontend
   ```
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to [http://localhost:3000](http://localhost:3000).

---

## ☸️ Kubernetes Deployment (Minikube / EKS)

To deploy the application to a Kubernetes cluster:

1. Create the namespace:
   ```bash
   kubectl apply -f kubernetes/namespace.yaml
   ```
2. Deploy credentials and configurations:
   ```bash
   kubectl apply -f kubernetes/secrets.yaml
   kubectl apply -f kubernetes/configmap.yaml
   ```
3. Provision the PostgreSQL database:
   ```bash
   kubectl apply -f kubernetes/postgres-deployment.yaml
   ```
4. Deploy the application services and ingress:
   ```bash
   kubectl apply -f kubernetes/backend-deployment.yaml
   kubectl apply -f kubernetes/frontend-deployment.yaml
   kubectl apply -f kubernetes/hpa.yaml
   kubectl apply -f kubernetes/ingress.yaml
   kubectl apply -f kubernetes/rbac.yaml
   ```
5. Check pod status:
   ```bash
   kubectl get pods -n aerospace-monitoring
   ```

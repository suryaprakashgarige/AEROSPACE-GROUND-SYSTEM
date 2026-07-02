# Satellite Telemetry Monitoring and Alert System (STMAS)

An enterprise-grade, full-stack DevOps portfolio project simulating a real-world aerospace ground station. STMAS continuously receives satellite telemetry, stores metrics securely, generates rule-based alerts on anomalies, visualizes telemetry graphs in real-time, and is fully automated via Docker, Kubernetes, Terraform, and GitHub Actions.

---

## 🛠️ Technology Stack

- **Backend**: Python 3.11, FastAPI, Asyncio, SQLAlchemy, Uvicorn, WebSockets.
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Recharts, Lucide React.
- **Database**: PostgreSQL (relational storage for users, satellites, telemetry, and alerts).
- **Containerization**: Docker, Docker Compose.
- **Orchestration**: Kubernetes (Deployments, Services, PV/PVC, ConfigMaps, Secrets, Ingress, HPA, RBAC).
- **Infrastructure as Code**: Terraform (AWS VPC, RDS PostgreSQL, EKS Cluster).
- **Observability**: Prometheus (metrics scraping), Grafana (dashboards).
- **Log Management**: ELK Stack (Elasticsearch, Logstash, Kibana).
- **CI/CD**: GitHub Actions (linting, pytest, Trivy security scanning, Docker Hub publishing, EKS deploy).

---

## 📁 Repository Structure

```
├── backend/            # FastAPI REST & WebSocket server
│   ├── app/            # Source code (API, Core config, DB, Models, Simulator)
│   └── tests/          # Pytest unit & integration test suites
├── frontend/           # React + TS + Tailwind SPA dashboard
│   └── src/            # Components, pages, and hooks
├── database/           # DB schema scripts & ER diagrams
├── docker/             # Docker Compose local environment
├── kubernetes/         # Declarative YAML manifests
├── terraform/          # Infrastructure as Code modules (VPC, EKS, RDS)
├── monitoring/         # Prometheus scrape configurations
├── elk/                # Logstash pipelines & ingestion definitions
├── docs/               # System setup, architecture, & interview prep
└── README.md
```

---

## 🚀 Quick Start (Docker Compose)

Prerequisites: Install [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/).

1. Navigate to the `docker` directory:
   ```bash
   cd docker
   ```
2. Spin up the entire environment:
   ```bash
   docker-compose up --build
   ```
3. Access services:
   - **Dashboard**: [http://localhost](http://localhost) (Credentials: `admin` / `admin123`)
   - **FastAPI Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
   - **Prometheus**: [http://localhost:9090](http://localhost:9090)
   - **Grafana**: [http://localhost:3001](http://localhost:3001) (Credentials: `admin` / `admin`)
   - **Kibana**: [http://localhost:5601](http://localhost:5601)

---

## 📖 Detailed Guides

- **Setup Guide**: Check [docs/INSTALLATION.md](docs/INSTALLATION.md) for local manual run, Python virtual env, Node setup, and Kubernetes commands.
- **System Architecture**: Check [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for data flow details, security structures, and Mermaid sequences.
- **Interview Preparation**: Check [docs/INTERVIEW_PREP.md](docs/INTERVIEW_PREP.md) for 50 detailed DevOps, Kubernetes, Terraform, and Python Q&As.
- **Resume & LinkedIn Profile Builder**: Check [docs/PORTFOLIO_RESUME.md](docs/PORTFOLIO_RESUME.md) for ATS-optimized descriptions.

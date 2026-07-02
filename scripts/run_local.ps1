# scripts/run_local.ps1
Write-Host "Checking Docker Service status..." -ForegroundColor Green
$dockerStatus = docker info 2>&1
if ($lastExitCode -ne 0) {
    Write-Error "Docker Desktop is not running. Please start Docker and try again."
    Exit 1
}

Write-Host "Navigating to docker orchestration files..." -ForegroundColor Green
cd "$PSScriptRoot/../docker"

Write-Host "Launching Ground Station microservices stack via Docker Compose..." -ForegroundColor Green
docker-compose up --build -d

Write-Host "--------------------------------------------------------" -ForegroundColor Green
Write-Host "Solvrex Ground Station Platform successfully launched!" -ForegroundColor Green
Write-Host "Dashboard: http://localhost:80" -ForegroundColor Cyan
Write-Host "FastAPI Gateway: http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host "Prometheus: http://localhost:9090" -ForegroundColor Cyan
Write-Host "Grafana Dashboard: http://localhost:3001" -ForegroundColor Cyan
Write-Host "Kibana logs viewer: http://localhost:5601" -ForegroundColor Cyan
Write-Host "--------------------------------------------------------" -ForegroundColor Green

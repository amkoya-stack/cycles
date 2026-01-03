# Setup Monitoring for Investment Module
# This script helps set up monitoring infrastructure

param(
    [switch]$SkipPrometheus,
    [switch]$SkipGrafana,
    [switch]$SkipAlerts
)

Write-Host "`n=== Investment Module Monitoring Setup ===" -ForegroundColor Cyan
Write-Host ""

# Check prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Yellow

# Check if Docker is available
$dockerAvailable = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerAvailable) {
    Write-Host "⚠️  Docker not found. Some monitoring tools require Docker." -ForegroundColor Yellow
    Write-Host "   Install Docker Desktop: https://www.docker.com/products/docker-desktop" -ForegroundColor Gray
}

# Check if Node.js is available
$nodeAvailable = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeAvailable) {
    Write-Host "❌ Node.js not found. Required for metrics export." -ForegroundColor Red
    exit 1
}

Write-Host "✅ Prerequisites check complete`n" -ForegroundColor Green

# Prometheus Setup
if (-not $SkipPrometheus) {
    Write-Host "=== Prometheus Setup ===" -ForegroundColor Cyan
    
    if ($dockerAvailable) {
        Write-Host "Starting Prometheus with Docker..." -ForegroundColor Yellow
        
        # Create prometheus.yml if it doesn't exist
        if (-not (Test-Path "prometheus.yml")) {
            $prometheusConfig = @"
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'cycles-backend'
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: '/metrics'
"@
            $prometheusConfig | Out-File -FilePath "prometheus.yml" -Encoding UTF8
            Write-Host "✅ Created prometheus.yml" -ForegroundColor Green
        }
        
        Write-Host "`nTo start Prometheus, run:" -ForegroundColor Yellow
        Write-Host "  docker run -d -p 9090:9090 -v `$PWD/prometheus.yml:/etc/prometheus/prometheus.yml prom/prometheus" -ForegroundColor Gray
        Write-Host "`nThen access Prometheus at: http://localhost:9090" -ForegroundColor Gray
    } else {
        Write-Host "⚠️  Docker not available. Install Prometheus manually:" -ForegroundColor Yellow
        Write-Host "   https://prometheus.io/download/" -ForegroundColor Gray
    }
    
    Write-Host ""
}

# Grafana Setup
if (-not $SkipGrafana) {
    Write-Host "=== Grafana Setup ===" -ForegroundColor Cyan
    
    if ($dockerAvailable) {
        Write-Host "`nTo start Grafana, run:" -ForegroundColor Yellow
        Write-Host "  docker run -d -p 3000:3000 grafana/grafana" -ForegroundColor Gray
        Write-Host "`nThen:" -ForegroundColor Yellow
        Write-Host "  1. Access Grafana at: http://localhost:3000" -ForegroundColor Gray
        Write-Host "  2. Login with admin/admin (change password)" -ForegroundColor Gray
        Write-Host "  3. Add Prometheus as data source (http://host.docker.internal:9090)" -ForegroundColor Gray
        Write-Host "  4. Import dashboard from: grafana-dashboard-investment.json" -ForegroundColor Gray
    } else {
        Write-Host "⚠️  Docker not available. Install Grafana manually:" -ForegroundColor Yellow
        Write-Host "   https://grafana.com/grafana/download" -ForegroundColor Gray
    }
    
    Write-Host ""
}

# Alert Manager Setup
if (-not $SkipAlerts) {
    Write-Host "=== Alert Manager Setup ===" -ForegroundColor Cyan
    
    if ($dockerAvailable) {
        Write-Host "`nTo start Alert Manager, run:" -ForegroundColor Yellow
        Write-Host "  docker run -d -p 9093:9093 -v `$PWD/alertmanager-config.yml:/etc/alertmanager/config.yml prom/alertmanager" -ForegroundColor Gray
        Write-Host "`nThen:" -ForegroundColor Yellow
        Write-Host "  1. Configure alertmanager-config.yml with your notification channels" -ForegroundColor Gray
        Write-Host "  2. Update prometheus.yml to point to Alert Manager" -ForegroundColor Gray
        Write-Host "  3. Access Alert Manager at: http://localhost:9093" -ForegroundColor Gray
    } else {
        Write-Host "⚠️  Docker not available. Install Alert Manager manually:" -ForegroundColor Yellow
        Write-Host "   https://prometheus.io/download/" -ForegroundColor Gray
    }
    
    Write-Host ""
}

# Metrics Export Setup
Write-Host "=== Metrics Export Setup ===" -ForegroundColor Cyan
Write-Host "`nTo export metrics from NestJS:" -ForegroundColor Yellow
Write-Host "  1. Install prom-client: npm install prom-client" -ForegroundColor Gray
Write-Host "  2. Create metrics service (see examples in docs)" -ForegroundColor Gray
Write-Host "  3. Expose /metrics endpoint" -ForegroundColor Gray
Write-Host "  4. Configure Prometheus to scrape it" -ForegroundColor Gray
Write-Host ""

# Log Monitoring Setup
Write-Host "=== Log Monitoring Setup ===" -ForegroundColor Cyan
Write-Host "`nOptions for log aggregation:" -ForegroundColor Yellow
Write-Host "  1. ELK Stack (Elasticsearch, Logstash, Kibana)" -ForegroundColor Gray
Write-Host "  2. CloudWatch (AWS)" -ForegroundColor Gray
Write-Host "  3. Datadog" -ForegroundColor Gray
Write-Host "  4. Simple file monitoring (see check-logs.ps1)" -ForegroundColor Gray
Write-Host ""

Write-Host "✅ Setup instructions complete!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "  1. Review PRODUCTION_MONITORING_GUIDE.md for detailed instructions" -ForegroundColor Gray
Write-Host "  2. Configure notification channels in alertmanager-config.yml" -ForegroundColor Gray
Write-Host "  3. Import Grafana dashboard from grafana-dashboard-investment.json" -ForegroundColor Gray
Write-Host "  4. Set up metrics export in your NestJS application" -ForegroundColor Gray
Write-Host ""


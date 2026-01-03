# Monitoring Quick Start Guide

## 🚀 Quick Setup Summary

### 1. Prometheus & Grafana ✅
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3002 (admin/admin)
- **Alert Manager**: http://localhost:9093

### 2. Metrics Export Service ✅
- **Endpoint**: `http://localhost:3001/metrics`
- **Service**: `backend/src/common/services/metrics.service.ts`
- **Controller**: `backend/src/common/controllers/metrics.controller.ts`

### 3. Alert Configuration ✅
- **Rules**: `backend/prometheus-alerts.yml`
- **Config**: `backend/alertmanager-config.yml`
- **Example**: `backend/alertmanager-config.example.yml`

---

## ⚡ Quick Commands

### Start Monitoring Stack
```bash
cd backend
docker-compose -f docker-compose.monitoring.yml up -d
```

### Stop Monitoring Stack
```bash
cd backend
docker-compose -f docker-compose.monitoring.yml down
```

### Check Status
```bash
docker ps --filter "name=cycles-"
```

### View Logs
```bash
docker logs cycles-prometheus
docker logs cycles-grafana
docker logs cycles-alertmanager
```

### Restart Services
```bash
cd backend
docker-compose -f docker-compose.monitoring.yml restart
```

---

## 📊 Configure Grafana

1. **Access**: http://localhost:3002
2. **Login**: admin/admin
3. **Add Data Source**:
   - Configuration → Data Sources → Add Prometheus
   - URL: `http://host.docker.internal:9090`
   - Save & Test
4. **Import Dashboard**:
   - Dashboards → Import
   - Upload `backend/grafana-dashboard-investment.json`

---

## 🔔 Configure Alerts

1. **Edit Config**: `backend/alertmanager-config.yml`
2. **Update Email**:
   ```yaml
   smtp_auth_password: 'YOUR_SMTP_PASSWORD'
   - to: 'your-email@cycles.com'
   ```
3. **Restart**: `docker-compose -f docker-compose.monitoring.yml restart alertmanager`

---

## 📈 Use Metrics in Code

```typescript
import { MetricsService } from '../common/services/metrics.service';

constructor(private readonly metrics: MetricsService) {}

// Record operation
this.metrics.recordInvestmentOperation('create', 'success', duration);

// Record error
this.metrics.recordInvestmentError('ValidationError', 'create');

// Record queue job
this.metrics.recordQueueJobDuration('investment-executions', 'execute', duration);
```

---

## ✅ Verification

1. **Check Metrics Endpoint**:
   ```bash
   curl http://localhost:3001/metrics
   ```

2. **Check Prometheus Targets**:
   - http://localhost:9090/targets
   - Should show `cycles-backend` as UP

3. **Check Grafana**:
   - http://localhost:3002
   - Dashboard should show data

---

**For detailed instructions, see `MONITORING_SETUP_COMPLETE.md`**


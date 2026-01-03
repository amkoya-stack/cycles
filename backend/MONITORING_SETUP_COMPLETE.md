# Monitoring Setup Complete! 🎉

## ✅ What's Been Set Up

### 1. Prometheus & Grafana
- **Prometheus**: Running on http://localhost:9090
- **Grafana**: Running on http://localhost:3002 (admin/admin)
- **Alert Manager**: Running on http://localhost:9093

### 2. Metrics Export Service
- **Metrics Service**: Created at `backend/src/common/services/metrics.service.ts`
- **Metrics Controller**: Created at `backend/src/common/controllers/metrics.controller.ts`
- **Metrics Endpoint**: Available at `http://localhost:3001/metrics` (or your backend port)

### 3. Alert Configuration
- **Alert Rules**: Configured in `backend/prometheus-alerts.yml`
- **Alert Manager Config**: Available in `backend/alertmanager-config.yml`
- **Example Config**: See `backend/alertmanager-config.example.yml` for detailed setup

---

## 📊 Next Steps

### Step 1: Install Dependencies
```bash
cd backend
npm install prom-client
```

### Step 2: Configure Alert Channels

Edit `backend/alertmanager-config.yml`:

1. **Email Configuration**:
   ```yaml
   smtp_auth_password: 'YOUR_SMTP_PASSWORD'  # Use app-specific password for Gmail
   ```

2. **Slack Configuration** (Optional):
   ```yaml
   slack_api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
   ```

3. **Update Email Recipients**:
   ```yaml
   - to: 'your-email@cycles.com'
   ```

### Step 3: Restart Alert Manager
```bash
cd backend
docker-compose -f docker-compose.monitoring.yml restart alertmanager
```

### Step 4: Configure Grafana

1. **Access Grafana**: http://localhost:3002
2. **Login**: admin/admin (change password on first login)
3. **Add Prometheus Data Source**:
   - Go to Configuration → Data Sources
   - Add Prometheus
   - URL: `http://host.docker.internal:9090`
   - Save & Test

4. **Import Dashboard**:
   - Go to Dashboards → Import
   - Upload `backend/grafana-dashboard-investment.json`
   - Select Prometheus data source
   - Import

### Step 5: Verify Metrics Endpoint

Once your backend is running:
```bash
curl http://localhost:3001/metrics
```

You should see Prometheus metrics output.

---

## 🔧 Using Metrics in Your Code

### Example: Record Investment Operation

```typescript
import { MetricsService } from '../common/services/metrics.service';

constructor(private readonly metrics: MetricsService) {}

async createInvestment(data: CreateInvestmentDto) {
  const startTime = Date.now();
  
  try {
    const investment = await this.investmentService.create(data);
    
    // Record success
    this.metrics.recordInvestmentOperation('create', 'success', Date.now() - startTime);
    this.metrics.recordInvestmentAmount(data.productType, data.amount);
    
    return investment;
  } catch (error) {
    // Record error
    this.metrics.recordInvestmentOperation('create', 'error', Date.now() - startTime);
    this.metrics.recordInvestmentError(error.constructor.name, 'create');
    throw error;
  }
}
```

### Example: Record Queue Job

```typescript
async processInvestmentJob(job: Job) {
  const startTime = Date.now();
  
  try {
    await this.executeInvestment(job.data);
    
    // Record success
    this.metrics.recordQueueJobDuration('investment-executions', 'execute', Date.now() - startTime);
  } catch (error) {
    // Record failure
    this.metrics.recordQueueJobFailure('investment-executions', 'execute');
    throw error;
  }
}
```

### Example: Record Rate Limit

```typescript
// In RateLimitGuard
if (isRateLimited) {
  this.metrics.recordRateLimitHit(endpoint, userId);
  this.metrics.recordRateLimitRequest(endpoint, 'limited');
} else {
  this.metrics.recordRateLimitRequest(endpoint, 'allowed');
}
```

### Example: Record Idempotency

```typescript
// In IdempotencyInterceptor
if (cachedResponse) {
  this.metrics.recordIdempotencyHit(endpoint);
} else {
  this.metrics.recordIdempotencyMiss(endpoint);
}
```

---

## 📈 Available Metrics

### Investment Metrics
- `investment_operations_total` - Total investment operations by operation type and status
- `investment_operation_duration_seconds` - Duration histogram for operations
- `investment_errors_total` - Error count by error type and operation
- `investments_by_status` - Current count of investments by status
- `investment_amounts` - Distribution of investment amounts

### Queue Metrics
- `queue_jobs_total` - Current job count by status and queue
- `queue_job_duration_seconds` - Job processing duration
- `queue_job_failures_total` - Failed job count

### Rate Limiting Metrics
- `rate_limit_hits_total` - Rate limit hits by endpoint
- `rate_limit_requests_total` - Total requests (allowed/limited)

### Idempotency Metrics
- `idempotency_hits_total` - Cache hits
- `idempotency_misses_total` - Cache misses

---

## 🚨 Alert Rules

Alerts are configured in `backend/prometheus-alerts.yml`:

- **HighInvestmentErrorRate**: > 10 errors/sec for 5 minutes
- **QueueJobFailures**: > 5 failures/sec for 5 minutes
- **QueueBacklog**: > 1000 waiting jobs for 10 minutes
- **RateLimitAbuse**: > 50 hits/sec for 5 minutes
- **SlowInvestmentOperations**: p95 > 5 seconds for 10 minutes

---

## 🔍 Monitoring URLs

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3002
- **Alert Manager**: http://localhost:9093
- **Metrics Endpoint**: http://localhost:3001/metrics

---

## 📝 Troubleshooting

### Alert Manager Not Starting
- Check logs: `docker logs cycles-alertmanager`
- Verify config syntax: `docker exec cycles-alertmanager amtool check-config /etc/alertmanager/config.yml`

### Metrics Not Appearing
- Verify backend is running
- Check metrics endpoint: `curl http://localhost:3001/metrics`
- Verify Prometheus is scraping: http://localhost:9090/targets

### Grafana Can't Connect to Prometheus
- Use `http://host.docker.internal:9090` as data source URL
- Verify Prometheus is accessible from Grafana container

---

## 🎯 Production Checklist

- [ ] Install `prom-client` package
- [ ] Configure email/Slack/PagerDuty in `alertmanager-config.yml`
- [ ] Restart Alert Manager
- [ ] Add Prometheus data source in Grafana
- [ ] Import dashboard
- [ ] Integrate metrics recording in investment service
- [ ] Test alert delivery
- [ ] Set up log aggregation (optional)
- [ ] Configure log retention policy

---

**All monitoring infrastructure is ready!** 🚀


# Production Monitoring Guide - Investment Module

This guide covers monitoring logs, dashboards, and alerts for the Investment Module in production.

---

## 1. Log Monitoring in Production

### 1.1 Log Locations

**Development (Console):**
- Logs appear in console when running `npm run start:dev`
- Look for structured prefixes: `[API_]`, `[INVESTMENT_]`, `[QUEUE_]`

**Production (Files):**
- Default location: `logs/app.log`
- Configure in `main.ts` or environment variables
- Consider log rotation for large files

### 1.2 Log Search Patterns

#### Search by Operation Type

**Investment Creation:**
```bash
# Find all investment creation logs
grep "\[INVESTMENT_CREATE\]" logs/app.log

# Find investment creation errors
grep "\[INVESTMENT_CREATE\].*ERROR" logs/app.log
```

**API Requests:**
```bash
# Find all API requests
grep "\[API_" logs/app.log

# Find failed API requests
grep "\[API_.*failed\|ERROR" logs/app.log
```

**Queue Processing:**
```bash
# Find queue job processing
grep "\[QUEUE_" logs/app.log

# Find failed queue jobs
grep "\[QUEUE_.*failed\|ERROR" logs/app.log
```

**Idempotency:**
```bash
# Find idempotency checks
grep "\[IDEMPOTENCY\]" logs/app.log

# Find idempotent requests
grep "\[IDEMPOTENCY\].*Found cached\|already processed" logs/app.log
```

#### Search by User/Investment

**By User ID:**
```bash
grep "userId: e0900539-4ea9-457f-97ee-bc69823b5f65" logs/app.log
```

**By Investment ID:**
```bash
grep "investmentId: inv-123" logs/app.log
```

**By Chama ID:**
```bash
grep "chamaId: 40bc1928-c978-44fe-b7e6-9b979e7db48b" logs/app.log
```

#### Search by Error Type

**All Errors:**
```bash
grep "ERROR\|Failed\|failed" logs/app.log
```

**Rate Limiting:**
```bash
grep "429\|Rate.*limit\|rate.*limit" logs/app.log
```

**Validation Failures:**
```bash
grep "\[INVESTMENT_CREATE\].*Validation failed\|WARN" logs/app.log
```

### 1.3 Real-Time Log Monitoring

#### Using `tail -f` (Linux/Mac)
```bash
# Follow logs in real-time
tail -f logs/app.log

# Follow and filter for investment operations
tail -f logs/app.log | grep "\[INVESTMENT\|\[QUEUE\|\[API_"

# Follow and highlight errors
tail -f logs/app.log | grep --color=always "ERROR\|Failed"
```

#### Using PowerShell (Windows)
```powershell
# Follow logs in real-time
Get-Content logs/app.log -Wait -Tail 50

# Follow and filter
Get-Content logs/app.log -Wait | Select-String "\[INVESTMENT|\[QUEUE|\[API_"

# Follow errors only
Get-Content logs/app.log -Wait | Select-String "ERROR|Failed"
```

### 1.4 Log Aggregation Tools

#### Option 1: ELK Stack (Elasticsearch, Logstash, Kibana)

**Setup:**
1. Install Elasticsearch, Logstash, Kibana
2. Configure Logstash to read from `logs/app.log`
3. Parse structured logs using grok patterns
4. Visualize in Kibana

**Logstash Config Example:**
```ruby
input {
  file {
    path => "/path/to/logs/app.log"
    start_position => "beginning"
  }
}

filter {
  grok {
    match => { "message" => "\[%{WORD:prefix}\] %{GREEDYDATA:log_message}" }
  }
  
  if [prefix] =~ /API_|INVESTMENT_|QUEUE_/ {
    grok {
      match => { "log_message" => "userId: %{UUID:user_id}" }
    }
    grok {
      match => { "log_message" => "investmentId: %{UUID:investment_id}" }
    }
    grok {
      match => { "log_message" => "amount: %{NUMBER:amount}" }
    }
  }
}

output {
  elasticsearch {
    hosts => ["localhost:9200"]
    index => "investment-logs-%{+YYYY.MM.dd}"
  }
}
```

#### Option 2: CloudWatch (AWS)

**Setup:**
1. Install CloudWatch agent
2. Configure to send logs to CloudWatch Logs
3. Create log groups: `/aws/cycles/investment`
4. Set up metric filters for errors

**CloudWatch Agent Config:**
```json
{
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/path/to/logs/app.log",
            "log_group_name": "/aws/cycles/investment",
            "log_stream_name": "{instance_id}"
          }
        ]
      }
    }
  }
}
```

#### Option 3: Datadog

**Setup:**
1. Install Datadog agent
2. Configure log collection
3. Set up log parsing rules
4. Create dashboards

**Datadog Config:**
```yaml
logs:
  - type: file
    path: /path/to/logs/app.log
    service: cycles-investment
    source: nestjs
    sourcecategory: investment-module
    log_processing_rules:
      - type: multi_line
        name: nestjs_logs
        pattern: ^\[
```

### 1.5 Log Analysis Queries

#### Count Operations by Type
```bash
# Count investment creations
grep -c "\[INVESTMENT_CREATE\]" logs/app.log

# Count queue executions
grep -c "\[QUEUE_EXECUTE_INVESTMENT\]" logs/app.log

# Count errors
grep -c "ERROR" logs/app.log
```

#### Find Slow Operations
```bash
# Find operations taking > 1 second
grep "duration: [0-9]\{4,\}ms" logs/app.log

# Find queue jobs with long duration
grep "\[QUEUE_.*duration: [0-9]\{4,\}ms" logs/app.log
```

#### Find Failed Operations
```bash
# Find failed investments
grep "\[INVESTMENT_CREATE\].*failed\|ERROR" logs/app.log

# Find failed queue jobs
grep "\[QUEUE_.*failed\|ERROR" logs/app.log

# Find rate limit hits
grep "429\|Rate.*limit" logs/app.log
```

---

## 2. Monitoring Dashboard Configuration

### 2.1 Grafana Dashboard

**Dashboard JSON Configuration:**

```json
{
  "dashboard": {
    "title": "Investment Module - Production Monitoring",
    "panels": [
      {
        "title": "Investment Operations Rate",
        "targets": [
          {
            "expr": "rate(investment_operations_total[5m])",
            "legendFormat": "{{operation}}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Queue Job Status",
        "targets": [
          {
            "expr": "queue_jobs_total{status=\"waiting\"}",
            "legendFormat": "Waiting"
          },
          {
            "expr": "queue_jobs_total{status=\"active\"}",
            "legendFormat": "Active"
          },
          {
            "expr": "queue_jobs_total{status=\"completed\"}",
            "legendFormat": "Completed"
          },
          {
            "expr": "queue_jobs_total{status=\"failed\"}",
            "legendFormat": "Failed"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(investment_errors_total[5m])",
            "legendFormat": "Errors/sec"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Rate Limit Hits",
        "targets": [
          {
            "expr": "rate(rate_limit_hits_total[5m])",
            "legendFormat": "Rate Limit Hits/sec"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Operation Duration (p95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, investment_operation_duration_seconds_bucket)",
            "legendFormat": "p95 Duration"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Idempotency Hit Rate",
        "targets": [
          {
            "expr": "rate(idempotency_hits_total[5m])",
            "legendFormat": "Idempotency Hits/sec"
          }
        ],
        "type": "graph"
      }
    ],
    "refresh": "30s",
    "time": {
      "from": "now-6h",
      "to": "now"
    }
  }
}
```

### 2.2 Prometheus Metrics

**Metrics to Export:**

```typescript
// Example metrics configuration
const metrics = {
  // Investment operations
  investment_operations_total: {
    type: 'counter',
    labels: ['operation', 'status'],
    help: 'Total investment operations'
  },
  
  // Queue metrics
  queue_jobs_total: {
    type: 'gauge',
    labels: ['status', 'queue'],
    help: 'Current queue job count'
  },
  
  queue_job_duration_seconds: {
    type: 'histogram',
    labels: ['queue', 'job_type'],
    help: 'Queue job duration'
  },
  
  // Error metrics
  investment_errors_total: {
    type: 'counter',
    labels: ['error_type', 'operation'],
    help: 'Total investment errors'
  },
  
  // Rate limiting
  rate_limit_hits_total: {
    type: 'counter',
    labels: ['endpoint', 'user_id'],
    help: 'Total rate limit hits'
  },
  
  // Idempotency
  idempotency_hits_total: {
    type: 'counter',
    labels: ['endpoint'],
    help: 'Total idempotency cache hits'
  }
};
```

### 2.3 Custom Dashboard Queries

**Kibana/Elasticsearch Queries:**

```json
{
  "query": {
    "bool": {
      "must": [
        {
          "match": {
            "prefix": "INVESTMENT_CREATE"
          }
        },
        {
          "range": {
            "@timestamp": {
              "gte": "now-1h"
            }
          }
        }
      ]
    }
  },
  "aggs": {
    "operations_by_status": {
      "terms": {
        "field": "status.keyword"
      }
    },
    "errors_over_time": {
      "date_histogram": {
        "field": "@timestamp",
        "interval": "5m"
      },
      "aggs": {
        "error_count": {
          "filter": {
            "match": {
              "level": "ERROR"
            }
          }
        }
      }
    }
  }
}
```

---

## 3. Error Alerting Setup

### 3.1 Alert Rules

#### Critical Alerts

**High Error Rate:**
```yaml
alert: HighInvestmentErrorRate
expr: rate(investment_errors_total[5m]) > 10
for: 5m
labels:
  severity: critical
annotations:
  summary: "High error rate in investment module"
  description: "Error rate is {{ $value }} errors/sec"
```

**Queue Job Failures:**
```yaml
alert: QueueJobFailures
expr: rate(queue_jobs_total{status="failed"}[5m]) > 5
for: 5m
labels:
  severity: critical
annotations:
  summary: "High queue job failure rate"
  description: "{{ $value }} jobs failing per second"
```

**Queue Backlog:**
```yaml
alert: QueueBacklog
expr: queue_jobs_total{status="waiting"} > 1000
for: 10m
labels:
  severity: warning
annotations:
  summary: "Large queue backlog"
  description: "{{ $value }} jobs waiting in queue"
```

**Rate Limit Abuse:**
```yaml
alert: RateLimitAbuse
expr: rate(rate_limit_hits_total[5m]) > 50
for: 5m
labels:
  severity: warning
annotations:
  summary: "High rate limit hits"
  description: "{{ $value }} rate limit hits per second"
```

#### Warning Alerts

**Slow Operations:**
```yaml
alert: SlowInvestmentOperations
expr: histogram_quantile(0.95, investment_operation_duration_seconds_bucket) > 5
for: 10m
labels:
  severity: warning
annotations:
  summary: "Slow investment operations"
  description: "p95 duration is {{ $value }} seconds"
```

**Low Idempotency Hit Rate:**
```yaml
alert: LowIdempotencyHitRate
expr: rate(idempotency_hits_total[5m]) < 0.1
for: 15m
labels:
  severity: info
annotations:
  summary: "Low idempotency usage"
  description: "Clients may not be using idempotency keys"
```

### 3.2 Alert Channels

#### Email Alerts

**Configuration:**
```yaml
receivers:
  - name: investment-team
    email_configs:
      - to: 'investment-alerts@cycles.com'
        from: 'alerts@cycles.com'
        smarthost: 'smtp.gmail.com:587'
        auth_username: 'alerts@cycles.com'
        auth_password: 'password'
        headers:
          Subject: 'Investment Module Alert: {{ .GroupLabels.alertname }}'
```

#### Slack Alerts

**Configuration:**
```yaml
receivers:
  - name: investment-slack
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
        channel: '#investment-alerts'
        title: 'Investment Module Alert'
        text: '{{ .GroupLabels.alertname }}: {{ .Annotations.description }}'
        color: '{{ if eq .Status "firing" }}danger{{ else }}good{{ end }}'
```

#### PagerDuty Alerts

**Configuration:**
```yaml
receivers:
  - name: investment-pagerduty
    pagerduty_configs:
      - service_key: 'YOUR_PAGERDUTY_KEY'
        description: '{{ .GroupLabels.alertname }}: {{ .Annotations.description }}'
        severity: '{{ .Labels.severity }}'
```

### 3.3 Alert Routing

**Route Configuration:**
```yaml
route:
  group_by: ['alertname', 'severity']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'default'
  routes:
    - match:
        severity: critical
      receiver: 'investment-critical'
      continue: true
    - match:
        severity: warning
      receiver: 'investment-warning'
    - match:
        module: investment
      receiver: 'investment-team'
```

### 3.4 Custom Alert Script

**PowerShell Alert Script:**
```powershell
# alert-checker.ps1
# Monitors logs and sends alerts

$logFile = "logs/app.log"
$errorThreshold = 10  # errors per minute
$checkInterval = 60    # seconds

while ($true) {
    $errors = Get-Content $logFile -Tail 1000 | 
        Select-String "ERROR.*\[INVESTMENT|\[QUEUE" | 
        Where-Object { $_.Line -match (Get-Date -Format "yyyy-MM-dd HH:mm") }
    
    $errorCount = ($errors | Measure-Object).Count
    
    if ($errorCount -gt $errorThreshold) {
        Write-Host "ALERT: High error rate detected: $errorCount errors" -ForegroundColor Red
        # Send email, Slack, etc.
    }
    
    Start-Sleep -Seconds $checkInterval
}
```

---

## 4. Best Practices

### 4.1 Log Retention

- **Development:** 7 days
- **Staging:** 30 days
- **Production:** 90 days (or per compliance requirements)

### 4.2 Log Rotation

**Using logrotate (Linux):**
```
/path/to/logs/app.log {
    daily
    rotate 90
    compress
    delaycompress
    notifempty
    create 0644 user group
    postrotate
        systemctl reload cycles-backend
    endscript
}
```

### 4.3 Monitoring Checklist

- [ ] Log aggregation configured
- [ ] Dashboard created and accessible
- [ ] Alerts configured and tested
- [ ] Alert channels verified
- [ ] On-call rotation set up
- [ ] Runbooks created for common issues
- [ ] Log retention policy defined
- [ ] Metrics exported to Prometheus/Grafana

---

## 5. Quick Reference

### Common Log Searches

```bash
# All investment operations in last hour
grep "\[INVESTMENT" logs/app.log | grep "$(date -d '1 hour ago' +%Y-%m-%d)"

# Errors for specific user
grep "ERROR.*userId: USER_ID" logs/app.log

# Failed queue jobs
grep "\[QUEUE_.*failed\|ERROR" logs/app.log

# Rate limit hits
grep "429\|Rate.*limit" logs/app.log
```

### Dashboard URLs

- **Grafana:** http://localhost:3000/dashboards/investment
- **Kibana:** http://localhost:5601/app/kibana#/discover
- **Prometheus:** http://localhost:9090/graph

---

## 6. Troubleshooting

### Issue: Logs not appearing
- Check log file permissions
- Verify logging configuration in `main.ts`
- Check disk space

### Issue: Alerts not firing
- Verify alert rules syntax
- Check alert manager connectivity
- Verify metric names match

### Issue: Dashboard not updating
- Check data source connectivity
- Verify query syntax
- Check time range settings

---

**Next Steps:**
1. Set up log aggregation (ELK, CloudWatch, or Datadog)
2. Create Grafana dashboard using provided config
3. Configure Prometheus metrics export
4. Set up alert rules and channels
5. Test alert delivery


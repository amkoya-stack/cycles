# Investment Module Production Readiness Testing Guide

This guide provides step-by-step instructions for testing all production readiness features implemented for the Investment Module.

## Prerequisites

1. **Backend server running**: `npm run start:dev` (or production mode)
2. **Redis running**: Required for queues and rate limiting
3. **PostgreSQL running**: Database must be accessible
4. **Queue workers running**: Bull queue workers must be active
5. **Authentication token**: JWT token for API requests

---

## 1. Setup Feature Flags

### Option A: Using Admin API

```bash
# Get your admin JWT token first
TOKEN="your-jwt-token"

# Create investment module flag
curl -X POST http://localhost:3001/api/v1/admin/feature-flags \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "investment_module_enabled",
    "name": "Investment Module",
    "description": "Master switch for the investment module",
    "type": "boolean",
    "enabled": true
  }'

# Activate the flag
curl -X PUT http://localhost:3001/api/v1/admin/feature-flags/investment_module_enabled \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "active",
    "enabled": true
  }'

# Repeat for other flags:
# - investment_execution_enabled
# - dividend_distribution_enabled
# - external_investment_integrations_enabled
```

### Option B: Using Setup Script

```bash
# Run the setup script
npx ts-node scripts/setup-investment-feature-flags.ts
```

### Option C: Direct SQL

```sql
-- Create feature flags directly in database
INSERT INTO feature_flags (key, name, description, type, status, enabled)
VALUES 
  ('investment_module_enabled', 'Investment Module', 'Master switch for investment module', 'boolean', 'active', true),
  ('investment_execution_enabled', 'Investment Execution', 'Controls investment execution', 'boolean', 'active', true),
  ('dividend_distribution_enabled', 'Dividend Distribution', 'Controls dividend distribution', 'boolean', 'active', true),
  ('external_investment_integrations_enabled', 'External Investment Integrations', 'Controls external integrations', 'boolean', 'active', true)
ON CONFLICT (key) DO UPDATE SET
  status = EXCLUDED.status,
  enabled = EXCLUDED.enabled;
```

---

## 2. Test Feature Flags

### Test 1: Disable Investment Module

```bash
TOKEN="your-jwt-token"

# Disable the flag
curl -X PUT http://localhost:3001/api/v1/admin/feature-flags/investment_module_enabled \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false, "status": "active"}'

# Try to create investment (should fail with 403)
curl -X POST http://localhost:3001/api/v1/investment/investments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "chamaId": "test-chama-id",
    "productId": "test-product-id",
    "amount": 10000
  }'

# Expected: 403 Forbidden
# Response: {"statusCode": 403, "message": "Feature 'investment_module_enabled' is not enabled for your account"}

# Re-enable the flag
curl -X PUT http://localhost:3001/api/v1/admin/feature-flags/investment_module_enabled \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true, "status": "active"}'
```

### Test 2: Check Flag Status

```bash
# Check if flag is enabled
curl http://localhost:3001/api/v1/admin/feature-flags/investment_module_enabled/check?userId=your-user-id \
  -H "Authorization: Bearer $TOKEN"

# Expected: {"key": "investment_module_enabled", "enabled": true, "context": {...}}
```

### Using Test Script

```powershell
# PowerShell
.\scripts\test-investment-features.ps1 -Token "your-jwt-token"

# Bash
TOKEN="your-jwt-token" ./scripts/test-investment-features.sh
```

---

## 3. Test Rate Limiting

### Test: Create Investment Rate Limit (5/hour)

```bash
TOKEN="your-jwt-token"

# Make 6 requests rapidly (5th should succeed, 6th should be rate limited)
for i in {1..6}; do
  echo "Request $i:"
  curl -X POST http://localhost:3001/api/v1/investment/investments \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "chamaId": "test-chama-id",
      "productId": "test-product-id",
      "amount": 10000
    }' \
    -w "\nHTTP Status: %{http_code}\n\n"
  sleep 0.5
done

# Expected:
# Requests 1-5: 200/201 OK
# Request 6: 429 Too Many Requests
# Response headers should include:
#   X-RateLimit-Limit: 5
#   X-RateLimit-Remaining: 0
#   X-RateLimit-Reset: <timestamp>
```

### Test Other Endpoints

```bash
# Execute investment (10/hour)
for i in {1..11}; do
  curl -X POST http://localhost:3001/api/v1/investment/investments/test-id/execute \
    -H "Authorization: Bearer $TOKEN" \
    -w "\nHTTP Status: %{http_code}\n"
done

# Distribute dividend (5/hour)
for i in {1..6}; do
  curl -X POST http://localhost:3001/api/v1/investment/investments/test-id/dividends \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"amount": 1000}' \
    -w "\nHTTP Status: %{http_code}\n"
done
```

---

## 4. Test Idempotency

### Test: Duplicate Investment Creation

```bash
TOKEN="your-jwt-token"
IDEMPOTENCY_KEY=$(uuidgen)  # or use any unique string

echo "Idempotency Key: $IDEMPOTENCY_KEY"

# First request
echo "First request:"
RESPONSE1=$(curl -s -X POST http://localhost:3001/api/v1/investment/investments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "idempotency-key: $IDEMPOTENCY_KEY" \
  -d '{
    "chamaId": "test-chama-id",
    "productId": "test-product-id",
    "amount": 10000,
    "idempotencyKey": "'$IDEMPOTENCY_KEY'"
  }')

echo "$RESPONSE1" | jq '.'
INVESTMENT_ID1=$(echo "$RESPONSE1" | jq -r '.id')

sleep 1

# Duplicate request with same idempotency key
echo -e "\nDuplicate request (same idempotency key):"
RESPONSE2=$(curl -s -X POST http://localhost:3001/api/v1/investment/investments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "idempotency-key: $IDEMPOTENCY_KEY" \
  -d '{
    "chamaId": "test-chama-id",
    "productId": "test-product-id",
    "amount": 10000,
    "idempotencyKey": "'$IDEMPOTENCY_KEY'"
  }')

echo "$RESPONSE2" | jq '.'
INVESTMENT_ID2=$(echo "$RESPONSE2" | jq -r '.id')

# Verify they're the same
if [ "$INVESTMENT_ID1" = "$INVESTMENT_ID2" ]; then
  echo -e "\n✅ Idempotency working: Same investment ID returned"
else
  echo -e "\n❌ Idempotency failed: Different IDs returned"
fi
```

### Test: Investment Execution Idempotency

```bash
TOKEN="your-jwt-token"
INVESTMENT_ID="your-investment-id"
IDEMPOTENCY_KEY=$(uuidgen)

# First execution
RESPONSE1=$(curl -s -X POST http://localhost:3001/api/v1/investment/investments/$INVESTMENT_ID/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "idempotency-key: $IDEMPOTENCY_KEY" \
  -d '{"idempotencyKey": "'$IDEMPOTENCY_KEY'"}')

echo "First execution:"
echo "$RESPONSE1" | jq '.'
JOB_ID1=$(echo "$RESPONSE1" | jq -r '.jobId')

sleep 1

# Duplicate execution
RESPONSE2=$(curl -s -X POST http://localhost:3001/api/v1/investment/investments/$INVESTMENT_ID/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "idempotency-key: $IDEMPOTENCY_KEY" \
  -d '{"idempotencyKey": "'$IDEMPOTENCY_KEY'"}')

echo -e "\nDuplicate execution:"
echo "$RESPONSE2" | jq '.'
JOB_ID2=$(echo "$RESPONSE2" | jq -r '.jobId')

# For queue operations, jobId should be the same (same idempotency key = same job)
if [ "$JOB_ID1" = "$JOB_ID2" ]; then
  echo -e "\n✅ Idempotency working: Same job ID returned"
else
  echo -e "\n⚠️  Different job IDs (may be expected if job completed)"
fi
```

---

## 5. Test Queue Processing

### Check Queue Status

```bash
# Using the check script
npx ts-node scripts/check-queue-workers.ts
```

### Test: Create Investment and Verify Queuing

```bash
TOKEN="your-jwt-token"

# Create an investment (this should be synchronous, but execution is queued)
INVESTMENT_RESPONSE=$(curl -s -X POST http://localhost:3001/api/v1/investment/investments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "chamaId": "your-chama-id",
    "productId": "your-product-id",
    "amount": 100000
  }')

INVESTMENT_ID=$(echo "$INVESTMENT_RESPONSE" | jq -r '.id')
echo "Investment created: $INVESTMENT_ID"

# Wait for approval (if voting required) or proceed to execution
# Execute investment (should return queued status)
EXECUTE_RESPONSE=$(curl -s -X POST http://localhost:3001/api/v1/investment/investments/$INVESTMENT_ID/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

echo "Execution response:"
echo "$EXECUTE_RESPONSE" | jq '.'

# Verify response structure
JOB_ID=$(echo "$EXECUTE_RESPONSE" | jq -r '.jobId')
STATUS=$(echo "$EXECUTE_RESPONSE" | jq -r '.status')

if [ "$STATUS" = "queued" ] && [ -n "$JOB_ID" ]; then
  echo -e "\n✅ Investment execution queued successfully"
  echo "   Job ID: $JOB_ID"
  echo "   Status: $STATUS"
else
  echo -e "\n❌ Unexpected response structure"
fi
```

### Monitor Queue Processing

```bash
# Check queue status using the script
npx ts-node scripts/check-queue-workers.ts

# Or check Redis directly
redis-cli
> LLEN bull:investment-executions:waiting
> LLEN bull:investment-executions:active
> LLEN bull:investment-executions:completed
> LLEN bull:investment-executions:failed
```

### Verify Job Processing

1. **Check logs** for queue processing:
   ```bash
   # Look for [QUEUE_EXECUTE_INVESTMENT] or [QUEUE_DISTRIBUTE_DIVIDEND] in logs
   tail -f logs/app.log | grep "\[QUEUE_"
   ```

2. **Check investment status** after execution:
   ```bash
   curl http://localhost:3001/api/v1/investment/investments/$INVESTMENT_ID \
     -H "Authorization: Bearer $TOKEN" | jq '.status'
   
   # Should change from 'approved' to 'active' after queue processing
   ```

---

## 6. Comprehensive Test Script

### Run All Tests

```powershell
# PowerShell
$env:TEST_TOKEN = "your-jwt-token"
.\scripts\test-investment-features.ps1
```

```bash
# Bash
export TOKEN="your-jwt-token"
./scripts/test-investment-features.sh
```

---

## 7. Manual Verification Checklist

### Feature Flags
- [ ] Create all required feature flags
- [ ] Disable `investment_module_enabled` → verify 403 on investment endpoints
- [ ] Enable flag → verify endpoints work
- [ ] Test each flag individually

### Rate Limiting
- [ ] Make 6 rapid requests to create investment → 6th should be 429
- [ ] Check response headers for rate limit info
- [ ] Wait for rate limit window to reset
- [ ] Verify requests work again after reset

### Idempotency
- [ ] Create investment with idempotency key
- [ ] Duplicate request with same key → should return same investment
- [ ] Execute investment with idempotency key
- [ ] Duplicate execution → should return same job/result

### Queue Processing
- [ ] Execute investment → verify response has `jobId` and `status: "queued"`
- [ ] Check queue workers are running
- [ ] Verify job is processed (check logs)
- [ ] Verify investment status changes to 'active'
- [ ] Test dividend distribution queuing

### Logging
- [ ] Check logs for operation traces
- [ ] Verify log prefixes are present: `[API_]`, `[QUEUE_]`, `[INVESTMENT_]`
- [ ] Verify context is logged (user IDs, amounts, etc.)
- [ ] Check error logs include stack traces

---

## 8. Troubleshooting

### Queue Workers Not Processing

```bash
# Check if workers are running
ps aux | grep "node.*investment"

# Check Redis connection
redis-cli ping

# Check queue configuration
npx ts-node scripts/check-queue-workers.ts
```

### Rate Limiting Not Working

```bash
# Check Redis is running
redis-cli ping

# Check rate limit keys in Redis
redis-cli KEYS "rate_limit:*"

# Clear rate limit (for testing)
redis-cli DEL "rate_limit:user:your-user-id:investment/investments"
```

### Feature Flags Not Working

```bash
# Check flag exists and is active
curl http://localhost:3001/api/v1/admin/feature-flags/investment_module_enabled \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Verify flag status is 'active' and enabled is true
```

### Idempotency Not Working

```bash
# Check idempotency cache in Redis
redis-cli KEYS "idempotency:*"

# Check investment metadata for idempotency key
psql -d your_database -c "SELECT id, metadata FROM investments WHERE metadata->>'idempotencyKey' IS NOT NULL LIMIT 5;"
```

---

## 9. Expected Results Summary

| Test | Expected Result |
|------|----------------|
| Feature Flag Disabled | 403 Forbidden |
| Feature Flag Enabled | 200/201 Success |
| Rate Limit Exceeded | 429 Too Many Requests with headers |
| Idempotent Request | Same result returned |
| Queue Job Created | `{jobId, status: "queued"}` response |
| Queue Processing | Job processed, status updated in logs |
| Logging | All operations logged with context |

---

## 10. Next Steps After Testing

1. **Monitor in Production**: Set up log aggregation and monitoring
2. **Alert on Errors**: Configure alerts for ERROR level logs
3. **Track Metrics**: Monitor rate limit hits, queue processing times
4. **Review Logs**: Regularly review logs for patterns and issues
5. **Adjust Limits**: Fine-tune rate limits based on usage patterns

---

## Support

For issues or questions:
1. Check logs: `tail -f logs/app.log | grep "\[INVESTMENT\|\[QUEUE\|\[API_"`
2. Review documentation: `INVESTMENT_LOGGING_GUIDE.md`
3. Check queue status: `npx ts-node scripts/check-queue-workers.ts`


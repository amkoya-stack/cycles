# Manual Testing Walkthrough - Investment Module

This is a step-by-step guide to manually test all production readiness features.

---

## Prerequisites Check

Before we start, make sure:
- ✅ Backend server is running (`npm run start:dev` in backend folder)
- ✅ Redis is running
- ✅ PostgreSQL is running
- ✅ Feature flags are created (we already did this!)

---

## Step 1: Get Your JWT Token

### Option A: Using Login API

```bash
# Replace with your actual credentials
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "your-password"
  }'
```

**Expected Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": "user-uuid-here"
}
```

**Save your token:**
```bash
# In PowerShell
$TOKEN = "paste-your-accessToken-here"

# In Bash
export TOKEN="paste-your-accessToken-here"
```

### Option B: Using Browser/Postman

1. Open Postman or your browser
2. POST to `http://localhost:3001/api/v1/auth/login`
3. Body (JSON):
   ```json
   {
     "email": "your-email@example.com",
     "password": "your-password"
   }
   ```
4. Copy the `accessToken` from the response

---

## Step 2: Test Feature Flags

### Test 2.1: Verify Feature Flag is Enabled

```bash
# Check if investment module flag is enabled
curl http://localhost:3001/api/v1/admin/feature-flags/investment_module_enabled \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "key": "investment_module_enabled",
  "enabled": true,
  "status": "active",
  ...
}
```

### Test 2.2: Disable Feature Flag

```bash
# Disable the investment module flag
curl -X PUT http://localhost:3001/api/v1/admin/feature-flags/investment_module_enabled \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": false,
    "status": "active"
  }'
```

**Expected Response:**
```json
{
  "key": "investment_module_enabled",
  "enabled": false,
  "status": "active",
  ...
}
```

### Test 2.3: Try to Create Investment (Should Fail)

```bash
# Try to create an investment (should fail with 403)
curl -X POST http://localhost:3001/api/v1/investment/investments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "chamaId": "test-chama-id",
    "productId": "test-product-id",
    "amount": 10000
  }'
```

**Expected Response (403 Forbidden):**
```json
{
  "statusCode": 403,
  "message": "Feature 'investment_module_enabled' is not enabled for your account"
}
```

✅ **Success!** The feature flag is working - it blocked the request.

### Test 2.4: Re-enable Feature Flag

```bash
# Re-enable the flag
curl -X PUT http://localhost:3001/api/v1/admin/feature-flags/investment_module_enabled \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "status": "active"
  }'
```

### Test 2.5: Try Again (Should Work)

```bash
# Now try to create investment again (will still fail due to invalid IDs, but should pass feature flag check)
curl -X POST http://localhost:3001/api/v1/investment/investments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "chamaId": "test-chama-id",
    "productId": "test-product-id",
    "amount": 10000
  }'
```

**Expected Response:**
- If IDs are invalid: 400/404 error (but NOT 403!)
- This means the feature flag check passed ✅

---

## Step 3: Test Rate Limiting

Rate limiting is set to **5 requests per hour** for creating investments.

### Test 3.1: Make Multiple Rapid Requests

```bash
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
```

**Expected Results:**
- Requests 1-5: `HTTP Status: 200` or `201` (or 400/404 if IDs invalid, but NOT 429)
- Request 6: `HTTP Status: 429` (Too Many Requests)

**Response Headers (on 429):**
```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 0
X-RateLimit-Reset: <timestamp>
```

✅ **Success!** Rate limiting is working.

**Note:** If you need to reset the rate limit for testing, you can wait 1 hour, or clear Redis:
```bash
redis-cli DEL "rate_limit:user:YOUR_USER_ID:investment/investments"
```

---

## Step 4: Test Idempotency

Idempotency ensures that duplicate requests with the same key return the same result.

### Test 4.1: Create Investment with Idempotency Key

```bash
# Generate a unique idempotency key
IDEMPOTENCY_KEY=$(uuidgen)  # or use any unique string
echo "Idempotency Key: $IDEMPOTENCY_KEY"

# First request
echo "=== First Request ==="
RESPONSE1=$(curl -s -X POST http://localhost:3001/api/v1/investment/investments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "idempotency-key: $IDEMPOTENCY_KEY" \
  -d "{
    \"chamaId\": \"test-chama-id\",
    \"productId\": \"test-product-id\",
    \"amount\": 10000,
    \"idempotencyKey\": \"$IDEMPOTENCY_KEY\"
  }")

echo "$RESPONSE1" | jq '.'
INVESTMENT_ID1=$(echo "$RESPONSE1" | jq -r '.id // empty')
echo "Investment ID: $INVESTMENT_ID1"
```

### Test 4.2: Send Duplicate Request

```bash
# Wait a moment
sleep 1

# Duplicate request with SAME idempotency key
echo -e "\n=== Duplicate Request (Same Key) ==="
RESPONSE2=$(curl -s -X POST http://localhost:3001/api/v1/investment/investments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "idempotency-key: $IDEMPOTENCY_KEY" \
  -d "{
    \"chamaId\": \"test-chama-id\",
    \"productId\": \"test-product-id\",
    \"amount\": 10000,
    \"idempotencyKey\": \"$IDEMPOTENCY_KEY\"
  }")

echo "$RESPONSE2" | jq '.'
INVESTMENT_ID2=$(echo "$RESPONSE2" | jq -r '.id // empty')
echo "Investment ID: $INVESTMENT_ID2"
```

### Test 4.3: Verify Idempotency

```bash
# Compare the results
if [ "$INVESTMENT_ID1" = "$INVESTMENT_ID2" ] && [ -n "$INVESTMENT_ID1" ]; then
  echo -e "\n✅ SUCCESS: Idempotency working! Same investment ID returned: $INVESTMENT_ID1"
else
  echo -e "\n⚠️  Different IDs or empty response (may be expected if IDs are invalid)"
  echo "First:  $INVESTMENT_ID1"
  echo "Second: $INVESTMENT_ID2"
fi
```

✅ **Success!** If both requests return the same investment ID, idempotency is working.

---

## Step 5: Test Queue Processing

Queue processing means investment execution is handled asynchronously.

### Test 5.1: Create a Valid Investment

First, you need:
1. A valid chama ID (where you're a member/admin)
2. A valid investment product ID

```bash
# Get available products
curl http://localhost:3001/api/v1/investment/products \
  -H "Authorization: Bearer $TOKEN" | jq '.[0]'

# Get your chamas
curl http://localhost:3001/api/v1/chama/my-chamas \
  -H "Authorization: Bearer $TOKEN" | jq '.[0].id'
```

### Test 5.2: Create Investment Proposal

```bash
# Replace with actual IDs
CHAMA_ID="your-chama-id"
PRODUCT_ID="your-product-id"

# Create investment
INVESTMENT_RESPONSE=$(curl -s -X POST http://localhost:3001/api/v1/investment/investments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"chamaId\": \"$CHAMA_ID\",
    \"productId\": \"$PRODUCT_ID\",
    \"amount\": 100000
  }")

echo "$INVESTMENT_RESPONSE" | jq '.'
INVESTMENT_ID=$(echo "$INVESTMENT_RESPONSE" | jq -r '.id')
echo "Investment ID: $INVESTMENT_ID"
```

### Test 5.3: Execute Investment (Should Queue)

```bash
# Execute the investment (should return queued status)
EXECUTE_RESPONSE=$(curl -s -X POST http://localhost:3001/api/v1/investment/investments/$INVESTMENT_ID/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

echo "$EXECUTE_RESPONSE" | jq '.'
```

**Expected Response:**
```json
{
  "jobId": "job-uuid-here",
  "status": "queued",
  "externalReference": "investment-exec-...",
  "idempotencyKey": "...",
  "message": "Investment execution queued for processing"
}
```

✅ **Success!** The execution was queued.

### Test 5.4: Check Queue Status

```bash
# Check queue workers (using our script)
npm run check:queue-workers
```

**Expected Output:**
- Should show jobs in "active" or "completed" state
- Check logs for `[QUEUE_EXECUTE_INVESTMENT]` messages

### Test 5.5: Verify Investment Status Changed

```bash
# Wait a few seconds, then check investment status
sleep 5

curl http://localhost:3001/api/v1/investment/investments/$INVESTMENT_ID \
  -H "Authorization: Bearer $TOKEN" | jq '.status'
```

**Expected:** Status should change from `"approved"` to `"active"` after queue processing.

---

## Step 6: Check Logs

All operations are logged with structured prefixes.

### View Logs

```bash
# If using file logging
tail -f logs/app.log | grep "\[INVESTMENT\|\[QUEUE\|\[API_"

# Or check console output if running in dev mode
```

**Look for:**
- `[API_CREATE_INVESTMENT]` - API requests
- `[INVESTMENT_CREATE]` - Investment creation
- `[QUEUE_EXECUTE_INVESTMENT]` - Queue processing
- `[IDEMPOTENCY]` - Idempotency checks

---

## Troubleshooting

### Issue: "Bearer token required"
- Make sure you're including the token: `-H "Authorization: Bearer $TOKEN"`
- Check that the token hasn't expired

### Issue: "Feature flag not found"
- Run the setup script: `npm run setup:investment-flags`

### Issue: Rate limit not working
- Check Redis is running: `redis-cli ping`
- Verify rate limit keys: `redis-cli KEYS "rate_limit:*"`

### Issue: Queue not processing
- Make sure backend server is running
- Check Redis connection
- Verify queue workers are active: `npm run check:queue-workers`

### Issue: Idempotency not working
- Check that you're using the same idempotency key
- Verify Redis is running (idempotency uses Redis cache)

---

## Summary Checklist

After completing all tests, verify:

- [ ] Feature flags can be disabled/enabled
- [ ] Disabled flags return 403 Forbidden
- [ ] Rate limiting returns 429 after limit exceeded
- [ ] Duplicate requests with same idempotency key return same result
- [ ] Investment execution returns queued status
- [ ] Queue processes jobs (check logs)
- [ ] All operations are logged with proper prefixes

---

## Next Steps

Once manual testing is complete:
1. Run automated tests for regression testing
2. Set up monitoring for production
3. Configure alerts for errors
4. Review logs regularly


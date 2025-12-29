# Phase 3 Testing Guide

## Prerequisites

1. **Run Migrations**
   ```bash
   cd backend
   npm run migrate:up
   ```

2. **Start Backend Server**
   ```bash
   npm run start:dev
   ```

3. **Get Access Token**
   - Register/Login via API
   - Copy the `accessToken` from response

## Quick Test Script

### PowerShell (Windows)
```powershell
# Get your token first (register/login)
$token = "your-jwt-token-here"

# Run test script
.\test-phase3.ps1 -Token $token
```

### Manual Testing

### 1. Feature Flags

#### Create Feature Flag
```bash
curl -X POST http://localhost:3001/api/v1/admin/feature-flags \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "test_new_payment_flow",
    "name": "Test New Payment Flow",
    "description": "Testing feature flags",
    "type": "boolean",
    "enabled": true
  }'
```

#### List All Flags
```bash
curl http://localhost:3001/api/v1/admin/feature-flags \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Check Flag Status
```bash
curl "http://localhost:3001/api/v1/admin/feature-flags/test_new_payment_flow/check?userId=test-123" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Update Flag (Percentage Rollout)
```bash
curl -X PUT http://localhost:3001/api/v1/admin/feature-flags/test_new_payment_flow \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "percentage",
    "percentage": 25,
    "status": "active",
    "enabled": true
  }'
```

### 2. Canary Deployment

#### Start Canary
```bash
curl -X POST http://localhost:3001/api/v1/admin/canary-deployments \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "featureKey": "test_new_payment_flow",
    "version": "v2",
    "initialPercentage": 5,
    "rollbackThreshold": 5
  }'
```

#### Get Canary Status
```bash
curl http://localhost:3001/api/v1/admin/canary-deployments/test_new_payment_flow \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Increase Percentage
```bash
curl -X PUT http://localhost:3001/api/v1/admin/canary-deployments/test_new_payment_flow/increase \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "percentage": 25
  }'
```

#### Complete Canary (100%)
```bash
curl -X POST http://localhost:3001/api/v1/admin/canary-deployments/test_new_payment_flow/complete \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Instant Rollback

#### Rollback Feature Flag
```bash
curl -X POST http://localhost:3001/api/v1/admin/rollbacks/feature-flag \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "featureKey": "test_new_payment_flow",
    "reason": "High error rate detected"
  }'
```

#### Rollback Canary
```bash
curl -X POST http://localhost:3001/api/v1/admin/rollbacks/canary \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "featureKey": "test_new_payment_flow",
    "reason": "User complaints"
  }'
```

#### List Rollbacks
```bash
curl "http://localhost:3001/api/v1/admin/rollbacks?limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Chaos Testing

**Note:** Chaos testing is only enabled in development/staging environments.

#### Enable Chaos Testing
Add to `.env`:
```env
CHAOS_TESTING_ENABLED=true
NODE_ENV=development
```

#### Add Chaos Rule (via database)
```sql
INSERT INTO chaos_rules (
  id, name, type, enabled, probability, target, config
) VALUES (
  'test_latency',
  'Test Latency Injection',
  'latency',
  true,
  10, -- 10% chance
  '/api/v1/wallet',
  '{"latencyMs": 2000}'::JSONB
);
```

#### Add Error Injection Rule
```sql
INSERT INTO chaos_rules (
  id, name, type, enabled, probability, target, config
) VALUES (
  'test_error',
  'Test Error Injection',
  'error',
  true,
  5, -- 5% chance
  '/api/v1/wallet',
  '{"errorCode": 500, "errorMessage": "Simulated server error"}'::JSONB
);
```

#### Test Chaos
After adding rules, make requests to the target endpoint. Chaos will be injected randomly based on probability.

## Expected Results

### Feature Flags
- ✅ Create flag successfully
- ✅ List flags returns array
- ✅ Check flag returns enabled status
- ✅ Update flag changes configuration

### Canary Deployment
- ✅ Start canary creates deployment record
- ✅ Get status shows metrics
- ✅ Increase percentage updates flag
- ✅ Complete sets to 100%

### Rollback
- ✅ Rollback disables feature flag immediately
- ✅ Rollback creates audit record
- ✅ List rollbacks shows history

### Chaos Testing
- ✅ Latency injected randomly
- ✅ Errors thrown randomly
- ✅ Only works in dev/staging

## Troubleshooting

### Migration Errors
```bash
# Check migration status
npm run migrate:status

# If migrations fail, check database connection
# Ensure PostgreSQL is running
```

### Authentication Errors
- Ensure token is valid (not expired)
- Token format: `Bearer <token>`
- Check token in JWT decoder

### Feature Flag Not Found
- Ensure flag key is correct
- Check flag exists: `GET /api/v1/admin/feature-flags/:key`

### Canary Not Starting
- Ensure feature flag exists first
- Check feature flag is not archived
- Verify database migrations ran


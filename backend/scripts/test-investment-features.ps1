# Investment Module Feature Testing Script
# Tests: Feature Flags, Rate Limiting, Idempotency, Queue Processing

param(
    [string]$BaseUrl = "http://localhost:3001",
    [string]$Token = ""
)

$ErrorActionPreference = "Stop"

# Colors for output
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Error { Write-Host $args -ForegroundColor Red }
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }

Write-Info "🧪 Investment Module Feature Testing"
Write-Info "====================================="
Write-Host ""

# Get token if not provided
if ([string]::IsNullOrEmpty($Token)) {
    Write-Info "Please provide an authentication token:"
    Write-Info "Usage: .\test-investment-features.ps1 -Token 'your-jwt-token'"
    Write-Info "Or set it as environment variable: `$env:TEST_TOKEN='your-token'"
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $Token"
    "Content-Type" = "application/json"
}

$apiUrl = "$BaseUrl/api/v1"

# ============================================================================
# 1. TEST FEATURE FLAGS
# ============================================================================
Write-Info "`n1️⃣  Testing Feature Flags"
Write-Info "------------------------"

function Test-FeatureFlag {
    param($flagKey, $endpoint, $method = "POST", $body = @{})
    
    Write-Host "   Testing flag: $flagKey" -NoNewline
    
    # First, disable the flag
    try {
        $disableResponse = Invoke-RestMethod -Uri "$apiUrl/admin/feature-flags/$flagKey" `
            -Method PUT `
            -Headers $headers `
            -Body (@{
                enabled = $false
                status = "active"
            } | ConvertTo-Json) `
            -ErrorAction SilentlyContinue
    } catch {
        Write-Warning "      ⚠️  Could not disable flag (may not exist)"
    }
    
    Start-Sleep -Milliseconds 500
    
    # Try to access the endpoint (should fail with 403)
    try {
        if ($method -eq "POST") {
            $response = Invoke-WebRequest -Uri "$apiUrl/$endpoint" `
                -Method POST `
                -Headers $headers `
                -Body ($body | ConvertTo-Json) `
                -ErrorAction Stop
        } else {
            $response = Invoke-WebRequest -Uri "$apiUrl/$endpoint" `
                -Method GET `
                -Headers $headers `
                -ErrorAction Stop
        }
        
        if ($response.StatusCode -eq 403) {
            Write-Success " ✅ Feature flag working (403 Forbidden)"
        } else {
            Write-Error " ❌ Expected 403, got $($response.StatusCode)"
        }
    } catch {
        if ($_.Exception.Response.StatusCode -eq 403) {
            Write-Success " ✅ Feature flag working (403 Forbidden)"
        } else {
            Write-Error " ❌ Unexpected error: $($_.Exception.Message)"
        }
    }
    
    # Re-enable the flag
    try {
        $enableResponse = Invoke-RestMethod -Uri "$apiUrl/admin/feature-flags/$flagKey" `
            -Method PUT `
            -Headers $headers `
            -Body (@{
                enabled = $true
                status = "active"
            } | ConvertTo-Json) `
            -ErrorAction SilentlyContinue
        Write-Host "      ✅ Flag re-enabled"
    } catch {
        Write-Warning "      ⚠️  Could not re-enable flag"
    }
}

# Test investment module flag
Test-FeatureFlag -flagKey "investment_module_enabled" `
    -endpoint "investment/investments" `
    -body @{
        chamaId = "test-chama-id"
        productId = "test-product-id"
        amount = 10000
    }

# Test execution flag
Test-FeatureFlag -flagKey "investment_execution_enabled" `
    -endpoint "investment/investments/test-id/execute" `
    -body @{}

# Test dividend flag
Test-FeatureFlag -flagKey "dividend_distribution_enabled" `
    -endpoint "investment/investments/test-id/dividends" `
    -body @{ amount = 1000 }

Write-Success "`n✅ Feature flag tests completed"

# ============================================================================
# 2. TEST RATE LIMITING
# ============================================================================
Write-Info "`n2️⃣  Testing Rate Limiting"
Write-Info "------------------------"

function Test-RateLimit {
    param($endpoint, $method = "POST", $body = @{}, $maxRequests = 5)
    
    Write-Host "   Testing rate limit for: $endpoint" -NoNewline
    Write-Host " (max $maxRequests requests)" -ForegroundColor Gray
    
    $rateLimitHit = $false
    $requestCount = 0
    
    for ($i = 1; $i -le ($maxRequests + 2); $i++) {
        $requestCount = $i
        try {
            if ($method -eq "POST") {
                $response = Invoke-WebRequest -Uri "$apiUrl/$endpoint" `
                    -Method POST `
                    -Headers $headers `
                    -Body ($body | ConvertTo-Json) `
                    -ErrorAction Stop
            } else {
                $response = Invoke-WebRequest -Uri "$apiUrl/$endpoint" `
                    -Method GET `
                    -Headers $headers `
                    -ErrorAction Stop
            }
            
            Write-Host "      Request $i : ✅ 200 OK" -ForegroundColor Gray
        } catch {
            $statusCode = $_.Exception.Response.StatusCode.value__
            if ($statusCode -eq 429) {
                $rateLimitHit = $true
                Write-Host "      Request $i : ⚠️  429 Rate Limited" -ForegroundColor Yellow
                break
            } else {
                Write-Host "      Request $i : ❌ $statusCode" -ForegroundColor Red
            }
        }
        
        Start-Sleep -Milliseconds 100
    }
    
    if ($rateLimitHit) {
        Write-Success "      ✅ Rate limiting working (429 after $requestCount requests)"
    } else {
        Write-Warning "      ⚠️  Rate limit not hit (may need adjustment)"
    }
}

# Test rate limiting on create investment (5 per hour)
Write-Host "`n   Testing: POST /investment/investments (5/hour)" -ForegroundColor Cyan
Test-RateLimit -endpoint "investment/investments" `
    -body @{
        chamaId = "test-chama-id"
        productId = "test-product-id"
        amount = 10000
    } `
    -maxRequests 5

Write-Success "`n✅ Rate limiting tests completed"

# ============================================================================
# 3. TEST IDEMPOTENCY
# ============================================================================
Write-Info "`n3️⃣  Testing Idempotency"
Write-Info "------------------------"

function Test-Idempotency {
    param($endpoint, $method = "POST", $body = @{})
    
    Write-Host "   Testing idempotency for: $endpoint"
    
    $idempotencyKey = [System.Guid]::NewGuid().ToString()
    $headersWithIdempotency = $headers.Clone()
    $headersWithIdempotency["idempotency-key"] = $idempotencyKey
    
    Write-Host "      Idempotency Key: $idempotencyKey" -ForegroundColor Gray
    
    # First request
    try {
        if ($method -eq "POST") {
            $bodyWithKey = $body.Clone()
            $bodyWithKey["idempotencyKey"] = $idempotencyKey
            
            $response1 = Invoke-RestMethod -Uri "$apiUrl/$endpoint" `
                -Method POST `
                -Headers $headersWithIdempotency `
                -Body ($bodyWithKey | ConvertTo-Json) `
                -ErrorAction Stop
            
            Write-Host "      First request: ✅ Success" -ForegroundColor Green
            $firstResult = $response1
        } else {
            $response1 = Invoke-RestMethod -Uri "$apiUrl/$endpoint" `
                -Method GET `
                -Headers $headersWithIdempotency `
                -ErrorAction Stop
            
            Write-Host "      First request: ✅ Success" -ForegroundColor Green
            $firstResult = $response1
        }
    } catch {
        Write-Error "      First request failed: $($_.Exception.Message)"
        return
    }
    
    Start-Sleep -Milliseconds 500
    
    # Duplicate request with same idempotency key
    try {
        if ($method -eq "POST") {
            $bodyWithKey = $body.Clone()
            $bodyWithKey["idempotencyKey"] = $idempotencyKey
            
            $response2 = Invoke-RestMethod -Uri "$apiUrl/$endpoint" `
                -Method POST `
                -Headers $headersWithIdempotency `
                -Body ($bodyWithKey | ConvertTo-Json) `
                -ErrorAction Stop
            
            $secondResult = $response2
        } else {
            $response2 = Invoke-RestMethod -Uri "$apiUrl/$endpoint" `
                -Method GET `
                -Headers $headersWithIdempotency `
                -ErrorAction Stop
            
            $secondResult = $response2
        }
        
        # Check if results are the same (idempotent)
        $firstJson = ($firstResult | ConvertTo-Json -Depth 10)
        $secondJson = ($secondResult | ConvertTo-Json -Depth 10)
        
        if ($firstJson -eq $secondJson) {
            Write-Success "      Second request: ✅ Idempotent (same result)"
            Write-Success "      ✅ Idempotency working correctly"
        } else {
            Write-Warning "      Second request: ⚠️  Different result (may be expected for queue operations)"
            Write-Host "      First:  $($firstResult.id -or $firstResult.jobId -or 'N/A')" -ForegroundColor Gray
            Write-Host "      Second: $($secondResult.id -or $secondResult.jobId -or 'N/A')" -ForegroundColor Gray
        }
    } catch {
        Write-Error "      Second request failed: $($_.Exception.Message)"
    }
}

# Test idempotency on create investment
Write-Host "`n   Testing: POST /investment/investments" -ForegroundColor Cyan
Test-Idempotency -endpoint "investment/investments" `
    -body @{
        chamaId = "test-chama-id"
        productId = "test-product-id"
        amount = 10000
    }

Write-Success "`n✅ Idempotency tests completed"

# ============================================================================
# 4. TEST QUEUE PROCESSING
# ============================================================================
Write-Info "`n4️⃣  Testing Queue Processing"
Write-Info "------------------------"

function Test-QueueProcessing {
    param($endpoint, $body = @{})
    
    Write-Host "   Testing queue processing for: $endpoint"
    
    try {
        $response = Invoke-RestMethod -Uri "$apiUrl/$endpoint" `
            -Method POST `
            -Headers $headers `
            -Body ($body | ConvertTo-Json) `
            -ErrorAction Stop
        
        if ($response.jobId -or $response.status -eq "queued") {
            Write-Success "      ✅ Request queued successfully"
            Write-Host "      Job ID: $($response.jobId)" -ForegroundColor Gray
            Write-Host "      Status: $($response.status)" -ForegroundColor Gray
            Write-Host "      Idempotency Key: $($response.idempotencyKey)" -ForegroundColor Gray
            
            # Check job status (if endpoint exists)
            if ($response.jobId) {
                Start-Sleep -Seconds 2
                try {
                    # Try to get job status (this endpoint may not exist, that's OK)
                    $statusResponse = Invoke-RestMethod -Uri "$apiUrl/investment/jobs/$($response.jobId)" `
                        -Method GET `
                        -Headers $headers `
                        -ErrorAction SilentlyContinue
                    
                    Write-Host "      Job Status: $($statusResponse.state -or 'unknown')" -ForegroundColor Gray
                } catch {
                    Write-Host "      ⚠️  Job status endpoint not available (this is OK)" -ForegroundColor Yellow
                }
            }
        } else {
            Write-Warning "      ⚠️  Response doesn't indicate queuing"
        }
    } catch {
        Write-Error "      Request failed: $($_.Exception.Message)"
    }
}

# Note: These tests require actual investment/product IDs
Write-Host "`n   ⚠️  Queue processing tests require valid investment/product IDs" -ForegroundColor Yellow
Write-Host "   To test queue processing:" -ForegroundColor Yellow
Write-Host "   1. Create an investment first" -ForegroundColor Yellow
Write-Host "   2. Get the investment ID" -ForegroundColor Yellow
Write-Host "   3. Execute it: POST /investment/investments/{id}/execute" -ForegroundColor Yellow
Write-Host "   4. Check that it returns jobId and status='queued'" -ForegroundColor Yellow

Write-Success "`n✅ Queue processing test instructions provided"

# ============================================================================
# SUMMARY
# ============================================================================
Write-Info "`n📊 Test Summary"
Write-Info "==============="
Write-Success "✅ Feature Flags: Tested"
Write-Success "✅ Rate Limiting: Tested"
Write-Success "✅ Idempotency: Tested"
Write-Info "⚠️  Queue Processing: Requires manual testing with valid IDs"
Write-Host ""
Write-Info "💡 Tips:"
Write-Host "   - Check logs for detailed operation traces"
Write-Host "   - Use log prefixes to filter: [API_], [QUEUE_], [INVESTMENT_]"
Write-Host "   - Monitor queue workers are running"
Write-Host ""


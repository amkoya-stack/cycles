# Phase 3 Testing Script
# Tests Feature Flags, Canary Deployments, Rollbacks, and Chaos Testing

param(
    [string]$BaseUrl = "http://localhost:3001",
    [string]$Token = ""
)

Write-Host "[*] Phase 3 Feature Testing" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

if (-not $Token) {
    Write-Host "[-] Error: Please provide an access token" -ForegroundColor Red
    Write-Host "Usage: .\test-phase3.ps1 -Token 'your-jwt-token'" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To get a token:" -ForegroundColor Yellow
    Write-Host "1. Register/Login via API" -ForegroundColor Yellow
    Write-Host "2. Copy the accessToken from response" -ForegroundColor Yellow
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $Token"
    "Content-Type" = "application/json"
}

# Test 1: Feature Flags
Write-Host "[1] Test 1: Feature Flags" -ForegroundColor Green
Write-Host "----------------------" -ForegroundColor Green

# Create a test feature flag
Write-Host "Creating test feature flag..." -ForegroundColor Yellow
$flagBody = @{
    key = "test_new_payment_flow"
    name = "Test New Payment Flow"
    description = "Testing feature flags system"
    type = "boolean"
    enabled = $true
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/v1/admin/feature-flags" `
        -Method POST `
        -Headers $headers `
        -Body $flagBody
    Write-Host "[+] Feature flag created: $($response.key)" -ForegroundColor Green
    Write-Host "   ID: $($response.id)" -ForegroundColor Gray
    Write-Host "   Status: $($response.status)" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "[-] Failed to create feature flag: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

# List all flags
Write-Host "Listing all feature flags..." -ForegroundColor Yellow
try {
    $flags = Invoke-RestMethod -Uri "$BaseUrl/api/v1/admin/feature-flags" `
        -Method GET `
        -Headers $headers
    Write-Host "[+] Found $($flags.Count) feature flags" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "[-] Failed to list flags: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

# Check flag status
Write-Host "Checking flag status..." -ForegroundColor Yellow
try {
    $check = Invoke-RestMethod -Uri "$BaseUrl/api/v1/admin/feature-flags/test_new_payment_flow/check?userId=test-user-123" `
        -Method GET `
        -Headers $headers
    Write-Host "[+] Flag check result:" -ForegroundColor Green
    Write-Host "   Key: $($check.key)" -ForegroundColor Gray
    Write-Host "   Enabled: $($check.enabled)" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "❌ Failed to check flag: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

# Test 2: Canary Deployment
Write-Host "[2] Test 2: Canary Deployment" -ForegroundColor Green
Write-Host "------------------------" -ForegroundColor Green

# Start canary deployment
Write-Host "Starting canary deployment..." -ForegroundColor Yellow
$canaryBody = @{
    featureKey = "test_new_payment_flow"
    version = "v2"
    initialPercentage = 5
    rollbackThreshold = 5
} | ConvertTo-Json

try {
    $canary = Invoke-RestMethod -Uri "$BaseUrl/api/v1/admin/canary-deployments" `
        -Method POST `
        -Headers $headers `
        -Body $canaryBody
    Write-Host "[+] Canary deployment started:" -ForegroundColor Green
    Write-Host "   Feature: $($canary.featureKey)" -ForegroundColor Gray
    Write-Host "   Version: $($canary.version)" -ForegroundColor Gray
    Write-Host "   Percentage: $($canary.percentage)%" -ForegroundColor Gray
    Write-Host "   Status: $($canary.status)" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "[-] Failed to start canary: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

# Get canary status
Write-Host "Getting canary status..." -ForegroundColor Yellow
try {
    $canaryStatus = Invoke-RestMethod -Uri "$BaseUrl/api/v1/admin/canary-deployments/test_new_payment_flow" `
        -Method GET `
        -Headers $headers
    Write-Host "[+] Canary status:" -ForegroundColor Green
    Write-Host "   Percentage: $($canaryStatus.percentage)%" -ForegroundColor Gray
    Write-Host "   Metrics:" -ForegroundColor Gray
    Write-Host "     - Total Requests: $($canaryStatus.metrics.totalRequests)" -ForegroundColor Gray
    Write-Host "     - Success: $($canaryStatus.metrics.successCount)" -ForegroundColor Gray
    Write-Host "     - Errors: $($canaryStatus.metrics.errorCount)" -ForegroundColor Gray
    Write-Host "     - Error Rate: $($canaryStatus.metrics.errorRate)%" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "[-] Failed to get canary status: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

# Test 3: Rollback
Write-Host "[3] Test 3: Instant Rollback" -ForegroundColor Green
Write-Host "-------------------------" -ForegroundColor Green

# Rollback feature flag
Write-Host "Rolling back feature flag..." -ForegroundColor Yellow
$rollbackBody = @{
    featureKey = "test_new_payment_flow"
    reason = "Testing rollback functionality"
} | ConvertTo-Json

try {
    $rollback = Invoke-RestMethod -Uri "$BaseUrl/api/v1/admin/rollbacks/feature-flag" `
        -Method POST `
        -Headers $headers `
        -Body $rollbackBody
    Write-Host "[+] Rollback completed:" -ForegroundColor Green
    Write-Host "   Type: $($rollback.type)" -ForegroundColor Gray
    Write-Host "   Target: $($rollback.targetId)" -ForegroundColor Gray
    Write-Host "   Status: $($rollback.status)" -ForegroundColor Gray
    Write-Host "   Reason: $($rollback.reason)" -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "[-] Failed to rollback: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

# List rollbacks
Write-Host "Listing recent rollbacks..." -ForegroundColor Yellow
try {
    $rollbacks = Invoke-RestMethod -Uri "$BaseUrl/api/v1/admin/rollbacks?limit=10" `
        -Method GET `
        -Headers $headers
    Write-Host "[+] Found $($rollbacks.Count) rollback records" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "[-] Failed to list rollbacks: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

# Test 4: Verify flag is disabled
Write-Host "[4] Test 4: Verify Rollback" -ForegroundColor Green
Write-Host "------------------------" -ForegroundColor Green

Write-Host "Checking if flag is disabled after rollback..." -ForegroundColor Yellow
try {
    $flag = Invoke-RestMethod -Uri "$BaseUrl/api/v1/admin/feature-flags/test_new_payment_flow" `
        -Method GET `
        -Headers $headers
    if ($flag.enabled -eq $false) {
        Write-Host "[+] Feature flag is correctly disabled" -ForegroundColor Green
    } else {
        Write-Host "[!] Feature flag is still enabled (rollback may not have worked)" -ForegroundColor Yellow
    }
    Write-Host ""
} catch {
    Write-Host "❌ Failed to check flag: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

Write-Host "[+] Phase 3 Testing Complete!" -ForegroundColor Cyan
Write-Host ""
Write-Host "Note: Chaos testing requires:" -ForegroundColor Yellow
Write-Host "  1. CHAOS_TESTING_ENABLED=true in .env" -ForegroundColor Yellow
Write-Host "  2. NODE_ENV=development (not production)" -ForegroundColor Yellow
Write-Host "  3. Chaos rules added via database or service" -ForegroundColor Yellow


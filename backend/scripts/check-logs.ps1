# Script to check for structured logging in backend logs
# Usage: .\scripts\check-logs.ps1

Write-Host "`n=== Checking for Structured Logging ===" -ForegroundColor Cyan
Write-Host ""

# Check if log file exists
$logFile = "logs/app.log"
if (Test-Path $logFile) {
    Write-Host "✅ Found log file: $logFile" -ForegroundColor Green
    Write-Host ""
    
    # Check for investment-related log prefixes
    Write-Host "Searching for log prefixes..." -ForegroundColor Yellow
    
    $prefixes = @(
        "[API_CREATE_INVESTMENT]",
        "[API_EXECUTE_INVESTMENT]",
        "[API_DISTRIBUTE_DIVIDEND]",
        "[INVESTMENT_CREATE]",
        "[INVESTMENT_EXECUTE]",
        "[QUEUE_EXECUTE_INVESTMENT]",
        "[QUEUE_DISTRIBUTE_DIVIDEND]",
        "[DIVIDEND_DISTRIBUTE]",
        "[IDEMPOTENCY]"
    )
    
    foreach ($prefix in $prefixes) {
        $count = (Select-String -Path $logFile -Pattern $prefix -ErrorAction SilentlyContinue | Measure-Object).Count
        if ($count -gt 0) {
            Write-Host "  ✅ $prefix : Found $count occurrences" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  $prefix : Not found" -ForegroundColor Yellow
        }
    }
    
    Write-Host ""
    Write-Host "Recent investment-related logs (last 10):" -ForegroundColor Cyan
    Select-String -Path $logFile -Pattern "\[(API_|INVESTMENT_|QUEUE_|IDEMPOTENCY)" -ErrorAction SilentlyContinue | Select-Object -Last 10 | ForEach-Object {
        Write-Host "  $($_.Line)" -ForegroundColor Gray
    }
} else {
    Write-Host "⚠️  Log file not found: $logFile" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "If using console logging, check your backend server console output." -ForegroundColor Yellow
    Write-Host "Look for log prefixes like:" -ForegroundColor Yellow
    Write-Host "  [API_CREATE_INVESTMENT] Request received - userId: ..." -ForegroundColor Gray
    Write-Host "  [INVESTMENT_CREATE] Starting investment creation - ..." -ForegroundColor Gray
    Write-Host "  [QUEUE_EXECUTE_INVESTMENT] Processing investment execution job - ..." -ForegroundColor Gray
}

Write-Host ""
Write-Host "✅ Log check complete" -ForegroundColor Green


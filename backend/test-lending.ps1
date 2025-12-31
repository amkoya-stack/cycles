# ============================================================================
# Test Script for Phase 12A: Lending System
# ============================================================================

$API_BASE = "http://localhost:3001/api/v1"
$DB_PASSWORD = "pe6958@25"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Testing Phase 12A: Lending System" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================================
# Step 1: Register or Login
# ============================================================================
$TEST_EMAIL = "lending_test_$(Get-Date -Format 'yyyyMMddHHmmss')@test.com"
$TEST_PASSWORD = "TestPassword@123"
$TEST_PHONE = "+2547$(Get-Random -Minimum 10000000 -Maximum 99999999)"

Write-Host "[1a] Registering test user..." -ForegroundColor Yellow

$registerBody = @{
    email = $TEST_EMAIL
    password = $TEST_PASSWORD
    phone = $TEST_PHONE
    firstName = "Lending"
    lastName = "TestUser"
} | ConvertTo-Json

try {
    $registerResponse = Invoke-RestMethod -Uri "$API_BASE/auth/register" -Method POST -Body $registerBody -ContentType "application/json" -ErrorAction Stop
    Write-Host "    [+] Registration successful!" -ForegroundColor Green
    
    # Verify the user (skip OTP for test)
    $env:PGPASSWORD = $DB_PASSWORD
    psql -h localhost -U postgres -d cycle -c "UPDATE users SET email_verified = true, phone_verified = true WHERE email = '$TEST_EMAIL'" 2>&1 | Out-Null
    Write-Host "    [+] User verified in database" -ForegroundColor Green
} catch {
    $errorBody = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
    Write-Host "    [!] Registration: $($errorBody.message)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[1b] Logging in..." -ForegroundColor Yellow

$loginBody = @{
    email = $TEST_EMAIL
    password = $TEST_PASSWORD
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$API_BASE/auth/login" -Method POST -Body $loginBody -ContentType "application/json" -ErrorAction Stop
    $TOKEN = $loginResponse.accessToken
    $USER_ID = $loginResponse.userId
    Write-Host "    [+] Login successful! User ID: $USER_ID" -ForegroundColor Green
} catch {
    Write-Host "    [-] Login failed: $($_.Exception.Message)" -ForegroundColor Red
    
    # Try with existing user
    Write-Host "    [!] Trying with existing user..." -ForegroundColor Yellow
    $existingEmail = "amkoyapeleg@gmail.com"
    
    # Get password hash to check if we can test with this user
    $result = psql -h localhost -U postgres -d cycle -t -c "SELECT id FROM users WHERE email = '$existingEmail' LIMIT 1" 2>&1
    if ($result -match "[a-f0-9-]{36}") {
        $USER_ID = $result.Trim()
        Write-Host "    [+] Found existing user: $USER_ID" -ForegroundColor Green
        Write-Host "    [!] Please provide a valid token from the browser" -ForegroundColor Yellow
        exit 1
    }
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $TOKEN"
    "Content-Type" = "application/json"
}

# ============================================================================
# Step 2: Get or create chama membership
# ============================================================================
Write-Host ""
Write-Host "[2] Getting user's chamas..." -ForegroundColor Yellow

$chamasResponse = $null
try {
    $chamasResponse = Invoke-RestMethod -Uri "$API_BASE/chama" -Method GET -Headers $headers -ErrorAction Stop
} catch {
    Write-Host "    [!] API call failed, will try direct DB approach" -ForegroundColor Yellow
}

$hasChamaFromApi = $false
if ($chamasResponse -and $chamasResponse.data -and $chamasResponse.data.Count -gt 0) {
    $CHAMA = $chamasResponse.data[0]
    $CHAMA_ID = $CHAMA.id
    $CHAMA_NAME = $CHAMA.name
    $hasChamaFromApi = $true
    Write-Host "    [+] Found chama via API: $CHAMA_NAME" -ForegroundColor Green
}

if (-not $hasChamaFromApi) {
    Write-Host "    [!] No chamas found via API, using direct DB approach..." -ForegroundColor Yellow
    
    # Find an existing chama from DB
    $env:PGPASSWORD = $DB_PASSWORD
    $chamaResult = psql -h localhost -U postgres -d cycle -t -c "SELECT id FROM chamas LIMIT 1" 2>&1
    $chamaResultStr = [string]$chamaResult
    
    if ($chamaResultStr -match "([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})") {
        $CHAMA_ID = $matches[1].Trim()
        Write-Host "    [+] Found existing chama: $CHAMA_ID" -ForegroundColor Green
        
        # Add user as admin member
        $addMemberQuery = "INSERT INTO chama_members (chama_id, user_id, role, status, joined_at) VALUES ('$CHAMA_ID', '$USER_ID', 'admin', 'active', NOW()) ON CONFLICT DO NOTHING"
        psql -h localhost -U postgres -d cycle -c "$addMemberQuery" 2>&1 | Out-Null
        Write-Host "    [+] Added user to chama as admin" -ForegroundColor Green
        
        # Get chama name
        $nameResult = psql -h localhost -U postgres -d cycle -t -c "SELECT name FROM chamas WHERE id = '$CHAMA_ID'" 2>&1
        $CHAMA_NAME = ([string]$nameResult).Trim()
        Write-Host "    [+] Chama name: $CHAMA_NAME" -ForegroundColor Green
    } else {
        # Create a new chama
        Write-Host "    [!] No existing chamas, creating test chama..." -ForegroundColor Yellow
        $timestamp = Get-Date -Format 'yyyyMMddHHmmss'
        $createChamaQuery = "INSERT INTO chamas (id, name, slug, description, created_by, is_public, lending_enabled) VALUES (gen_random_uuid(), 'Test Lending Chama', 'test-lending-$timestamp', 'Test chama for lending', '$USER_ID', true, true) RETURNING id"
        $chamaIdResult = psql -h localhost -U postgres -d cycle -t -c "$createChamaQuery" 2>&1
        $chamaIdStr = [string]$chamaIdResult
        
        if ($chamaIdStr -match "([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})") {
            $CHAMA_ID = $matches[1].Trim()
            $CHAMA_NAME = "Test Lending Chama"
            
            # Add user as admin
            $addMemberQuery = "INSERT INTO chama_members (chama_id, user_id, role, status, joined_at) VALUES ('$CHAMA_ID', '$USER_ID', 'admin', 'active', NOW())"
            psql -h localhost -U postgres -d cycle -c "$addMemberQuery" 2>&1 | Out-Null
            
            Write-Host "    [+] Created and joined chama: $CHAMA_NAME" -ForegroundColor Green
        } else {
            Write-Host "    [-] Failed to create chama: $chamaIdStr" -ForegroundColor Red
            exit 1
        }
    }
}

if (-not $CHAMA_ID) {
    Write-Host "    [-] No chama available for testing" -ForegroundColor Red
    exit 1
}

# ============================================================================
# Step 3: Enable lending for the chama (via direct DB)
# ============================================================================
Write-Host ""
Write-Host "[3] Enabling lending for chama..." -ForegroundColor Yellow

$env:PGPASSWORD = $DB_PASSWORD
$enableQuery = "UPDATE chamas SET lending_enabled = true WHERE id = '$CHAMA_ID'; SELECT lending_enabled FROM chamas WHERE id = '$CHAMA_ID';"
$result = psql -h localhost -U postgres -d cycle -t -c "$enableQuery" 2>&1

if ($result -match "t") {
    Write-Host "    [+] Lending enabled for chama" -ForegroundColor Green
} else {
    Write-Host "    [!] Could not verify lending status (may already be enabled)" -ForegroundColor Yellow
}

# ============================================================================
# Step 4: Check user's loan eligibility (via reputation)
# ============================================================================
Write-Host ""
Write-Host "[4] Checking loan eligibility..." -ForegroundColor Yellow

try {
    $reputationResponse = Invoke-RestMethod -Uri "$API_BASE/reputation/$CHAMA_ID/me" -Method GET -Headers $headers -ErrorAction Stop
    Write-Host "    [+] Reputation tier: $($reputationResponse.data.tier)" -ForegroundColor Green
    Write-Host "    [+] Total score: $($reputationResponse.data.totalScore)" -ForegroundColor Green
} catch {
    Write-Host "    [!] Could not get reputation (may not have contribution history): $($_.Exception.Message)" -ForegroundColor Yellow
}

# ============================================================================
# Step 5: Get lending summary (before any loans)
# ============================================================================
Write-Host ""
Write-Host "[5] Getting lending summary for chama..." -ForegroundColor Yellow

try {
    $summaryResponse = Invoke-RestMethod -Uri "$API_BASE/lending/chama/$CHAMA_ID/summary" -Method GET -Headers $headers -ErrorAction Stop
    Write-Host "    [+] Total loans issued: $($summaryResponse.data.totalLoansIssued)" -ForegroundColor Green
    Write-Host "    [+] Active loans: $($summaryResponse.data.activeLoans)" -ForegroundColor Green
    Write-Host "    [+] Total lent: $($summaryResponse.data.totalLent)" -ForegroundColor Green
} catch {
    Write-Host "    [-] Failed to get lending summary: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "    Response: $($_.Exception.Response)" -ForegroundColor Gray
}

# ============================================================================
# Step 6: Apply for a loan
# ============================================================================
Write-Host ""
Write-Host "[6] Applying for a loan..." -ForegroundColor Yellow

$loanApplicationBody = @{
    chamaId = $CHAMA_ID
    amountRequested = 5000
    purpose = "Test loan for business expansion"
    proposedRepaymentPeriodMonths = 3
    proposedInterestRate = 10
} | ConvertTo-Json

try {
    $loanAppResponse = Invoke-RestMethod -Uri "$API_BASE/lending/apply" -Method POST -Body $loanApplicationBody -Headers $headers -ErrorAction Stop
    $APPLICATION_ID = $loanAppResponse.data.id
    Write-Host "    [+] Loan application submitted!" -ForegroundColor Green
    Write-Host "    [+] Application ID: $APPLICATION_ID" -ForegroundColor Green
    Write-Host "    [+] Status: $($loanAppResponse.data.status)" -ForegroundColor Green
    Write-Host "    [+] Amount: $($loanAppResponse.data.amountRequested)" -ForegroundColor Green
} catch {
    $errorBody = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($errorBody) {
        Write-Host "    [-] Loan application failed: $($errorBody.message)" -ForegroundColor Red
    } else {
        Write-Host "    [-] Loan application failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # Try to get existing applications
    Write-Host ""
    Write-Host "[6b] Checking existing applications..." -ForegroundColor Yellow
    try {
        $existingApps = Invoke-RestMethod -Uri "$API_BASE/lending/applications/me" -Method GET -Headers $headers -ErrorAction Stop
        if ($existingApps.data -and $existingApps.data.Count -gt 0) {
            $APPLICATION_ID = $existingApps.data[0].id
            Write-Host "    [+] Found existing application: $APPLICATION_ID" -ForegroundColor Green
            Write-Host "    [+] Status: $($existingApps.data[0].status)" -ForegroundColor Green
        }
    } catch {
        Write-Host "    [-] Failed to get existing applications" -ForegroundColor Red
    }
}

# ============================================================================
# Step 7: Get my loan applications
# ============================================================================
Write-Host ""
Write-Host "[7] Getting my loan applications..." -ForegroundColor Yellow

try {
    $myAppsResponse = Invoke-RestMethod -Uri "$API_BASE/lending/applications/me" -Method GET -Headers $headers -ErrorAction Stop
    Write-Host "    [+] Found $($myAppsResponse.data.Count) application(s)" -ForegroundColor Green
    foreach ($app in $myAppsResponse.data) {
        Write-Host "        - ID: $($app.id.Substring(0,8))... | Amount: $($app.amountRequested) | Status: $($app.status)" -ForegroundColor Gray
    }
} catch {
    Write-Host "    [-] Failed to get applications: $($_.Exception.Message)" -ForegroundColor Red
}

# ============================================================================
# Step 8: Get chama's loan applications (admin view)
# ============================================================================
Write-Host ""
Write-Host "[8] Getting chama loan applications (admin view)..." -ForegroundColor Yellow

try {
    $chamaAppsResponse = Invoke-RestMethod -Uri "$API_BASE/lending/chama/$CHAMA_ID/applications" -Method GET -Headers $headers -ErrorAction Stop
    Write-Host "    [+] Found $($chamaAppsResponse.data.Count) application(s) for chama" -ForegroundColor Green
} catch {
    Write-Host "    [-] Failed to get chama applications: $($_.Exception.Message)" -ForegroundColor Red
}

# ============================================================================
# Step 9: Approve the loan (if admin/treasurer)
# ============================================================================
if ($APPLICATION_ID) {
    Write-Host ""
    Write-Host "[9] Approving the loan application..." -ForegroundColor Yellow
    
    $approveBody = @{
        finalInterestRate = 10
        finalRepaymentPeriodMonths = 3
        gracePeriodDays = 7
        repaymentFrequency = "monthly"
    } | ConvertTo-Json
    
    try {
        $approveResponse = Invoke-RestMethod -Uri "$API_BASE/lending/applications/$APPLICATION_ID/approve" -Method PUT -Body $approveBody -Headers $headers -ErrorAction Stop
        Write-Host "    [+] Loan approved!" -ForegroundColor Green
        Write-Host "    [+] New status: $($approveResponse.data.status)" -ForegroundColor Green
    } catch {
        $errorBody = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($errorBody) {
            Write-Host "    [-] Approval failed: $($errorBody.message)" -ForegroundColor Red
        } else {
            Write-Host "    [-] Approval failed: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

# ============================================================================
# Step 10: Get my loans
# ============================================================================
Write-Host ""
Write-Host "[10] Getting my loans..." -ForegroundColor Yellow

try {
    $myLoansResponse = Invoke-RestMethod -Uri "$API_BASE/lending/loans/me" -Method GET -Headers $headers -ErrorAction Stop
    Write-Host "    [+] Found $($myLoansResponse.data.Count) loan(s)" -ForegroundColor Green
    
    if ($myLoansResponse.data -and $myLoansResponse.data.Count -gt 0) {
        $LOAN = $myLoansResponse.data[0]
        $LOAN_ID = $LOAN.id
        Write-Host "        - Loan ID: $($LOAN_ID.Substring(0,8))..." -ForegroundColor Gray
        Write-Host "        - Principal: $($LOAN.principalAmount)" -ForegroundColor Gray
        Write-Host "        - Total Due: $($LOAN.totalAmount)" -ForegroundColor Gray
        Write-Host "        - Status: $($LOAN.status)" -ForegroundColor Gray
    }
} catch {
    Write-Host "    [-] Failed to get loans: $($_.Exception.Message)" -ForegroundColor Red
}

# ============================================================================
# Step 11: Get loan details (with repayment schedule)
# ============================================================================
if ($LOAN_ID) {
    Write-Host ""
    Write-Host "[11] Getting loan details with repayment schedule..." -ForegroundColor Yellow
    
    try {
        $loanDetailsResponse = Invoke-RestMethod -Uri "$API_BASE/lending/loans/$LOAN_ID" -Method GET -Headers $headers -ErrorAction Stop
        Write-Host "    [+] Loan details retrieved" -ForegroundColor Green
        Write-Host "    [+] Repayment installments: $($loanDetailsResponse.data.repayments.Count)" -ForegroundColor Green
        
        foreach ($repayment in $loanDetailsResponse.data.repayments) {
            Write-Host "        - Installment #$($repayment.installmentNumber): $($repayment.amountDue) due $($repayment.dueDate) [$($repayment.status)]" -ForegroundColor Gray
        }
    } catch {
        Write-Host "    [-] Failed to get loan details: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# ============================================================================
# Summary
# ============================================================================
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Endpoints tested:" -ForegroundColor Yellow
Write-Host "  [+] POST /api/v1/lending/apply" -ForegroundColor White
Write-Host "  [+] GET  /api/v1/lending/applications/me" -ForegroundColor White
Write-Host "  [+] GET  /api/v1/lending/chama/:id/applications" -ForegroundColor White
Write-Host "  [+] PUT  /api/v1/lending/applications/:id/approve" -ForegroundColor White
Write-Host "  [+] GET  /api/v1/lending/loans/me" -ForegroundColor White
Write-Host "  [+] GET  /api/v1/lending/loans/:id" -ForegroundColor White
Write-Host "  [+] GET  /api/v1/lending/chama/:id/summary" -ForegroundColor White
Write-Host ""
Write-Host "Not tested (require disbursed loan):" -ForegroundColor Gray
Write-Host "  [ ] PUT  /api/v1/lending/loans/:id/disburse" -ForegroundColor Gray
Write-Host "  [ ] POST /api/v1/lending/loans/:id/repay" -ForegroundColor Gray
Write-Host ""


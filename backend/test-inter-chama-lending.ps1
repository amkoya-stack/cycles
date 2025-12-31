# ============================================================================
# Test Script for Phase 12C: Inter-Chama Lending System
# ============================================================================

$API_BASE = "http://localhost:3001/api/v1"
$DB_PASSWORD = "pe6958@25"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Testing Phase 12C: Inter-Chama Lending" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================================
# Step 1: Setup - Create two chamas with admins
# ============================================================================
Write-Host "[1] Setting up two chamas for testing..." -ForegroundColor Yellow

# Chama 1 (Requesting Chama)
$chama1AdminEmail = "chama1_admin_$(Get-Date -Format 'yyyyMMddHHmmss')@test.com"
$chama1AdminPassword = "TestPassword@123"
$chama1AdminPhone = "+2547$(Get-Random -Minimum 10000000 -Maximum 99999999)"

$chama1RegisterBody = @{
    email = $chama1AdminEmail
    password = $chama1AdminPassword
    phone = $chama1AdminPhone
    firstName = "Chama1"
    lastName = "Admin"
} | ConvertTo-Json

try {
    $chama1RegisterResponse = Invoke-RestMethod -Uri "$API_BASE/auth/register" -Method POST -Body $chama1RegisterBody -ContentType "application/json" -ErrorAction Stop
    Write-Host "    [+] Chama 1 admin registered" -ForegroundColor Green
    
    $env:PGPASSWORD = $DB_PASSWORD
    psql -h localhost -U postgres -d cycle -c "UPDATE users SET email_verified = true, phone_verified = true WHERE email = '$chama1AdminEmail'" 2>&1 | Out-Null
} catch {
    Write-Host "    [!] Chama 1 registration: $($_.Exception.Message)" -ForegroundColor Yellow
}

$chama1LoginBody = @{
    email = $chama1AdminEmail
    password = $chama1AdminPassword
} | ConvertTo-Json

try {
    $chama1LoginResponse = Invoke-RestMethod -Uri "$API_BASE/auth/login" -Method POST -Body $chama1LoginBody -ContentType "application/json" -ErrorAction Stop
    $CHAMA1_ADMIN_TOKEN = $chama1LoginResponse.accessToken
    $CHAMA1_ADMIN_ID = $chama1LoginResponse.userId
    Write-Host "    [+] Chama 1 admin logged in: $CHAMA1_ADMIN_ID" -ForegroundColor Green
} catch {
    Write-Host "    [-] Chama 1 login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$chama1Headers = @{
    "Authorization" = "Bearer $CHAMA1_ADMIN_TOKEN"
    "Content-Type" = "application/json"
}

# Chama 2 (Lending Chama)
$chama2AdminEmail = "chama2_admin_$(Get-Date -Format 'yyyyMMddHHmmss')@test.com"
$chama2AdminPassword = "TestPassword@123"
$chama2AdminPhone = "+2547$(Get-Random -Minimum 10000000 -Maximum 99999999)"

$chama2RegisterBody = @{
    email = $chama2AdminEmail
    password = $chama2AdminPassword
    phone = $chama2AdminPhone
    firstName = "Chama2"
    lastName = "Admin"
} | ConvertTo-Json

try {
    $chama2RegisterResponse = Invoke-RestMethod -Uri "$API_BASE/auth/register" -Method POST -Body $chama2RegisterBody -ContentType "application/json" -ErrorAction Stop
    Write-Host "    [+] Chama 2 admin registered" -ForegroundColor Green
    
    psql -h localhost -U postgres -d cycle -c "UPDATE users SET email_verified = true, phone_verified = true WHERE email = '$chama2AdminEmail'" 2>&1 | Out-Null
} catch {
    Write-Host "    [!] Chama 2 registration: $($_.Exception.Message)" -ForegroundColor Yellow
}

$chama2LoginBody = @{
    email = $chama2AdminEmail
    password = $chama2AdminPassword
} | ConvertTo-Json

try {
    $chama2LoginResponse = Invoke-RestMethod -Uri "$API_BASE/auth/login" -Method POST -Body $chama2LoginBody -ContentType "application/json" -ErrorAction Stop
    $CHAMA2_ADMIN_TOKEN = $chama2LoginResponse.accessToken
    $CHAMA2_ADMIN_ID = $chama2LoginResponse.userId
    Write-Host "    [+] Chama 2 admin logged in: $CHAMA2_ADMIN_ID" -ForegroundColor Green
} catch {
    Write-Host "    [-] Chama 2 login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$chama2Headers = @{
    "Authorization" = "Bearer $CHAMA2_ADMIN_TOKEN"
    "Content-Type" = "application/json"
}

# ============================================================================
# Step 2: Create or get chamas
# ============================================================================
Write-Host ""
Write-Host "[2] Creating/getting chamas..." -ForegroundColor Yellow

$env:PGPASSWORD = $DB_PASSWORD

# Create Chama 1
$timestamp1 = Get-Date -Format 'yyyyMMddHHmmss'
$createChama1Query = "INSERT INTO chamas (id, name, description, admin_user_id, contribution_amount, contribution_frequency, lending_enabled, external_lending_enabled, inter_chama_lending_enabled) VALUES (gen_random_uuid(), 'Requesting Chama', 'Test chama for requesting loans', '$CHAMA1_ADMIN_ID', 1000, 'monthly', true, true, true) RETURNING id"
$chama1IdResult = psql -h localhost -U postgres -d cycle -t -A -c "$createChama1Query" 2>&1
$chama1IdStr = [string]$chama1IdResult

if ($chama1IdStr -match "([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})") {
    $CHAMA1_ID = $matches[1].Trim()
    Write-Host "    [+] Created Chama 1: $CHAMA1_ID" -ForegroundColor Green
    
    $addMember1Query = "INSERT INTO chama_members (chama_id, user_id, role, status, joined_at) VALUES ('$CHAMA1_ID', '$CHAMA1_ADMIN_ID', 'admin', 'active', NOW()) ON CONFLICT DO NOTHING"
    psql -h localhost -U postgres -d cycle -c "$addMember1Query" 2>&1 | Out-Null
} else {
    Write-Host "    [-] Failed to create Chama 1. Output: $chama1IdStr" -ForegroundColor Red
    exit 1
}

# Create Chama 2
$timestamp2 = Get-Date -Format 'yyyyMMddHHmmss'
$createChama2Query = "INSERT INTO chamas (id, name, description, admin_user_id, contribution_amount, contribution_frequency, lending_enabled, external_lending_enabled, inter_chama_lending_enabled) VALUES (gen_random_uuid(), 'Lending Chama', 'Test chama for lending to others', '$CHAMA2_ADMIN_ID', 1000, 'monthly', true, true, true) RETURNING id"
$chama2IdResult = psql -h localhost -U postgres -d cycle -t -A -c "$createChama2Query" 2>&1
$chama2IdStr = [string]$chama2IdResult

if ($chama2IdStr -match "([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})") {
    $CHAMA2_ID = $matches[1].Trim()
    Write-Host "    [+] Created Chama 2: $CHAMA2_ID" -ForegroundColor Green
    
    $addMember2Query = "INSERT INTO chama_members (chama_id, user_id, role, status, joined_at) VALUES ('$CHAMA2_ID', '$CHAMA2_ADMIN_ID', 'admin', 'active', NOW()) ON CONFLICT DO NOTHING"
    psql -h localhost -U postgres -d cycle -c "$addMember2Query" 2>&1 | Out-Null
} else {
    Write-Host "    [-] Failed to create Chama 2. Output: $chama2IdStr" -ForegroundColor Red
    exit 1
}

# ============================================================================
# Step 3: Create inter-chama loan request
# ============================================================================
Write-Host ""
Write-Host "[3] Creating inter-chama loan request..." -ForegroundColor Yellow

$requestBody = @{
    requestingChamaId = $CHAMA1_ID
    lendingChamaId = $CHAMA2_ID
    amountRequested = 100000
    purpose = "Expanding our chama operations and member services"
    proposedInterestRate = 10
    proposedRepaymentPeriodMonths = 6
    proposedCollateral = "Future contributions from our 50 active members"
    collateralValue = 200000
} | ConvertTo-Json

try {
    $requestResponse = Invoke-RestMethod -Uri "$API_BASE/lending/inter-chama/requests" -Method POST -Body $requestBody -Headers $chama1Headers -ErrorAction Stop
    $REQUEST_ID = $requestResponse.data.id
    Write-Host "    [+] Loan request created!" -ForegroundColor Green
    Write-Host "        - ID: $($REQUEST_ID.Substring(0,8))..." -ForegroundColor Gray
    Write-Host "        - Amount: $($requestResponse.data.amountRequested)" -ForegroundColor Gray
    Write-Host "        - Status: $($requestResponse.data.status)" -ForegroundColor Gray
    Write-Host "        - From: Chama 1 -> To: Chama 2" -ForegroundColor Gray
} catch {
    $errorBody = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($errorBody) {
        Write-Host "    [-] Failed: $($errorBody.message)" -ForegroundColor Red
    } else {
        Write-Host "    [-] Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    exit 1
}

# ============================================================================
# Step 4: Get loan requests for both chamas
# ============================================================================
Write-Host ""
Write-Host "[4] Getting loan requests for Chama 1 (as requesting)..." -ForegroundColor Yellow

try {
    $chama1RequestsResponse = Invoke-RestMethod -Uri "$API_BASE/lending/inter-chama/chama/$CHAMA1_ID/requests?role=requesting" -Method GET -Headers $chama1Headers -ErrorAction Stop
    Write-Host "    [+] Found $($chama1RequestsResponse.data.Count) request(s) as requesting chama" -ForegroundColor Green
} catch {
    Write-Host "    [-] Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "[4b] Getting loan requests for Chama 2 (as lending)..." -ForegroundColor Yellow

try {
    $chama2RequestsResponse = Invoke-RestMethod -Uri "$API_BASE/lending/inter-chama/chama/$CHAMA2_ID/requests?role=lending" -Method GET -Headers $chama2Headers -ErrorAction Stop
    Write-Host "    [+] Found $($chama2RequestsResponse.data.Count) request(s) as lending chama" -ForegroundColor Green
} catch {
    Write-Host "    [-] Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# ============================================================================
# Step 5: Negotiate terms (from lending chama)
# ============================================================================
Write-Host ""
Write-Host "[5] Negotiating terms (lending chama)..." -ForegroundColor Yellow

$negotiateBody = @{
    finalInterestRate = 12
    finalRepaymentPeriodMonths = 6
    finalCollateral = "Future contributions from 50 active members (verified)"
    finalCollateralValue = 200000
    notes = "Agreed to 12% interest rate with 6-month repayment period"
} | ConvertTo-Json

try {
    $negotiateResponse = Invoke-RestMethod -Uri "$API_BASE/lending/inter-chama/requests/$REQUEST_ID/negotiate" -Method PUT -Body $negotiateBody -Headers $chama2Headers -ErrorAction Stop
    Write-Host "    [+] Terms negotiated!" -ForegroundColor Green
    Write-Host "        - Final interest rate: $($negotiateResponse.data.finalInterestRate)%" -ForegroundColor Gray
    Write-Host "        - Final period: $($negotiateResponse.data.finalRepaymentPeriodMonths) months" -ForegroundColor Gray
    Write-Host "        - Status: $($negotiateResponse.data.status)" -ForegroundColor Gray
} catch {
    $errorBody = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($errorBody) {
        Write-Host "    [-] Failed: $($errorBody.message)" -ForegroundColor Red
    } else {
        Write-Host "    [-] Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# ============================================================================
# Step 6: Approve from lending chama side
# ============================================================================
Write-Host ""
Write-Host "[6] Approving request from lending chama side..." -ForegroundColor Yellow

$approveLendingBody = @{
    side = "lending"
    finalInterestRate = 12
    finalRepaymentPeriodMonths = 6
} | ConvertTo-Json

try {
    $approveLendingResponse = Invoke-RestMethod -Uri "$API_BASE/lending/inter-chama/requests/$REQUEST_ID/approve" -Method PUT -Body $approveLendingBody -Headers $chama2Headers -ErrorAction Stop
    Write-Host "    [+] Lending chama approved!" -ForegroundColor Green
    Write-Host "        - Status: $($approveLendingResponse.data.status)" -ForegroundColor Gray
} catch {
    $errorBody = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($errorBody) {
        Write-Host "    [-] Failed: $($errorBody.message)" -ForegroundColor Red
    } else {
        Write-Host "    [-] Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# ============================================================================
# Step 7: Approve from requesting chama side
# ============================================================================
Write-Host ""
Write-Host "[7] Approving request from requesting chama side..." -ForegroundColor Yellow

$approveRequestingBody = @{
    side = "requesting"
} | ConvertTo-Json

try {
    $approveRequestingResponse = Invoke-RestMethod -Uri "$API_BASE/lending/inter-chama/requests/$REQUEST_ID/approve" -Method PUT -Body $approveRequestingBody -Headers $chama1Headers -ErrorAction Stop
    Write-Host "    [+] Requesting chama approved!" -ForegroundColor Green
    Write-Host "        - Status: $($approveRequestingResponse.data.status)" -ForegroundColor Gray
    
    if ($approveRequestingResponse.data.status -eq "approved") {
        Write-Host "        - Both sides approved! Loan should be created." -ForegroundColor Green
    }
} catch {
    $errorBody = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($errorBody) {
        Write-Host "    [-] Failed: $($errorBody.message)" -ForegroundColor Red
    } else {
        Write-Host "    [-] Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# ============================================================================
# Step 8: Get inter-chama loans for both chamas
# ============================================================================
Write-Host ""
Write-Host "[8] Getting inter-chama loans for Chama 1 (as requesting)..." -ForegroundColor Yellow

try {
    $chama1LoansResponse = Invoke-RestMethod -Uri "$API_BASE/lending/inter-chama/chama/$CHAMA1_ID/loans?role=requesting" -Method GET -Headers $chama1Headers -ErrorAction Stop
    Write-Host "    [+] Found $($chama1LoansResponse.data.Count) loan(s) as requesting chama" -ForegroundColor Green
    
    if ($chama1LoansResponse.data.Count -gt 0) {
        $LOAN = $chama1LoansResponse.data[0]
        $LOAN_ID = $LOAN.id
        Write-Host "        - Loan ID: $($LOAN_ID.Substring(0,8))..." -ForegroundColor Gray
        Write-Host "        - Principal: $($LOAN.principalAmount)" -ForegroundColor Gray
        Write-Host "        - Total Due: $($LOAN.totalAmount)" -ForegroundColor Gray
        Write-Host "        - Status: $($LOAN.status)" -ForegroundColor Gray
    }
} catch {
    Write-Host "    [-] Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "[8b] Getting inter-chama loans for Chama 2 (as lending)..." -ForegroundColor Yellow

try {
    $chama2LoansResponse = Invoke-RestMethod -Uri "$API_BASE/lending/inter-chama/chama/$CHAMA2_ID/loans?role=lending" -Method GET -Headers $chama2Headers -ErrorAction Stop
    Write-Host "    [+] Found $($chama2LoansResponse.data.Count) loan(s) as lending chama" -ForegroundColor Green
} catch {
    Write-Host "    [-] Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# ============================================================================
# Step 9: Get inter-chama lending summary
# ============================================================================
Write-Host ""
Write-Host "[9] Getting inter-chama lending summary for Chama 1..." -ForegroundColor Yellow

try {
    $summary1Response = Invoke-RestMethod -Uri "$API_BASE/lending/inter-chama/chama/$CHAMA1_ID/summary" -Method GET -Headers $chama1Headers -ErrorAction Stop
    Write-Host "    [+] Summary retrieved" -ForegroundColor Green
    Write-Host "        - Total loans received: $($summary1Response.data.totalLoansReceived)" -ForegroundColor Gray
    Write-Host "        - Total loans given: $($summary1Response.data.totalLoansGiven)" -ForegroundColor Gray
    Write-Host "        - Total borrowed: $($summary1Response.data.totalBorrowed)" -ForegroundColor Gray
    Write-Host "        - Total lent: $($summary1Response.data.totalLent)" -ForegroundColor Gray
} catch {
    Write-Host "    [-] Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "[9b] Getting inter-chama lending summary for Chama 2..." -ForegroundColor Yellow

try {
    $summary2Response = Invoke-RestMethod -Uri "$API_BASE/lending/inter-chama/chama/$CHAMA2_ID/summary" -Method GET -Headers $chama2Headers -ErrorAction Stop
    Write-Host "    [+] Summary retrieved" -ForegroundColor Green
    Write-Host "        - Total loans received: $($summary2Response.data.totalLoansReceived)" -ForegroundColor Gray
    Write-Host "        - Total loans given: $($summary2Response.data.totalLoansGiven)" -ForegroundColor Gray
    Write-Host "        - Total borrowed: $($summary2Response.data.totalBorrowed)" -ForegroundColor Gray
    Write-Host "        - Total lent: $($summary2Response.data.totalLent)" -ForegroundColor Gray
} catch {
    Write-Host "    [-] Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# ============================================================================
# Step 10: Disburse loan (requires lending chama balance)
# ============================================================================
if ($LOAN_ID) {
    Write-Host ""
    Write-Host "[10] Attempting to disburse loan..." -ForegroundColor Yellow
    Write-Host "    [!] Note: This requires lending chama wallet balance" -ForegroundColor Yellow
    
    try {
        $disburseResponse = Invoke-RestMethod -Uri "$API_BASE/lending/inter-chama/loans/$LOAN_ID/disburse" -Method PUT -Headers $chama2Headers -ErrorAction Stop
        Write-Host "    [+] Loan disbursed!" -ForegroundColor Green
        Write-Host "        - Status: $($disburseResponse.data.status)" -ForegroundColor Gray
        Write-Host "        - Disbursed at: $($disburseResponse.data.disbursedAt)" -ForegroundColor Gray
    } catch {
        $errorBody = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($errorBody) {
            Write-Host "    [-] Failed: $($errorBody.message)" -ForegroundColor Red
        } else {
            Write-Host "    [-] Failed: $($_.Exception.Message)" -ForegroundColor Red
        }
        Write-Host "    [!] This is expected if lending chama doesn't have sufficient balance" -ForegroundColor Yellow
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
Write-Host "  [+] POST /api/v1/lending/inter-chama/requests" -ForegroundColor White -NoNewline; Write-Host "        - Create loan request" -ForegroundColor Gray
Write-Host "  [+] GET  /api/v1/lending/inter-chama/chama/:id/requests" -ForegroundColor White -NoNewline; Write-Host " - Get requests" -ForegroundColor Gray
Write-Host "  [+] PUT  /api/v1/lending/inter-chama/requests/:id/negotiate" -ForegroundColor White -NoNewline; Write-Host " - Negotiate terms" -ForegroundColor Gray
Write-Host "  [+] PUT  /api/v1/lending/inter-chama/requests/:id/approve" -ForegroundColor White -NoNewline; Write-Host " - Approve request" -ForegroundColor Gray
Write-Host "  [+] GET  /api/v1/lending/inter-chama/chama/:id/loans" -ForegroundColor White -NoNewline; Write-Host "      - Get loans" -ForegroundColor Gray
Write-Host "  [+] GET  /api/v1/lending/inter-chama/chama/:id/summary" -ForegroundColor White -NoNewline; Write-Host "  - Get summary" -ForegroundColor Gray
Write-Host ""
Write-Host "Not tested (require funds):" -ForegroundColor Gray
Write-Host "  [ ] PUT  /api/v1/lending/inter-chama/loans/:id/disburse" -ForegroundColor Gray -NoNewline; Write-Host "   - Disburse loan" -ForegroundColor Gray
Write-Host "  [ ] POST /api/v1/lending/inter-chama/loans/:id/repay" -ForegroundColor Gray -NoNewline; Write-Host "      - Make repayment" -ForegroundColor Gray
Write-Host ""


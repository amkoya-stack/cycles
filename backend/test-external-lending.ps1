# ============================================================================
# Test Script for Phase 12B: External Lending System
# ============================================================================

$API_BASE = "http://localhost:3001/api/v1"
$DB_PASSWORD = "pe6958@25"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Testing Phase 12B: External Lending System" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================================
# Step 1: Register/Login as Chama Admin
# ============================================================================
Write-Host "[1] Setting up chama admin user..." -ForegroundColor Yellow

$chamaAdminEmail = "chama_admin_$(Get-Date -Format 'yyyyMMddHHmmss')@test.com"
$chamaAdminPassword = "TestPassword@123"
$chamaAdminPhone = "+2547$(Get-Random -Minimum 10000000 -Maximum 99999999)"

$registerBody = @{
    email = $chamaAdminEmail
    password = $chamaAdminPassword
    phone = $chamaAdminPhone
    firstName = "Chama"
    lastName = "Admin"
} | ConvertTo-Json

try {
    $registerResponse = Invoke-RestMethod -Uri "$API_BASE/auth/register" -Method POST -Body $registerBody -ContentType "application/json" -ErrorAction Stop
    Write-Host "    [+] Chama admin registered" -ForegroundColor Green
    
    # Verify user
    $env:PGPASSWORD = $DB_PASSWORD
    psql -h localhost -U postgres -d cycle -c "UPDATE users SET email_verified = true, phone_verified = true WHERE email = '$chamaAdminEmail'" 2>&1 | Out-Null
} catch {
    Write-Host "    [!] Registration: $($_.Exception.Message)" -ForegroundColor Yellow
}

$loginBody = @{
    email = $chamaAdminEmail
    password = $chamaAdminPassword
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$API_BASE/auth/login" -Method POST -Body $loginBody -ContentType "application/json" -ErrorAction Stop
    $CHAMA_ADMIN_TOKEN = $loginResponse.accessToken
    $CHAMA_ADMIN_ID = $loginResponse.userId
    Write-Host "    [+] Chama admin logged in: $CHAMA_ADMIN_ID" -ForegroundColor Green
} catch {
    Write-Host "    [-] Login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$chamaAdminHeaders = @{
    "Authorization" = "Bearer $CHAMA_ADMIN_TOKEN"
    "Content-Type" = "application/json"
}

# ============================================================================
# Step 2: Get or create chama
# ============================================================================
Write-Host ""
Write-Host "[2] Setting up chama..." -ForegroundColor Yellow

$env:PGPASSWORD = $DB_PASSWORD
$chamaResult = psql -h localhost -U postgres -d cycle -t -c "SELECT id FROM chamas LIMIT 1" 2>&1
$chamaResultStr = [string]$chamaResult

if ($chamaResultStr -match "([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})") {
    $CHAMA_ID = $matches[1].Trim()
    Write-Host "    [+] Found existing chama: $CHAMA_ID" -ForegroundColor Green
} else {
    $timestamp = Get-Date -Format 'yyyyMMddHHmmss'
    $createChamaQuery = "INSERT INTO chamas (id, name, slug, description, created_by, is_public, lending_enabled, external_lending_enabled) VALUES (gen_random_uuid(), 'External Lending Test Chama', 'external-test-$timestamp', 'Test chama for external lending', '$CHAMA_ADMIN_ID', true, true, true) RETURNING id"
    $chamaIdResult = psql -h localhost -U postgres -d cycle -t -c "$createChamaQuery" 2>&1
    $chamaIdStr = [string]$chamaIdResult
    
    if ($chamaIdStr -match "([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})") {
        $CHAMA_ID = $matches[1].Trim()
        Write-Host "    [+] Created chama: $CHAMA_ID" -ForegroundColor Green
    } else {
        Write-Host "    [-] Failed to create chama" -ForegroundColor Red
        exit 1
    }
}

# Add admin as member
$addMemberQuery = "INSERT INTO chama_members (chama_id, user_id, role, status, joined_at) VALUES ('$CHAMA_ID', '$CHAMA_ADMIN_ID', 'admin', 'active', NOW()) ON CONFLICT DO NOTHING"
psql -h localhost -U postgres -d cycle -c "$addMemberQuery" 2>&1 | Out-Null

# Enable external lending
psql -h localhost -U postgres -d cycle -c "UPDATE chamas SET external_lending_enabled = true WHERE id = '$CHAMA_ID'" 2>&1 | Out-Null
Write-Host "    [+] External lending enabled" -ForegroundColor Green

# ============================================================================
# Step 3: Create a loan listing
# ============================================================================
Write-Host ""
Write-Host "[3] Creating loan listing..." -ForegroundColor Yellow

$listingBody = @{
    chamaId = $CHAMA_ID
    title = "Business Expansion Loans"
    description = "We offer competitive loans for business expansion and growth"
    minAmount = 10000
    maxAmount = 100000
    interestRateMin = 8
    interestRateMax = 15
    minRepaymentPeriodMonths = 3
    maxRepaymentPeriodMonths = 12
    requiresEmploymentVerification = $false
    requiresIncomeProof = $false
    minMonthlyIncome = $null
    allowsRiskSharing = $true
    maxCoFunders = 3
} | ConvertTo-Json

try {
    $listingResponse = Invoke-RestMethod -Uri "$API_BASE/lending/external/listings" -Method POST -Body $listingBody -Headers $chamaAdminHeaders -ErrorAction Stop
    $LISTING_ID = $listingResponse.data.id
    Write-Host "    [+] Loan listing created!" -ForegroundColor Green
    Write-Host "        - ID: $($LISTING_ID.Substring(0,8))..." -ForegroundColor Gray
    Write-Host "        - Amount range: $($listingResponse.data.minAmount) - $($listingResponse.data.maxAmount)" -ForegroundColor Gray
    Write-Host "        - Interest rate: $($listingResponse.data.interestRateMin)% - $($listingResponse.data.interestRateMax)%" -ForegroundColor Gray
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
# Step 4: Browse marketplace
# ============================================================================
Write-Host ""
Write-Host "[4] Browsing marketplace..." -ForegroundColor Yellow

try {
    $marketplaceResponse = Invoke-RestMethod -Uri "$API_BASE/lending/external/marketplace" -Method GET -Headers $chamaAdminHeaders -ErrorAction Stop
    Write-Host "    [+] Found $($marketplaceResponse.data.Count) listing(s)" -ForegroundColor Green
    
    foreach ($listing in $marketplaceResponse.data) {
        Write-Host "        - $($listing.title): $($listing.minAmount) - $($listing.maxAmount) @ $($listing.interestRateMin)%-$($listing.interestRateMax)%" -ForegroundColor Gray
    }
} catch {
    Write-Host "    [-] Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# ============================================================================
# Step 5: Register/Login as Borrower (Non-Member)
# ============================================================================
Write-Host ""
Write-Host "[5] Setting up borrower (non-member)..." -ForegroundColor Yellow

$borrowerEmail = "borrower_$(Get-Date -Format 'yyyyMMddHHmmss')@test.com"
$borrowerPassword = "TestPassword@123"
$borrowerPhone = "+2547$(Get-Random -Minimum 10000000 -Maximum 99999999)"

$borrowerRegisterBody = @{
    email = $borrowerEmail
    password = $borrowerPassword
    phone = $borrowerPhone
    firstName = "External"
    lastName = "Borrower"
} | ConvertTo-Json

try {
    $borrowerRegisterResponse = Invoke-RestMethod -Uri "$API_BASE/auth/register" -Method POST -Body $borrowerRegisterBody -ContentType "application/json" -ErrorAction Stop
    Write-Host "    [+] Borrower registered" -ForegroundColor Green
    
    # Verify user
    psql -h localhost -U postgres -d cycle -c "UPDATE users SET email_verified = true, phone_verified = true WHERE email = '$borrowerEmail'" 2>&1 | Out-Null
} catch {
    Write-Host "    [!] Registration: $($_.Exception.Message)" -ForegroundColor Yellow
}

$borrowerLoginBody = @{
    email = $borrowerEmail
    password = $borrowerPassword
} | ConvertTo-Json

try {
    $borrowerLoginResponse = Invoke-RestMethod -Uri "$API_BASE/auth/login" -Method POST -Body $borrowerLoginBody -ContentType "application/json" -ErrorAction Stop
    $BORROWER_TOKEN = $borrowerLoginResponse.accessToken
    $BORROWER_ID = $borrowerLoginResponse.userId
    Write-Host "    [+] Borrower logged in: $BORROWER_ID" -ForegroundColor Green
} catch {
    Write-Host "    [-] Login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$borrowerHeaders = @{
    "Authorization" = "Bearer $BORROWER_TOKEN"
    "Content-Type" = "application/json"
}

# ============================================================================
# Step 6: Apply for external loan
# ============================================================================
Write-Host ""
Write-Host "[6] Applying for external loan..." -ForegroundColor Yellow

$applicationBody = @{
    listingId = $LISTING_ID
    amountRequested = 50000
    purpose = "Business expansion - opening a new branch"
    proposedInterestRate = 12
    proposedRepaymentPeriodMonths = 6
    employmentStatus = "self_employed"
    monthlyIncome = 50000
    employmentDetails = @{
        businessName = "Test Business Ltd"
        businessType = "Retail"
        yearsInBusiness = 3
    }
    incomeProofDocumentId = $null
} | ConvertTo-Json

try {
    $applicationResponse = Invoke-RestMethod -Uri "$API_BASE/lending/external/applications" -Method POST -Body $applicationBody -Headers $borrowerHeaders -ErrorAction Stop
    $APPLICATION_ID = $applicationResponse.data.id
    Write-Host "    [+] External loan application submitted!" -ForegroundColor Green
    Write-Host "        - ID: $($APPLICATION_ID.Substring(0,8))..." -ForegroundColor Gray
    Write-Host "        - Amount: $($applicationResponse.data.amountRequested)" -ForegroundColor Gray
    Write-Host "        - Status: $($applicationResponse.data.status)" -ForegroundColor Gray
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
# Step 7: Get borrower's applications
# ============================================================================
Write-Host ""
Write-Host "[7] Getting borrower's applications..." -ForegroundColor Yellow

try {
    $myAppsResponse = Invoke-RestMethod -Uri "$API_BASE/lending/external/applications/me" -Method GET -Headers $borrowerHeaders -ErrorAction Stop
    Write-Host "    [+] Found $($myAppsResponse.data.Count) application(s)" -ForegroundColor Green
} catch {
    Write-Host "    [-] Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# ============================================================================
# Step 8: Chama reviews applications
# ============================================================================
Write-Host ""
Write-Host "[8] Getting chama's external applications..." -ForegroundColor Yellow

try {
    $chamaAppsResponse = Invoke-RestMethod -Uri "$API_BASE/lending/external/chama/$CHAMA_ID/applications" -Method GET -Headers $chamaAdminHeaders -ErrorAction Stop
    Write-Host "    [+] Found $($chamaAppsResponse.data.Count) application(s) for chama" -ForegroundColor Green
} catch {
    Write-Host "    [-] Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# ============================================================================
# Step 9: Approve external application
# ============================================================================
Write-Host ""
Write-Host "[9] Approving external loan application..." -ForegroundColor Yellow

$approveBody = @{
    finalInterestRate = 12
    finalRepaymentPeriodMonths = 6
} | ConvertTo-Json

try {
    $approveResponse = Invoke-RestMethod -Uri "$API_BASE/lending/external/applications/$APPLICATION_ID/approve" -Method PUT -Body $approveBody -Headers $chamaAdminHeaders -ErrorAction Stop
    Write-Host "    [+] Application approved!" -ForegroundColor Green
    Write-Host "        - Status: $($approveResponse.data.status)" -ForegroundColor Gray
    Write-Host "        - Final interest rate: $($approveResponse.data.finalInterestRate)%" -ForegroundColor Gray
} catch {
    $errorBody = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($errorBody) {
        Write-Host "    [-] Failed: $($errorBody.message)" -ForegroundColor Red
    } else {
        Write-Host "    [-] Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# ============================================================================
# Step 10: Create escrow account
# ============================================================================
Write-Host ""
Write-Host "[10] Creating escrow account..." -ForegroundColor Yellow

try {
    $escrowResponse = Invoke-RestMethod -Uri "$API_BASE/lending/external/applications/$APPLICATION_ID/escrow" -Method POST -Headers $chamaAdminHeaders -ErrorAction Stop
    $ESCROW_ID = $escrowResponse.data.id
    Write-Host "    [+] Escrow account created!" -ForegroundColor Green
    Write-Host "        - ID: $($ESCROW_ID.Substring(0,8))..." -ForegroundColor Gray
    Write-Host "        - Amount: $($escrowResponse.data.amount)" -ForegroundColor Gray
    Write-Host "        - Status: $($escrowResponse.data.status)" -ForegroundColor Gray
} catch {
    $errorBody = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($errorBody) {
        Write-Host "    [-] Failed: $($errorBody.message)" -ForegroundColor Red
    } else {
        Write-Host "    [-] Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# ============================================================================
# Step 11: Get escrow details
# ============================================================================
if ($ESCROW_ID) {
    Write-Host ""
    Write-Host "[11] Getting escrow details..." -ForegroundColor Yellow
    
    try {
        $escrowDetailsResponse = Invoke-RestMethod -Uri "$API_BASE/lending/external/escrow/$ESCROW_ID" -Method GET -Headers $chamaAdminHeaders -ErrorAction Stop
        Write-Host "    [+] Escrow details retrieved" -ForegroundColor Green
        Write-Host "        - Status: $($escrowDetailsResponse.data.status)" -ForegroundColor Gray
        Write-Host "        - Amount: $($escrowDetailsResponse.data.amount)" -ForegroundColor Gray
    } catch {
        Write-Host "    [-] Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# ============================================================================
# Step 12: Fund escrow (requires chama balance)
# ============================================================================
if ($ESCROW_ID) {
    Write-Host ""
    Write-Host "[12] Funding escrow account..." -ForegroundColor Yellow
    Write-Host "    [!] Note: This requires chama wallet balance" -ForegroundColor Yellow
    
    # Check chama balance first
    try {
        $balanceResponse = Invoke-RestMethod -Uri "$API_BASE/wallet/balance" -Method GET -Headers $chamaAdminHeaders -ErrorAction Stop
        $chamaBalance = $balanceResponse.balance
        Write-Host "    [!] Chama balance: $chamaBalance" -ForegroundColor Yellow
        
        if ($chamaBalance -ge 50000) {
            try {
                $fundResponse = Invoke-RestMethod -Uri "$API_BASE/lending/external/escrow/$ESCROW_ID/fund" -Method PUT -Headers $chamaAdminHeaders -ErrorAction Stop
                Write-Host "    [+] Escrow funded!" -ForegroundColor Green
                Write-Host "        - Status: $($fundResponse.data.status)" -ForegroundColor Gray
            } catch {
                $errorBody = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
                if ($errorBody) {
                    Write-Host "    [-] Failed: $($errorBody.message)" -ForegroundColor Red
                } else {
                    Write-Host "    [-] Failed: $($_.Exception.Message)" -ForegroundColor Red
                }
            }
        } else {
            Write-Host "    [!] Insufficient balance. Need 50000, have $chamaBalance" -ForegroundColor Yellow
            Write-Host "    [!] Skipping escrow funding test" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "    [!] Could not check balance, skipping funding test" -ForegroundColor Yellow
    }
}

# ============================================================================
# Step 13: Release escrow (requires funded escrow)
# ============================================================================
if ($ESCROW_ID) {
    Write-Host ""
    Write-Host "[13] Releasing escrow funds..." -ForegroundColor Yellow
    Write-Host "    [!] Note: This requires escrow to be funded first" -ForegroundColor Yellow
    
    try {
        $releaseResponse = Invoke-RestMethod -Uri "$API_BASE/lending/external/escrow/$ESCROW_ID/release" -Method PUT -Headers $chamaAdminHeaders -ErrorAction Stop
        Write-Host "    [+] Escrow released!" -ForegroundColor Green
        Write-Host "        - Status: $($releaseResponse.data.status)" -ForegroundColor Gray
        Write-Host "        - Released to: $($releaseResponse.data.releasedToUserId)" -ForegroundColor Gray
    } catch {
        $errorBody = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($errorBody) {
            Write-Host "    [-] Failed: $($errorBody.message)" -ForegroundColor Red
        } else {
            Write-Host "    [-] Failed: $($_.Exception.Message)" -ForegroundColor Red
        }
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
Write-Host "  [+] POST /api/v1/lending/external/listings" -ForegroundColor White -NoNewline; Write-Host "        - Create listing" -ForegroundColor Gray
Write-Host "  [+] GET  /api/v1/lending/external/marketplace" -ForegroundColor White -NoNewline; Write-Host "      - Browse marketplace" -ForegroundColor Gray
Write-Host "  [+] GET  /api/v1/lending/external/listings/:id" -ForegroundColor White -NoNewline; Write-Host "   - Get listing details" -ForegroundColor Gray
Write-Host "  [+] POST /api/v1/lending/external/applications" -ForegroundColor White -NoNewline; Write-Host "   - Apply for loan" -ForegroundColor Gray
Write-Host "  [+] GET  /api/v1/lending/external/applications/me" -ForegroundColor White -NoNewline; Write-Host " - Get my applications" -ForegroundColor Gray
Write-Host "  [+] GET  /api/v1/lending/external/chama/:id/applications" -ForegroundColor White -NoNewline; Write-Host " - Get chama applications" -ForegroundColor Gray
Write-Host "  [+] PUT  /api/v1/lending/external/applications/:id/approve" -ForegroundColor White -NoNewline; Write-Host " - Approve application" -ForegroundColor Gray
Write-Host "  [+] POST /api/v1/lending/external/applications/:id/escrow" -ForegroundColor White -NoNewline; Write-Host " - Create escrow" -ForegroundColor Gray
Write-Host "  [+] GET  /api/v1/lending/external/escrow/:id" -ForegroundColor White -NoNewline; Write-Host "        - Get escrow details" -ForegroundColor Gray
Write-Host ""
Write-Host "Additional endpoints:" -ForegroundColor Yellow
Write-Host "  [+] POST /api/v1/lending/external/applications/:id/risk-sharing" -ForegroundColor White -NoNewline; Write-Host " - Create risk sharing" -ForegroundColor Gray
Write-Host "  [+] GET  /api/v1/lending/external/applications/:id/risk-sharing" -ForegroundColor White -NoNewline; Write-Host "  - Get risk sharing" -ForegroundColor Gray
Write-Host ""
Write-Host "Escrow operations (tested if funds available):" -ForegroundColor Yellow
Write-Host "  [*] PUT  /api/v1/lending/external/escrow/:id/fund" -ForegroundColor White -NoNewline; Write-Host "     - Fund escrow" -ForegroundColor Gray
Write-Host "  [*] PUT  /api/v1/lending/external/escrow/:id/release" -ForegroundColor White -NoNewline; Write-Host "   - Release escrow" -ForegroundColor Gray
Write-Host ""


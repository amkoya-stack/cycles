# Generate TOKENIZATION_SECRET_KEY
# This script generates a secure random key for tokenization

Write-Host "`n=== Generating TOKENIZATION_SECRET_KEY ===" -ForegroundColor Cyan
Write-Host ""

# Method 1: Using Node.js (Recommended)
Write-Host "Method 1: Using Node.js" -ForegroundColor Yellow
$nodeKey = node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
Write-Host "TOKENIZATION_SECRET_KEY=$nodeKey" -ForegroundColor Green
Write-Host ""

# Method 2: Using OpenSSL (if available)
Write-Host "Method 2: Using OpenSSL (if installed)" -ForegroundColor Yellow
try {
    $opensslKey = openssl rand -base64 32
    Write-Host "TOKENIZATION_SECRET_KEY=$opensslKey" -ForegroundColor Green
} catch {
    Write-Host "OpenSSL not found, skipping..." -ForegroundColor Gray
}
Write-Host ""

# Method 3: Using PowerShell (Base64)
Write-Host "Method 3: Using PowerShell" -ForegroundColor Yellow
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
$psKey = [Convert]::ToBase64String($bytes)
Write-Host "TOKENIZATION_SECRET_KEY=$psKey" -ForegroundColor Green
Write-Host ""

# Method 4: Using PowerShell (Hex - 64 characters)
Write-Host "Method 4: Using PowerShell (Hex - 64 chars)" -ForegroundColor Yellow
$hexBytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Fill($hexBytes)
$hexKey = ($hexBytes | ForEach-Object { $_.ToString('x2') }) -join ''
Write-Host "TOKENIZATION_SECRET_KEY=$hexKey" -ForegroundColor Green
Write-Host ""

Write-Host "=== Instructions ===" -ForegroundColor Cyan
Write-Host "1. Copy one of the keys above" -ForegroundColor White
Write-Host "2. Add it to your .env file:" -ForegroundColor White
Write-Host "   TOKENIZATION_SECRET_KEY=<paste-key-here>" -ForegroundColor Gray
Write-Host "3. Make sure the key is at least 32 characters long" -ForegroundColor White
Write-Host "4. Keep this key SECRET - never commit it to git!" -ForegroundColor Red
Write-Host ""


# Helper script to get token and test Phase 3 features

param(
    [string]$Email = "",
    [string]$Password = "",
    [string]$BaseUrl = "http://localhost:3001"
)

Write-Host "[*] Getting Access Token" -ForegroundColor Cyan
Write-Host "======================" -ForegroundColor Cyan
Write-Host ""

if (-not $Email -or -not $Password) {
    Write-Host "Usage: .\get-token-and-test.ps1 -Email 'your@email.com' -Password 'YourPassword'" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Or set credentials interactively:" -ForegroundColor Yellow
    $Email = Read-Host "Enter email"
    $Password = Read-Host "Enter password" -AsSecureString
    $Password = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password))
}

Write-Host "Logging in..." -ForegroundColor Yellow

try {
    $loginBody = @{
        email = $Email
        password = $Password
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$BaseUrl/api/v1/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginBody

    if ($response.accessToken) {
        $token = $response.accessToken
        Write-Host "[+] Login successful!" -ForegroundColor Green
        Write-Host "Token: $($token.Substring(0, 20))..." -ForegroundColor Gray
        Write-Host ""
        
        Write-Host "[*] Running Phase 3 Tests" -ForegroundColor Cyan
        Write-Host "========================" -ForegroundColor Cyan
        Write-Host ""
        
        # Run the test script
        & ".\test-phase3.ps1" -Token $token -BaseUrl $BaseUrl
    } else {
        Write-Host "[-] No access token in response" -ForegroundColor Red
        Write-Host "Response: $($response | ConvertTo-Json)" -ForegroundColor Gray
    }
} catch {
    Write-Host "[-] Login failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "Tip: Make sure:" -ForegroundColor Yellow
    Write-Host "   1. Backend server is running on $BaseUrl" -ForegroundColor Yellow
    Write-Host "   2. You have registered an account" -ForegroundColor Yellow
    Write-Host "   3. Email and password are correct" -ForegroundColor Yellow
}


$body = @{
    email = "amkoyapeleg@gmail.com"
    password = "254pelegamkoya"
} | ConvertTo-Json

$login = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" -Method POST -ContentType "application/json" -Body $body
Write-Host "Login successful, got token"

$token = $login.accessToken

$result = Invoke-RestMethod -Uri "http://localhost:3001/api/governance/check-and-execute-majority" -Method POST -Headers @{Authorization="Bearer $token"}
Write-Host "Result:"
$result | ConvertTo-Json -Depth 5

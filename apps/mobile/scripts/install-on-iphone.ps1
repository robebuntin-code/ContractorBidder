# Install DOJOBID on a physical iPhone via Apple Developer Program + EAS.
#
# Prerequisites:
#   - Active Apple Developer Program membership ($99/yr)
#   - Expo account (logged in via: npm run eas:login)
#   - iPhone and PC on the same Wi-Fi when using the dev client
#
# Usage (from apps/mobile):
#   .\scripts\install-on-iphone.ps1

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host ""
Write-Host "=== DOJOBID iPhone Install (EAS + Apple Developer) ===" -ForegroundColor Cyan
Write-Host ""

# Current LAN IP for API (update .env if this changes)
$lanIp = (Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.InterfaceAlias -notmatch 'Loopback' -and $_.IPAddress -notlike '169.*' } |
  Select-Object -First 1).IPAddress

if ($lanIp) {
  $apiUrl = "http://${lanIp}:4000/api/v1"
  Write-Host "Detected LAN IP: $lanIp"
  Write-Host "API URL for dev client: $apiUrl"
  @"
# Your PC's Wi-Fi IP (run `ipconfig` if this stops working after a network change).
EXPO_PUBLIC_API_URL=$apiUrl
"@ | Set-Content -Path ".env" -Encoding utf8
} else {
  Write-Host "Could not detect LAN IP — keep EXPO_PUBLIC_API_URL in .env manually." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Step 1/3 — Register your iPhone with EAS" -ForegroundColor Green
Write-Host "  A browser page opens. On your iPhone, follow the link to register this device (UDID)."
Write-Host "  Press Enter when ready..."
Read-Host | Out-Null
npx eas device:create

Write-Host ""
Write-Host "Step 2/3 — Build the iOS development client (cloud build)" -ForegroundColor Green
Write-Host "  EAS will prompt you to sign in with your Apple Developer account."
Write-Host "  Choose 'Let EAS manage credentials' when offered."
Write-Host "  This takes ~10–20 minutes."
Write-Host ""
npx eas build --profile development --platform ios

Write-Host ""
Write-Host "Step 3/3 — Install on your iPhone" -ForegroundColor Green
Write-Host "  When the build finishes, open the install URL on your iPhone (or scan the QR code)."
Write-Host "  Settings → General → VPN & Device Management → trust the developer profile if prompted."
Write-Host ""
Write-Host "After installing, start the dev server on your PC:" -ForegroundColor Cyan
Write-Host "  npm run start:dev-client"
Write-Host ""
Write-Host "Open the DOJOBID app (not Expo Go) and connect to Metro from the dev menu or QR code."
Write-Host ""

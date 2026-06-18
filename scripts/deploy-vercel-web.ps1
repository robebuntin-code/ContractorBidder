# Deploy DOJOBID web app to Vercel.
#
# Prerequisites:
#   npx vercel login
#
# Usage:
#   .\scripts\deploy-vercel-web.ps1
#
param(
  [string]$ApiUrl = 'https://dojobid-api-production.up.railway.app/api/v1'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

function Invoke-Vercel {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$VercelArgs)
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $output = & npx --yes vercel@latest @VercelArgs 2>&1
    $exit = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $prev
  }
  $output | ForEach-Object { Write-Host $_ }
  if ($exit -ne 0) { throw "Vercel command failed: vercel $($VercelArgs -join ' ')" }
}

Write-Host "Checking Vercel CLI login..."
Invoke-Vercel whoami

Write-Host "Linking Vercel project (apps/web monorepo root)..."
if (-not (Test-Path (Join-Path $root 'apps\web\.vercel'))) {
  Set-Location (Join-Path $root 'apps\web')
  Invoke-Vercel link --yes
  Set-Location $root
}

Set-Location (Join-Path $root 'apps\web')

Write-Host "Setting NEXT_PUBLIC_API_URL=$ApiUrl"
$prev = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
& npx --yes vercel@latest env rm NEXT_PUBLIC_API_URL production --yes 2>&1 | Out-Null
$ErrorActionPreference = $prev
Invoke-Vercel env add NEXT_PUBLIC_API_URL production --value $ApiUrl --yes

Write-Host 'Deploying to production...'
Invoke-Vercel deploy --prod --yes

Set-Location $root
Write-Host 'Done. Open the production URL shown above in the Vercel output.'

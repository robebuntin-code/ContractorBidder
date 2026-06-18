# Deploy DOJOBID API to Railway (CLI).
#
# Prerequisites:
#   1. Railway account: https://railway.app
#   2. One-time login: npx @railway/cli login
#
# Usage:
#   .\scripts\deploy-railway-api.ps1
#   .\scripts\deploy-railway-api.ps1 -GenerateDomain
#
param(
  [switch]$GenerateDomain
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

function Read-DotEnv([string]$Path) {
  $vars = @{}
  if (-not (Test-Path $Path)) { return $vars }
  Get-Content $Path | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
    if ($_ -match '^\s*([^=]+)=(.*)$') {
      $key = $matches[1].Trim()
      $val = $matches[2].Trim().Trim('"').Trim("'")
      $vars[$key] = $val
    }
  }
  return $vars
}

function To-PooledDatabaseUrl([string]$Url) {
  if ($Url -match '-pooler\.') { return $Url }
  return $Url -replace '(ep-[^.]+)\.c-', '$1-pooler.c-'
}

function New-RandomSecret {
  [Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
}

Write-Host 'Checking Railway CLI login...'
npx --yes @railway/cli@latest whoami 2>&1 | Out-Host
if ($LASTEXITCODE -ne 0) {
  Write-Host ''
  Write-Host 'Not logged in. Run this first, then re-run this script:'
  Write-Host '  npx @railway/cli login'
  exit 1
}

$localEnv = Read-DotEnv (Join-Path $root 'apps\api\.env')
$dbUrl = To-PooledDatabaseUrl $localEnv['DATABASE_URL']
if (-not $dbUrl) {
  throw 'Missing DATABASE_URL in apps/api/.env'
}

$jwtAccess = if ($localEnv['JWT_ACCESS_SECRET'] -and $localEnv['JWT_ACCESS_SECRET'] -notmatch 'change-me') {
  $localEnv['JWT_ACCESS_SECRET']
} else {
  New-RandomSecret
}
$jwtRefresh = if ($localEnv['JWT_REFRESH_SECRET'] -and $localEnv['JWT_REFRESH_SECRET'] -notmatch 'change-me') {
  $localEnv['JWT_REFRESH_SECRET']
} else {
  New-RandomSecret
}

Write-Host 'Linking Railway project (creates one if needed)...'
if (-not (Test-Path (Join-Path $root '.railway'))) {
  npx --yes @railway/cli@latest init --name dojobid-api 2>&1 | Out-Host
}

Write-Host 'Setting Railway variables...'
$vars = @{
  DATABASE_URL = $dbUrl
  JWT_ACCESS_SECRET = $jwtAccess
  JWT_REFRESH_SECRET = $jwtRefresh
  JWT_ACCESS_TTL = '900s'
  JWT_REFRESH_TTL = '30d'
  API_CORS_ORIGIN = 'http://localhost:3000,http://127.0.0.1:3000'
  PAYMENTS_ENABLED = 'false'
  MESSAGING_GROUP_VISIBLE = 'false'
  PROFILE_REQUIRE_VERIFICATION = 'false'
  JOBS_MAX_PHOTOS = '4'
  AI_JOB_DESCRIPTION_ENABLED = 'true'
  GEMINI_MODEL = 'gemini-2.0-flash'
  AWS_REGION = 'us-east-1'
}

foreach ($entry in $vars.GetEnumerator()) {
  npx --yes @railway/cli@latest variables set "$($entry.Key)=$($entry.Value)" 2>&1 | Out-Host
}

Write-Host 'Deploying to Railway...'
npx --yes @railway/cli@latest up --detach 2>&1 | Out-Host

if ($GenerateDomain) {
  npx --yes @railway/cli@latest domain 2>&1 | Out-Host
}

Write-Host ''
Write-Host 'Done. Open the Railway dashboard for build logs and public URL.'
Write-Host 'Health check: https://YOUR-SERVICE.up.railway.app/api/v1/health'
Write-Host 'Dashboard: https://railway.app/dashboard'

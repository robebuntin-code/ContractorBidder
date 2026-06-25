# Configure GoDaddy DNS for DOJOBID (Vercel web + Railway API).
#
# Requires a GoDaddy production API key:
#   https://developer.godaddy.com/keys
#   Authorization header: sso-key KEY:SECRET
#
# Usage:
#   $env:GODADDY_API_KEY = 'your-key'
#   $env:GODADDY_API_SECRET = 'your-secret'
#   .\scripts\setup-godaddy-dns.ps1
#
param(
  [string]$Domain = 'dojobid.com',
  [string]$VercelApexIp = '76.76.21.21',
  [string]$ApiCnameTarget = 'dojobid-api-production.up.railway.app',
  [int]$Ttl = 600
)

$ErrorActionPreference = 'Stop'

$key = $env:GODADDY_API_KEY
$secret = $env:GODADDY_API_SECRET
if (-not $key -or -not $secret) {
  throw 'Set GODADDY_API_KEY and GODADDY_API_SECRET environment variables first. Create keys at https://developer.godaddy.com/keys'
}

$headers = @{
  Authorization = "sso-key ${key}:${secret}"
  Accept        = 'application/json'
  'Content-Type' = 'application/json'
}

function Invoke-GoDaddyApi {
  param(
    [string]$Method,
    [string]$Path,
    [string]$Body = $null
  )
  $uri = "https://api.godaddy.com/v1/domains/$Domain/$Path"
  if ($Body) {
    return Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers -Body $Body
  }
  return Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers
}

function Set-GoDaddyRecord {
  param(
    [string]$Type,
    [string]$Name,
    [string]$Data
  )
  $payload = @(
    @{
      data = $Data
      name = $Name
      ttl  = $Ttl
      type = $Type
    }
  ) | ConvertTo-Json -Depth 5 -Compress
  Invoke-GoDaddyApi -Method Put -Path "records/$Type/$Name" -Body $payload | Out-Null
  Write-Host "Set $Type $Name -> $Data"
}

Write-Host "Reading current DNS for $Domain..."
$records = Invoke-GoDaddyApi -Method Get -Path 'records'
Write-Host ("Found {0} existing records." -f $records.Count)

Write-Host 'Applying Vercel web records...'
Set-GoDaddyRecord -Type A -Name '@' -Data $VercelApexIp
Set-GoDaddyRecord -Type A -Name 'www' -Data $VercelApexIp

Write-Host 'Applying Railway API record...'
Set-GoDaddyRecord -Type CNAME -Name 'api' -Data $ApiCnameTarget

Write-Host 'Done. DNS may take a few minutes to propagate.'
Write-Host 'Verify with: nslookup dojobid.com'
Write-Host '            nslookup www.dojobid.com'
Write-Host '            nslookup api.dojobid.com'

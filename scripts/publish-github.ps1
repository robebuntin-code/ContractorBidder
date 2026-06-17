# Publish ContractorBidder to GitHub (run after creating the empty repo on github.com).
#
# Usage:
#   .\scripts\publish-github.ps1
#   .\scripts\publish-github.ps1 -GitHubUser robbu
#   .\scripts\publish-github.ps1 -GitHubUser robbu -RepoName ContractorBidder
#
param(
  [string]$GitHubUser = 'robbu',
  [string]$RepoName = 'ContractorBidder'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$remoteUrl = "https://github.com/$GitHubUser/$RepoName.git"

Write-Host ""
Write-Host "Before running this script:"
Write-Host "  1. Sign in at https://github.com"
Write-Host "  2. New repository -> name: $RepoName"
Write-Host "  3. Do NOT add README, .gitignore, or license (repo must be empty)"
Write-Host "  4. Create repository"
Write-Host ""
Write-Host "Remote: $remoteUrl"
Write-Host ""

git remote remove origin 2>$null
git remote add origin $remoteUrl

Write-Host "Pushing main branch..."
git push -u origin main

Write-Host ""
Write-Host "Done. Repository URL:"
Write-Host "  https://github.com/$GitHubUser/$RepoName"

# GitHub 최초 연동 스크립트
# 사용법:
#   .\scripts\push-to-github.ps1 -RepoUrl "https://github.com/USERNAME/golf.git"

param(
  [Parameter(Mandatory = $true)]
  [string]$RepoUrl
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not (Test-Path ".git")) {
  git init
  git branch -M main
  Write-Host "Git 저장소를 초기화했습니다." -ForegroundColor Green
}

$remote = git remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0) {
  git remote add origin $RepoUrl
  Write-Host "origin remote를 추가했습니다: $RepoUrl" -ForegroundColor Green
} else {
  git remote set-url origin $RepoUrl
  Write-Host "origin remote를 업데이트했습니다: $RepoUrl" -ForegroundColor Yellow
}

git add .
git status

Write-Host ""
Write-Host "다음 명령으로 커밋 후 푸시하세요:" -ForegroundColor Cyan
Write-Host '  git commit -m "Initial commit: screen golf reservation PWA"'
Write-Host "  git push -u origin main"
Write-Host ""
Write-Host "푸시 후 GitHub Actions(CI)가 자동 실행됩니다." -ForegroundColor Green

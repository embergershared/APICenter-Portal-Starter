# Runs the pre-deploy script after the environment is provisioned
# It does the following:
# 1. Builds config.json from config.example.json with the API Center data API host, client ID and tenant ID
# 2. Writes it to src/public (Vite's public dir), so the next build ships it
# 3. Copies it into dist too, in case the app was already packaged (azd up packages before deploying)

Write-Host "Running pre-deploy script..."

# $REPOSITORY_ROOT = git rev-parse --show-toplevel
$REPOSITORY_ROOT = "$(Split-Path $MyInvocation.MyCommand.Path)/../.."

# Load the azd environment variables
& "$REPOSITORY_ROOT/infra/hooks/load_azd_env.ps1"

$config = Get-Content "$REPOSITORY_ROOT/config.example.json" -Raw | ConvertFrom-Json
$config.dataApiHostName = "$($env:AZURE_API_CENTER).data.$($env:AZURE_API_CENTER_LOCATION).azure-apicenter.ms"
$config.authentication.clientId = $env:AZURE_CLIENT_ID
$config.authentication.tenantId = $env:AZURE_TENANT_ID

$publicDir = "$REPOSITORY_ROOT/src/public"
New-Item -ItemType Directory -Force -Path $publicDir | Out-Null
$config | ConvertTo-Json -Depth 100 | Out-File "$publicDir/config.json" -Encoding utf8 -Force

if (Test-Path "$REPOSITORY_ROOT/dist") {
    Copy-Item "$publicDir/config.json" -Destination "$REPOSITORY_ROOT/dist/config.json" -Force
}

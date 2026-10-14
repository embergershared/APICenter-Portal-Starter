<#
.SYNOPSIS
    Creates (or updates) an azd environment that deploys this portal next to the API Center
    provisioned by the api-center-demo repository.

.DESCRIPTION
    Reads the api-center-demo azd environment (.azure/<env>/.env) and sets this repository's azd
    environment so that `azd up`:
      - reuses the existing API Center (USE_EXISTING_API_CENTER=true),
      - deploys the Static Web App into the API Center resource group (DEPLOY_TO_API_CENTER_RESOURCE_GROUP=true),
      - names the Static Web App after the demo's naming convention (rg-<loc>-<sub>-<env> => stapp-<loc>-<sub>-<env>-portal).
    Only local azd environment files are written; nothing is deployed.

.EXAMPLE
    ./infra/scripts/Connect-ApiCenterDemo.ps1
    ./infra/scripts/Connect-ApiCenterDemo.ps1 -DemoEnvironment apic-demo-aep -StaticAppLocation eastus2
#>
param(
    [string] $DemoRepoPath = "$PSScriptRoot/../../../api-center-demo",
    # Defaults to the demo repository's default azd environment
    [string] $DemoEnvironment,
    # Defaults to "<DemoEnvironment>-portal"
    [string] $EnvironmentName,
    # Static Web Apps regions; defaults to the API Center region when supported, otherwise centralus
    [ValidateSet('centralus', 'eastasia', 'eastus2', 'westeurope', 'westus2')]
    [string] $StaticAppLocation
)

$ErrorActionPreference = 'Stop'

$DemoRepoPath = (Resolve-Path $DemoRepoPath).Path
if (-not $DemoEnvironment) {
    $DemoEnvironment = (Get-Content "$DemoRepoPath/.azure/config.json" -Raw | ConvertFrom-Json).defaultEnvironment
}
$demoEnvFile = "$DemoRepoPath/.azure/$DemoEnvironment/.env"
if (-not (Test-Path $demoEnvFile)) {
    throw "azd environment '$DemoEnvironment' not found in $DemoRepoPath/.azure."
}

$demo = @{}
foreach ($line in Get-Content $demoEnvFile) {
    if ($line -match '^([^=#]+)=(.*)$') {
        $demo[$matches[1]] = $matches[2] -replace '^"|"$'
    }
}
foreach ($key in 'APIC_SERVICE', 'APIC_LOCATION', 'AZURE_RESOURCE_GROUP', 'AZURE_SUBSCRIPTION_ID') {
    if (-not $demo[$key]) {
        throw "'$key' is missing from $demoEnvFile. Provision the api-center-demo environment first."
    }
}

$apiCenterLocation = $demo['APIC_LOCATION']
if (-not $StaticAppLocation) {
    $supported = 'centralus', 'eastasia', 'eastus2', 'westeurope', 'westus2'
    $StaticAppLocation = if ($supported -contains $apiCenterLocation) { $apiCenterLocation } else { 'centralus' }
}
if (-not $EnvironmentName) {
    $EnvironmentName = "$DemoEnvironment-portal"
}
$staticAppName = ($demo['AZURE_RESOURCE_GROUP'] -replace '^rg-', 'stapp-') + '-portal'

Push-Location "$PSScriptRoot/../.."
try {
    $existing = azd env list --output json | ConvertFrom-Json | Where-Object { $_.Name -eq $EnvironmentName }
    if ($existing) {
        azd env select $EnvironmentName
    } else {
        azd env new $EnvironmentName --subscription $demo['AZURE_SUBSCRIPTION_ID'] --location $apiCenterLocation --no-prompt
    }
    if ($LASTEXITCODE -ne 0) { throw "Failed to create or select azd environment '$EnvironmentName'." }

    $values = [ordered]@{
        AZURE_SUBSCRIPTION_ID               = $demo['AZURE_SUBSCRIPTION_ID']
        AZURE_LOCATION                      = $apiCenterLocation
        USE_EXISTING_API_CENTER             = 'true'
        AZURE_API_CENTER                    = $demo['APIC_SERVICE']
        AZURE_API_CENTER_LOCATION           = $apiCenterLocation
        AZURE_API_CENTER_RESOURCE_GROUP     = $demo['AZURE_RESOURCE_GROUP']
        DEPLOY_TO_API_CENTER_RESOURCE_GROUP = 'true'
        AZURE_STATIC_APP_LOCATION           = $StaticAppLocation
        AZURE_STATIC_APP_NAME               = $staticAppName
    }
    foreach ($entry in $values.GetEnumerator()) {
        azd env set $entry.Key $entry.Value -e $EnvironmentName
        if ($LASTEXITCODE -ne 0) { throw "Failed to set $($entry.Key)." }
    }
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "azd environment '$EnvironmentName' now targets:" -ForegroundColor Cyan
Write-Host "  API Center      : $($demo['APIC_SERVICE']) ($apiCenterLocation)"
Write-Host "  Resource group  : $($demo['AZURE_RESOURCE_GROUP']) (shared with api-center-demo '$DemoEnvironment')"
Write-Host "  Static Web App  : $staticAppName ($StaticAppLocation)"
Write-Host ""
Write-Host "Next: azd up -e $EnvironmentName"
Write-Host "Do not run 'azd down' for this environment: it would delete the shared resource group (the predown hook blocks it)."

# Runs the pre-down script before the environment is provisioned
# It does the following:
# 1. Loads the azd environment variables
# 2. Logs in to the Azure CLI if not running in a GitHub Action

Write-Host "Running pre-down script..."

# $REPOSITORY_ROOT = git rev-parse --show-toplevel
$REPOSITORY_ROOT = "$(Split-Path $MyInvocation.MyCommand.Path)/../.."

# Load the azd environment variables
& "$REPOSITORY_ROOT/infra/hooks/load_azd_env.ps1"

# azd down deletes every resource group of the deployment. When the portal shares the API Center
# resource group (owned by another deployment), that would delete the API Center and everything next to it.
if ($env:DEPLOYED_TO_API_CENTER_RESOURCE_GROUP -eq 'true') {
    Write-Host "Stopping: this portal is deployed into the shared resource group '$($env:AZURE_RESOURCE_GROUP)'." -ForegroundColor Red
    Write-Host "'azd down' would delete that whole resource group, including the API Center. Remove the portal only:"
    Write-Host "  az staticwebapp delete -g $($env:AZURE_RESOURCE_GROUP) -n $($env:AZURE_STATIC_APP) --yes"
    Write-Host "  az ad app delete --id $($env:AZURE_CLIENT_ID)"
    exit 1
}


if ([string]::IsNullOrEmpty($env:GITHUB_WORKSPACE)) {
    # The GITHUB_WORKSPACE is not set, meaning this is not running in a GitHub Action
    & "$REPOSITORY_ROOT/infra/hooks/login.ps1"
}

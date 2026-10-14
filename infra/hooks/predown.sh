#!/bin/bash

# Runs the pre-down script before the environment is provisioned
# It does the following:
# 1. Loads the azd environment variables
# 2. Logs in to the Azure CLI if not running in a GitHub Action

set -e

echo "Running pre-down script..."

# REPOSITORY_ROOT=$(git rev-parse --show-toplevel)
REPOSITORY_ROOT="$(dirname "$(realpath "$0")")/../.."

# Load the azd environment variables
source "$REPOSITORY_ROOT/infra/hooks/load_azd_env.sh"

# azd down deletes every resource group of the deployment. When the portal shares the API Center
# resource group (owned by another deployment), that would delete the API Center and everything next to it.
if [ "$DEPLOYED_TO_API_CENTER_RESOURCE_GROUP" = "true" ]; then
    echo -e "\e[31mStopping: this portal is deployed into the shared resource group '$AZURE_RESOURCE_GROUP'.\e[0m"
    echo "'azd down' would delete that whole resource group, including the API Center. Remove the portal only:"
    echo "  az staticwebapp delete -g $AZURE_RESOURCE_GROUP -n $AZURE_STATIC_APP --yes"
    echo "  az ad app delete --id $AZURE_CLIENT_ID"
    exit 1
fi

if [ -z "$GITHUB_WORKSPACE" ]; then
    # The GITHUB_WORKSPACE is not set, meaning this is not running in a GitHub Action
    "$REPOSITORY_ROOT/infra/hooks/login.sh"
fi

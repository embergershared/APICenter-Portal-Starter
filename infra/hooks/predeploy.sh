#!/bin/bash

# Runs the pre-deploy script after the environment is provisioned
# It does the following:
# 1. Builds config.json from config.example.json with the API Center data API host, client ID and tenant ID
# 2. Writes it to src/public (Vite's public dir), so the next build ships it
# 3. Copies it into dist too, in case the app was already packaged (azd up packages before deploying)

set -e

echo "Running pre-deploy script..."

# REPOSITORY_ROOT=$(git rev-parse --show-toplevel)
REPOSITORY_ROOT="$(dirname "$(realpath "$0")")/../.."

# Load the azd environment variables
source "$REPOSITORY_ROOT/infra/hooks/load_azd_env.sh"

PUBLIC_DIR="$REPOSITORY_ROOT/src/public"
mkdir -p "$PUBLIC_DIR"

jq --arg dataApiHostName "${AZURE_API_CENTER}.data.${AZURE_API_CENTER_LOCATION}.azure-apicenter.ms" \
   --arg clientId "$AZURE_CLIENT_ID" \
   --arg tenantId "$AZURE_TENANT_ID" \
   '.dataApiHostName = $dataApiHostName | .authentication.clientId = $clientId | .authentication.tenantId = $tenantId' \
   "$REPOSITORY_ROOT/config.example.json" > "$PUBLIC_DIR/config.json"

if [ -d "$REPOSITORY_ROOT/dist" ]; then
    cp "$PUBLIC_DIR/config.json" "$REPOSITORY_ROOT/dist/config.json"
fi

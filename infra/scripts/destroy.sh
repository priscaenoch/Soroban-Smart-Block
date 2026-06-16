#!/usr/bin/env bash
set -euo pipefail

ENV="${1:-dev}"

if [[ "$ENV" == "production" ]]; then
  echo "ERROR: Destroying production is not allowed via this script."
  echo "       If you truly need to destroy production, do it manually with terraform destroy."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_DIR="$SCRIPT_DIR/../environments/$ENV"

echo "WARNING: This will destroy ALL resources in environment: $ENV"
read -r -p "Type the environment name to confirm: " CONFIRM

if [[ "$CONFIRM" != "$ENV" ]]; then
  echo "Aborted."
  exit 1
fi

cd "$ENV_DIR"

terraform init
terraform destroy -auto-approve

echo "==> Environment '$ENV' has been destroyed."

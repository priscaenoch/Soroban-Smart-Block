#!/usr/bin/env bash
set -euo pipefail

ENV="${1:-dev}"
VALID_ENVS=("dev" "staging" "production")

if [[ ! " ${VALID_ENVS[*]} " =~ " ${ENV} " ]]; then
  echo "Usage: $0 <dev|staging|production>"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_DIR="$SCRIPT_DIR/../environments/$ENV"

echo "==> Applying Terraform for environment: $ENV"

cd "$ENV_DIR"

terraform init -upgrade
terraform validate
terraform plan -out=tfplan
terraform apply tfplan

echo "==> Done. Environment '$ENV' is up to date."

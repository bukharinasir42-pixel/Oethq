#!/usr/bin/env bash
# Deploy backend from CLI: optional Prisma migrate on Neon, Docker build/push to ECR, ECS task + service update.
# Run from repository root. Requires: aws, docker, jq. AWS credentials configured (same as aws sts get-caller-identity).
#
# Loads backend/.env if present (export all vars). Uses NEON_DATABASE_URL or DATABASE_URL for ECS + migrate.
#
# Usage:
#   ./infra/aws-cheapest/scripts/cli-deploy.sh
#   ./infra/aws-cheapest/scripts/cli-deploy.sh --skip-migrate
#   ENV_FILE=/path/to/.env ./infra/aws-cheapest/scripts/cli-deploy.sh

set -euo pipefail

SKIP_MIGRATE=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-migrate) SKIP_MIGRATE=1; shift ;;
    -h|--help)
      echo "Usage: $0 [--skip-migrate]"
      exit 0
      ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${REPO_ROOT}"

ENV_FILE="${ENV_FILE:-${REPO_ROOT}/backend/.env}"
if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "${ENV_FILE}"
  set +a
  echo "Loaded ${ENV_FILE}"
fi

export NEON_DATABASE_URL="${NEON_DATABASE_URL:-${DATABASE_URL:-}}"
if [[ -z "${NEON_DATABASE_URL}" ]]; then
  echo "Set NEON_DATABASE_URL or DATABASE_URL (e.g. in backend/.env)." >&2
  exit 1
fi

: "${JWT_ACCESS_SECRET:?Set JWT_ACCESS_SECRET (e.g. in backend/.env)}"
: "${JWT_REFRESH_SECRET:?Set JWT_REFRESH_SECRET}"
: "${OTP_SECRET:?Set OTP_SECRET}"

export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_DEFAULT_REGION="${AWS_REGION}"
export NAME_PREFIX="${NAME_PREFIX:-oetlms}"

export AWS_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
IMAGE_LOCAL="oetlms-backend:cli-$(date +%s)"
export IMAGE_URI="${ECR_REGISTRY}/oetlms-backend:latest"

if [[ "${SKIP_MIGRATE}" -eq 0 ]]; then
  echo "Running Prisma migrate deploy (Neon)..."
  (cd "${REPO_ROOT}/backend" && npm ci && npx prisma migrate deploy --schema ./src/database/schema.prisma)
fi

echo "Building Docker image..."
docker build -t "${IMAGE_LOCAL}" -f "${REPO_ROOT}/backend/Dockerfile" "${REPO_ROOT}/backend"

echo "Logging in to ECR and pushing..."
aws ecr get-login-password --region "${AWS_REGION}" | docker login --username AWS --password-stdin "${ECR_REGISTRY}"
docker tag "${IMAGE_LOCAL}" "${IMAGE_URI}"
docker tag "${IMAGE_LOCAL}" "${ECR_REGISTRY}/oetlms-backend:cli"
docker push "${IMAGE_URI}"
docker push "${ECR_REGISTRY}/oetlms-backend:cli"

export NEON_DATABASE_URL
bash "${SCRIPT_DIR}/deploy-backend.sh"

echo "Done. Image: ${IMAGE_URI}"

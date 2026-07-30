#!/usr/bin/env bash
# Register a new ECS Fargate task revision (Neon + S3 env) and create or update the service.
# Expects AWS CLI + jq. Run from repo root after pushing an image to ECR.
#
# Required env: AWS_REGION, AWS_ACCOUNT_ID, IMAGE_URI, NEON_DATABASE_URL,
#   JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, OTP_SECRET
# Optional: NAME_PREFIX (default oetlms), ECS_CLUSTER, ECS_SERVICE, ECS_TASK_FAMILY,
#   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM,
#   TASK_ENV_AWS_ACCESS_KEY_ID, TASK_ENV_AWS_SECRET_ACCESS_KEY (injected into ECS task only — do not
#   export as AWS_ACCESS_KEY_ID here or the AWS CLI will pick up malformed values from GitHub secrets)
# Stable API: run infra/aws-cheapest/scripts/setup-stable-api.ps1 once; deploy reads
#   SSM /{prefix}/target-group-arn and registers tasks behind an NLB + Elastic IP.

set -euo pipefail

: "${AWS_REGION:?}"
: "${AWS_ACCOUNT_ID:?}"
: "${IMAGE_URI:?}"
: "${NEON_DATABASE_URL:?Set NEON_DATABASE_URL (GitHub: repository secret NEON_DATABASE_URL)}"
: "${JWT_ACCESS_SECRET:?Set JWT_ACCESS_SECRET (GitHub: repository secret JWT_ACCESS_SECRET)}"
: "${JWT_REFRESH_SECRET:?Set JWT_REFRESH_SECRET (GitHub: repository secret JWT_REFRESH_SECRET)}"
: "${OTP_SECRET:?Set OTP_SECRET (GitHub: repository secret OTP_SECRET)}"

NAME_PREFIX="${NAME_PREFIX:-oetlms}"
ECS_CLUSTER="${ECS_CLUSTER:-${NAME_PREFIX}-cluster}"
ECS_SERVICE="${ECS_SERVICE:-${NAME_PREFIX}-api}"
FAMILY="${ECS_TASK_FAMILY:-${NAME_PREFIX}-backend}"
slug="$(printf '%s' "${NAME_PREFIX}-${AWS_ACCOUNT_ID}" | tr '[:upper:]' '[:lower:]')"
B_AUDIO="${slug}-audio"
B_VIDEO="${slug}-video"
B_PDFS="${slug}-pdfs"
B_IMAGES="${slug}-images"

EXEC_ROLE="arn:aws:iam::${AWS_ACCOUNT_ID}:role/${NAME_PREFIX}-ecs-exec"
TASK_ROLE="arn:aws:iam::${AWS_ACCOUNT_ID}:role/${NAME_PREFIX}-ecs-task"
LOG_GROUP="/ecs/${NAME_PREFIX}"

SMTP_HOST="${SMTP_HOST:-smtp.example.com}"
SMTP_PORT="${SMTP_PORT:-587}"
SMTP_USER="${SMTP_USER:-change-me}"
SMTP_PASSWORD="${SMTP_PASSWORD:-change-me}"
SMTP_FROM="${SMTP_FROM:-OET LMS <no-reply@example.com>}"
CORS_ALLOWED_ORIGINS="${CORS_ALLOWED_ORIGINS:-https://www.drnasiracademy.com,https://drnasiracademy.com,http://localhost:3000}"
NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-https://www.drnasiracademy.com}"

# Strip CR/LF — GitHub secrets pasted with trailing newlines break AWS SigV4 (Invalid header value).
strip_secret() {
  printf '%s' "${1:-}" | tr -d '\r\n'
}

TASK_ENV_AWS_ACCESS_KEY_ID="$(strip_secret "${TASK_ENV_AWS_ACCESS_KEY_ID:-}")"
TASK_ENV_AWS_SECRET_ACCESS_KEY="$(strip_secret "${TASK_ENV_AWS_SECRET_ACCESS_KEY:-}")"

TARGET_GROUP_ARN="${TARGET_GROUP_ARN:-}"
if [[ -z "$TARGET_GROUP_ARN" ]]; then
  TARGET_GROUP_ARN=$(aws ssm get-parameter --name "/${NAME_PREFIX}/target-group-arn" --region "$AWS_REGION" \
    --query 'Parameter.Value' --output text 2>/dev/null || true)
  TARGET_GROUP_ARN="${TARGET_GROUP_ARN:-}"
  if [[ "$TARGET_GROUP_ARN" == "None" ]]; then
    TARGET_GROUP_ARN=""
  fi
fi

USE_NLB=0
if [[ -n "$TARGET_GROUP_ARN" ]]; then
  USE_NLB=1
  echo "Using stable NLB target group: ${TARGET_GROUP_ARN}"
else
  echo "No NLB target group (run setup-stable-api.ps1 for a fixed Elastic IP). Using task public IP."
fi

TASK_JSON=$(jq -n \
  --arg IMAGE "$IMAGE_URI" \
  --arg EXEC "$EXEC_ROLE" \
  --arg TASK "$TASK_ROLE" \
  --arg REGION "$AWS_REGION" \
  --arg FAMILY "$FAMILY" \
  --arg LOG_GROUP "$LOG_GROUP" \
  --arg DB "$NEON_DATABASE_URL" \
  --arg JWT_A "$JWT_ACCESS_SECRET" \
  --arg JWT_R "$JWT_REFRESH_SECRET" \
  --arg OTP "$OTP_SECRET" \
  --arg B_AUDIO "$B_AUDIO" \
  --arg B_VIDEO "$B_VIDEO" \
  --arg B_PDFS "$B_PDFS" \
  --arg B_IMAGES "$B_IMAGES" \
  --arg SMTP_HOST "$SMTP_HOST" \
  --arg SMTP_PORT "$SMTP_PORT" \
  --arg SMTP_USER "$SMTP_USER" \
  --arg SMTP_PASS "$SMTP_PASSWORD" \
  --arg SMTP_FROM "$SMTP_FROM" \
  --arg CORS "$CORS_ALLOWED_ORIGINS" \
  --arg APP_URL "$NEXT_PUBLIC_APP_URL" \
  --arg AWS_KEY "$TASK_ENV_AWS_ACCESS_KEY_ID" \
  --arg AWS_SECRET "$TASK_ENV_AWS_SECRET_ACCESS_KEY" \
  '{
    family: $FAMILY,
    networkMode: "awsvpc",
    requiresCompatibilities: ["FARGATE"],
    cpu: "256",
    memory: "512",
    executionRoleArn: $EXEC,
    taskRoleArn: $TASK,
    containerDefinitions: [{
      name: "api",
      image: $IMAGE,
      essential: true,
      portMappings: [{containerPort: 4000, protocol: "tcp"}],
      environment: [
        {name: "NODE_ENV", value: "production"},
        {name: "API_PORT", value: "4000"},
        {name: "AWS_REGION", value: $REGION},
        {name: "AWS_DEFAULT_REGION", value: $REGION},
        {name: "DATABASE_URL", value: $DB},
        {name: "JWT_ACCESS_SECRET", value: $JWT_A},
        {name: "JWT_REFRESH_SECRET", value: $JWT_R},
        {name: "OTP_SECRET", value: $OTP},
        {name: "S3_BUCKET_AUDIO", value: $B_AUDIO},
        {name: "S3_BUCKET_VIDEO", value: $B_VIDEO},
        {name: "S3_BUCKET_PDFS", value: $B_PDFS},
        {name: "S3_BUCKET_IMAGES", value: $B_IMAGES},
        {name: "SMTP_HOST", value: $SMTP_HOST},
        {name: "SMTP_PORT", value: $SMTP_PORT},
        {name: "SMTP_USER", value: $SMTP_USER},
        {name: "SMTP_PASSWORD", value: $SMTP_PASS},
        {name: "SMTP_FROM", value: $SMTP_FROM},
        {name: "CORS_ALLOWED_ORIGINS", value: $CORS},
        {name: "NEXT_PUBLIC_APP_URL", value: $APP_URL},
        (if $AWS_KEY != "" then {name: "AWS_ACCESS_KEY_ID", value: $AWS_KEY} else empty end),
        (if $AWS_SECRET != "" then {name: "AWS_SECRET_ACCESS_KEY", value: $AWS_SECRET} else empty end)
      ],
      logConfiguration: {
        logDriver: "awslogs",
        options: {
          "awslogs-group": $LOG_GROUP,
          "awslogs-region": $REGION,
          "awslogs-stream-prefix": "api"
        }
      }
    }]
  }')

TMP="$(mktemp)"
printf '%s' "$TASK_JSON" > "$TMP"
aws ecs register-task-definition --cli-input-json "file://${TMP}" --region "$AWS_REGION" >/dev/null
rm -f "$TMP"

REV=$(aws ecs describe-task-definition --task-definition "$FAMILY" --region "$AWS_REGION" \
  --query 'taskDefinition.revision' --output text)
echo "Registered ${FAMILY}:${REV}"

VPC_ID=$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true --region "$AWS_REGION" \
  --query 'Vpcs[0].VpcId' --output text)
if [[ -z "$VPC_ID" || "$VPC_ID" == "None" ]]; then
  echo "No default VPC; create one or set VPC/subnets manually." >&2
  exit 1
fi

read -r -a SUBNETS <<<"$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=${VPC_ID}" \
  --region "$AWS_REGION" --query 'Subnets[*].SubnetId' --output text)"
if [[ ${#SUBNETS[@]} -lt 1 ]]; then
  echo "No subnets in default VPC." >&2
  exit 1
fi
SUBNET_CSV="${SUBNETS[0]}"
if [[ ${#SUBNETS[@]} -ge 2 ]]; then
  SUBNET_CSV="${SUBNETS[0]},${SUBNETS[1]}"
fi

SG_NAME="${NAME_PREFIX}-api-sg"
SG_ID=$(aws ec2 describe-security-groups --filters "Name=group-name,Values=${SG_NAME}" \
  "Name=vpc-id,Values=${VPC_ID}" --region "$AWS_REGION" \
  --query 'SecurityGroups[0].GroupId' --output text)
if [[ -z "$SG_ID" || "$SG_ID" == "None" ]]; then
  SG_ID=$(aws ec2 create-security-group --group-name "$SG_NAME" --description "OET LMS API" \
    --vpc-id "$VPC_ID" --region "$AWS_REGION" --query GroupId --output text)
  aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 4000 \
    --cidr 0.0.0.0/0 --region "$AWS_REGION" >/dev/null || true
  echo "Created security group ${SG_ID}"
fi

if [[ "$USE_NLB" -eq 1 ]]; then
  # Tasks keep a public IP for ECR/Neon egress (no NAT in the cheap VPC). Inbound traffic uses the NLB Elastic IP.
  NET_CFG="awsvpcConfiguration={subnets=[${SUBNET_CSV}],securityGroups=[${SG_ID}],assignPublicIp=ENABLED}"
  LB_CFG="targetGroupArn=${TARGET_GROUP_ARN},containerName=api,containerPort=4000"
else
  NET_CFG="awsvpcConfiguration={subnets=[${SUBNET_CSV}],securityGroups=[${SG_ID}],assignPublicIp=ENABLED}"
  LB_CFG=""
fi

STATUS=$(aws ecs describe-services --cluster "$ECS_CLUSTER" --services "$ECS_SERVICE" \
  --region "$AWS_REGION" --query 'services[0].status' --output text 2>/dev/null || echo "MISSING")
STATUS="${STATUS:-MISSING}"

if [[ "$STATUS" == "ACTIVE" ]]; then
  if [[ "$USE_NLB" -eq 1 ]]; then
    aws ecs update-service --cluster "$ECS_CLUSTER" --service "$ECS_SERVICE" \
      --task-definition "${FAMILY}:${REV}" --desired-count 1 --force-new-deployment \
      --capacity-provider-strategy capacityProvider=FARGATE_SPOT,weight=1 \
      --network-configuration "$NET_CFG" \
      --load-balancers "$LB_CFG" \
      --health-check-grace-period-seconds 120 \
      --region "$AWS_REGION" >/dev/null
  else
    aws ecs update-service --cluster "$ECS_CLUSTER" --service "$ECS_SERVICE" \
      --task-definition "${FAMILY}:${REV}" --desired-count 1 --force-new-deployment \
      --capacity-provider-strategy capacityProvider=FARGATE_SPOT,weight=1 \
      --network-configuration "$NET_CFG" --region "$AWS_REGION" >/dev/null
  fi
  echo "Updated service ${ECS_SERVICE}"
else
  if [[ "$USE_NLB" -eq 1 ]]; then
    aws ecs create-service --cluster "$ECS_CLUSTER" --service-name "$ECS_SERVICE" \
      --task-definition "${FAMILY}:${REV}" --desired-count 1 \
      --capacity-provider-strategy capacityProvider=FARGATE_SPOT,weight=1 \
      --network-configuration "$NET_CFG" \
      --load-balancers "$LB_CFG" \
      --health-check-grace-period-seconds 120 \
      --region "$AWS_REGION" >/dev/null
  else
    aws ecs create-service --cluster "$ECS_CLUSTER" --service-name "$ECS_SERVICE" \
      --task-definition "${FAMILY}:${REV}" --desired-count 1 \
      --capacity-provider-strategy capacityProvider=FARGATE_SPOT,weight=1 \
      --network-configuration "$NET_CFG" --region "$AWS_REGION" >/dev/null
  fi
  echo "Created service ${ECS_SERVICE}"
fi

echo "Deployment complete."

STABLE_URL=$(aws ssm get-parameter --name "/${NAME_PREFIX}/api-url" --region "$AWS_REGION" \
  --query 'Parameter.Value' --output text 2>/dev/null || true)
STABLE_URL="${STABLE_URL:-}"
if [[ -n "$STABLE_URL" && "$STABLE_URL" != "None" ]]; then
  echo ""
  echo "=== Stable API URL (Elastic IP — unchanged across redeploys) ==="
  echo "API_URL=${STABLE_URL}"
  echo "NEXT_PUBLIC_API_BASE=${STABLE_URL}"
  echo "Health: curl ${STABLE_URL}/health"
else
  echo "Waiting for running task public IP..."
  for _ in $(seq 1 30); do
    TASK_ARN=$(aws ecs list-tasks --cluster "$ECS_CLUSTER" --service-name "$ECS_SERVICE" \
      --desired-status RUNNING --region "$AWS_REGION" --query 'taskArns[0]' --output text 2>/dev/null || true)
    if [[ -n "$TASK_ARN" && "$TASK_ARN" != "None" ]]; then
      ENI=$(aws ecs describe-tasks --cluster "$ECS_CLUSTER" --tasks "$TASK_ARN" --region "$AWS_REGION" \
        --query "tasks[0].attachments[0].details[?name=='networkInterfaceId'].value | [0]" --output text 2>/dev/null || true)
      if [[ -n "$ENI" && "$ENI" != "None" ]]; then
        PUBLIC_IP=$(aws ec2 describe-network-interfaces --network-interface-ids "$ENI" --region "$AWS_REGION" \
          --query 'NetworkInterfaces[0].Association.PublicIp' --output text 2>/dev/null || true)
        if [[ -n "$PUBLIC_IP" && "$PUBLIC_IP" != "None" ]]; then
          echo ""
          echo "=== Ephemeral task IP (changes each redeploy — run setup-stable-api.ps1 to fix) ==="
          echo "API_URL=http://${PUBLIC_IP}:4000"
          echo "Health: curl http://${PUBLIC_IP}:4000/health"
          break
        fi
      fi
    fi
    sleep 5
  done
fi

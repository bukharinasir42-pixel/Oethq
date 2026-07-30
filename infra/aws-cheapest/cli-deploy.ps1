<#
.SYNOPSIS
  Deploy backend from PowerShell: Prisma migrate (Neon), Docker build/push to ECR, ECS register + service update.

.DESCRIPTION
  Same outcome as scripts/cli-deploy.sh without Bash. Requires AWS CLI and Docker on PATH.
  Loads backend\.env from repo root unless you pass -EnvFile.

.EXAMPLE
  cd D:\Repo\oet-lms-platform
  .\infra\aws-cheapest\cli-deploy.ps1

.EXAMPLE
  .\infra\aws-cheapest\cli-deploy.ps1 -SkipMigrate -Region us-east-1
#>
[CmdletBinding()]
param(
  [string] $Region = "us-east-1",
  [string] $NamePrefix = "oetlms",
  [string] $EnvFile = "",
  [switch] $SkipMigrate
)

$ErrorActionPreference = "Stop"

function Write-Utf8NoBom([string] $Path, [string] $Content) {
  [System.IO.File]::WriteAllText($Path, $Content, (New-Object System.Text.UTF8Encoding($false)))
}

function Import-DotEnv([string] $Path) {
  if (-not (Test-Path $Path)) { return }
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if ($line -match '^\s*#' -or $line -eq "") { return }
    $eq = $line.IndexOf("=")
    if ($eq -lt 1) { return }
    $key = $line.Substring(0, $eq).Trim()
    $val = $line.Substring($eq + 1).Trim()
    if ($val.Length -ge 2 -and $val.StartsWith('"') -and $val.EndsWith('"')) {
      $val = $val.Substring(1, $val.Length - 2).Replace('""', '"')
    }
    [Environment]::SetEnvironmentVariable($key, $val, "Process")
  }
  Write-Host "Loaded $Path"
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
if (-not $EnvFile) { $EnvFile = Join-Path $repoRoot "backend\.env" }
Import-DotEnv $EnvFile

$db = [Environment]::GetEnvironmentVariable("NEON_DATABASE_URL", "Process")
if ([string]::IsNullOrWhiteSpace($db)) { $db = [Environment]::GetEnvironmentVariable("DATABASE_URL", "Process") }
if ([string]::IsNullOrWhiteSpace($db)) { throw "Set NEON_DATABASE_URL or DATABASE_URL in $EnvFile" }

$jwtA = [Environment]::GetEnvironmentVariable("JWT_ACCESS_SECRET", "Process")
$jwtR = [Environment]::GetEnvironmentVariable("JWT_REFRESH_SECRET", "Process")
$otp = [Environment]::GetEnvironmentVariable("OTP_SECRET", "Process")
if ([string]::IsNullOrWhiteSpace($jwtA)) { throw "JWT_ACCESS_SECRET missing in env" }
if ([string]::IsNullOrWhiteSpace($jwtR)) { throw "JWT_REFRESH_SECRET missing in env" }
if ([string]::IsNullOrWhiteSpace($otp)) { throw "OTP_SECRET missing in env" }

$smtpHost = [Environment]::GetEnvironmentVariable("SMTP_HOST", "Process"); if ([string]::IsNullOrWhiteSpace($smtpHost)) { $smtpHost = "smtp.example.com" }
$smtpPort = [Environment]::GetEnvironmentVariable("SMTP_PORT", "Process"); if ([string]::IsNullOrWhiteSpace($smtpPort)) { $smtpPort = "587" }
$smtpUser = [Environment]::GetEnvironmentVariable("SMTP_USER", "Process"); if ([string]::IsNullOrWhiteSpace($smtpUser)) { $smtpUser = "change-me" }
$smtpPass = [Environment]::GetEnvironmentVariable("SMTP_PASSWORD", "Process"); if ([string]::IsNullOrWhiteSpace($smtpPass)) { $smtpPass = "change-me" }
$smtpFrom = [Environment]::GetEnvironmentVariable("SMTP_FROM", "Process"); if ([string]::IsNullOrWhiteSpace($smtpFrom)) { $smtpFrom = "OET LMS <no-reply@example.com>" }

$account = ((aws sts get-caller-identity) | ConvertFrom-Json).Account
$ecrRegistry = "${account}.dkr.ecr.$Region.amazonaws.com"
$imageLocal = "oetlms-backend:cli-$(Get-Date -Format 'yyyyMMddHHmmss')"
$imageUri = "${ecrRegistry}/oetlms-backend:latest"
$backendPath = Join-Path $repoRoot "backend"

if (-not $SkipMigrate) {
  Write-Host "Prisma migrate deploy (Neon)..." -ForegroundColor Cyan
  Push-Location $backendPath
  try {
    npm ci
    npx prisma migrate deploy --schema ./src/database/schema.prisma
  } finally {
    Pop-Location
  }
}

Write-Host "Docker build..." -ForegroundColor Cyan
docker build -t $imageLocal -f (Join-Path $backendPath "Dockerfile") $backendPath
if ($LASTEXITCODE -ne 0) { throw "docker build failed" }

Write-Host "ECR login + push..." -ForegroundColor Cyan
$login = aws ecr get-login-password --region $Region
$login | docker login --username AWS --password-stdin $ecrRegistry
docker tag $imageLocal $imageUri
docker tag $imageLocal "${ecrRegistry}/oetlms-backend:cli"
docker push $imageUri
docker push "${ecrRegistry}/oetlms-backend:cli"
if ($LASTEXITCODE -ne 0) { throw "docker push failed" }

$slug = "$NamePrefix-$account".ToLowerInvariant()
$bucketAudio = "$slug-audio"
$bucketVideo = "$slug-video"
$bucketPdfs = "$slug-pdfs"
$bucketImages = "$slug-images"
$clusterName = "$NamePrefix-cluster"
$svcName = "$NamePrefix-api"
$family = "$NamePrefix-backend"
$logGroup = "/ecs/$NamePrefix"
$execRoleArn = "arn:aws:iam::${account}:role/${NamePrefix}-ecs-exec"
$taskRoleArn = "arn:aws:iam::${account}:role/${NamePrefix}-ecs-task"

$containerDef = [ordered]@{
  name             = "api"
  image            = $imageUri
  essential        = $true
  portMappings     = @(@{ containerPort = 4000; protocol = "tcp" })
  environment      = @(
    @{ name = "NODE_ENV"; value = "production" }
    @{ name = "API_PORT"; value = "4000" }
    @{ name = "AWS_REGION"; value = $Region }
    @{ name = "AWS_DEFAULT_REGION"; value = $Region }
    @{ name = "DATABASE_URL"; value = $db }
    @{ name = "JWT_ACCESS_SECRET"; value = $jwtA }
    @{ name = "JWT_REFRESH_SECRET"; value = $jwtR }
    @{ name = "OTP_SECRET"; value = $otp }
    @{ name = "S3_BUCKET_AUDIO"; value = $bucketAudio }
    @{ name = "S3_BUCKET_VIDEO"; value = $bucketVideo }
    @{ name = "S3_BUCKET_PDFS"; value = $bucketPdfs }
    @{ name = "S3_BUCKET_IMAGES"; value = $bucketImages }
    @{ name = "SMTP_HOST"; value = $smtpHost }
    @{ name = "SMTP_PORT"; value = $smtpPort }
    @{ name = "SMTP_USER"; value = $smtpUser }
    @{ name = "SMTP_PASSWORD"; value = $smtpPass }
    @{ name = "SMTP_FROM"; value = $smtpFrom }
  )
  logConfiguration = @{
    logDriver = "awslogs"
    options   = @{
      "awslogs-group"         = $logGroup
      "awslogs-region"        = $Region
      "awslogs-stream-prefix" = "api"
    }
  }
}

$taskDef = [ordered]@{
  family                   = $family
  networkMode              = "awsvpc"
  requiresCompatibilities  = @("FARGATE")
  cpu                      = "256"
  memory                   = "512"
  executionRoleArn         = $execRoleArn
  taskRoleArn              = $taskRoleArn
  containerDefinitions     = @($containerDef)
}

$taskJsonPath = [System.IO.Path]::GetTempFileName() + ".json"
Write-Utf8NoBom -Path $taskJsonPath -Content ($taskDef | ConvertTo-Json -Depth 10)
aws ecs register-task-definition --cli-input-json "file://$taskJsonPath" --region $Region | Out-Null
Remove-Item $taskJsonPath -Force

$rev = (aws ecs describe-task-definition --task-definition $family --region $Region --query "taskDefinition.revision" --output text).Trim()
Write-Host "Registered ${family}:${rev}" -ForegroundColor Green

$vpcId = (aws ec2 describe-vpcs --filters Name=isDefault,Values=true --query "Vpcs[0].VpcId" --output text --region $Region).Trim()
if (-not $vpcId -or $vpcId -eq "None") { throw "No default VPC in $Region" }

$subnetIds = aws ec2 describe-subnets --filters "Name=vpc-id,Values=$vpcId" --query "Subnets[*].SubnetId" --output text --region $Region
$subnetList = $subnetIds -split "\s+" | Where-Object { $_ } | Select-Object -First 2
if ($subnetList.Count -lt 1) { throw "No subnets in default VPC" }
$subnetsJoined = $subnetList -join ","

$sgName = "$NamePrefix-api-sg"
$sgId = (aws ec2 describe-security-groups --filters "Name=group-name,Values=$sgName" "Name=vpc-id,Values=$vpcId" --query "SecurityGroups[0].GroupId" --output text --region $Region).Trim()
if (-not $sgId -or $sgId -eq "None") {
  $sgId = (aws ec2 create-security-group --group-name $sgName --description "OET LMS API" --vpc-id $vpcId --region $Region | ConvertFrom-Json).GroupId
  cmd /c "aws ec2 authorize-security-group-ingress --group-id $sgId --protocol tcp --port 4000 --cidr 0.0.0.0/0 --region $Region 2>nul 1>nul"
  Write-Host "Created security group $sgId"
}

$netCfg = "awsvpcConfiguration={subnets=[$subnetsJoined],securityGroups=[$sgId],assignPublicIp=ENABLED}"
$svc = (aws ecs describe-services --cluster $clusterName --services $svcName --region $Region --query "services[0].status" --output text).Trim()
if ($svc -eq "ACTIVE") {
  aws ecs update-service --cluster $clusterName --service $svcName `
    --task-definition "${family}:${rev}" --desired-count 1 --force-new-deployment `
    --capacity-provider-strategy capacityProvider=FARGATE_SPOT,weight=1 `
    --network-configuration $netCfg --region $Region | Out-Null
  Write-Host "Updated ECS service $svcName" -ForegroundColor Green
} else {
  aws ecs create-service --cluster $clusterName --service-name $svcName `
    --task-definition "${family}:${rev}" --desired-count 1 `
    --capacity-provider-strategy capacityProvider=FARGATE_SPOT,weight=1 `
    --network-configuration $netCfg --region $Region | Out-Null
  Write-Host "Created ECS service $svcName" -ForegroundColor Green
}

Write-Host "Done. Image: $imageUri" -ForegroundColor Cyan

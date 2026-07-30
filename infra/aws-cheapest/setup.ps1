<#
.SYNOPSIS
  Cheapest-path AWS: S3 asset buckets + optional ECS Fargate Spot (no ALB, public IP, 0.25 vCPU / 512 MB).

.NOTES
  Cost levers: Fargate Spot (~70% off on-demand), smallest task size, no NAT/ALB (task gets a public IP in the default VPC),
  S3 Standard with minimal buckets, CloudWatch logs retention 1 day, single desired count.

  Prerequisites: AWS CLI v2, Docker (only if you use -DeployEcs), credentials configured (aws sts get-caller-identity).

  After S3: set backend env AWS_REGION and S3_BUCKET_* to the printed names; use task/instance role or env keys.

  Example (S3 + IAM + ECR + cluster, no running service yet):
    .\setup.ps1 -Region us-east-1

  Example (full service after docker push):
    .\setup.ps1 -Region us-east-1 -DeployEcs -DatabaseUrl 'postgresql://user:pass@host:5432/db?schema=public'

  CI/CD: .github/workflows/backend-cicd.yml (GitHub) or CLI: .\infra\aws-cheapest\cli-deploy.ps1 (Windows) or
  infra/aws-cheapest/scripts/cli-deploy.sh (Git Bash/WSL) — migrate, Docker push to ECR, deploy-backend.sh / ECS.
  One-time: IAM user for GitHub or your workstation: see iam-github-deploy-policy.json.
#>
[CmdletBinding()]
param(
  [string] $Region = "us-east-1",
  [string] $NamePrefix = "oetlms",
  [string] $DatabaseUrl = "",
  [string] $ImageTag = "latest",
  [switch] $DeployEcs
)

$ErrorActionPreference = "Stop"

function Write-Utf8NoBom([string] $Path, [string] $Content) {
  [System.IO.File]::WriteAllText($Path, $Content, (New-Object System.Text.UTF8Encoding($false)))
}

$account = ((aws sts get-caller-identity) | ConvertFrom-Json).Account
$slug = "$NamePrefix-$account".ToLowerInvariant()
$bucketAudio = "$slug-audio"
$bucketVideo = "$slug-video"
$bucketPdfs = "$slug-pdfs"
$bucketImages = "$slug-images"
$clusterName = "$NamePrefix-cluster"
$repoName = "$NamePrefix-backend"
$logGroup = "/ecs/$NamePrefix"
$family = "$NamePrefix-backend"

Write-Host "Account $account  Region $Region" -ForegroundColor Cyan
Write-Host "Buckets: $bucketAudio, $bucketVideo, $bucketPdfs, $bucketImages" -ForegroundColor Cyan

foreach ($b in @($bucketAudio, $bucketVideo, $bucketPdfs, $bucketImages)) {
  cmd /c "aws s3api head-bucket --bucket $b 2>nul 1>nul"
  $headOk = ($LASTEXITCODE -eq 0)
  if (-not $headOk) {
    aws s3 mb "s3://$b" --region $Region | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Failed to create bucket $b" }
    Write-Host "Created bucket $b"
  } else {
    Write-Host "Bucket exists $b"
  }
  $corsPath = Join-Path $PSScriptRoot "s3-cors.json"
  aws s3api put-bucket-cors --bucket $b --cors-configuration "file://$corsPath" --region $Region
  if ($LASTEXITCODE -ne 0) { throw "put-bucket-cors failed for $b" }
}

$trustEcs = @"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "ecs-tasks.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
"@

$execRoleName = "$NamePrefix-ecs-exec"
$taskRoleName = "$NamePrefix-ecs-task"

cmd /c "aws iam get-role --role-name $execRoleName 2>nul 1>nul"
$execRoleArn = $null
if ($LASTEXITCODE -eq 0) {
  $execRoleArn = (aws iam get-role --role-name $execRoleName --query Role.Arn --output text).Trim()
}
if (-not $execRoleArn) {
  $trustFile = [System.IO.Path]::GetTempFileName()
  Write-Utf8NoBom -Path $trustFile -Content $trustEcs
  aws iam create-role --role-name $execRoleName --assume-role-policy-document "file://$trustFile" | Out-Null
  if ($LASTEXITCODE -ne 0) { Remove-Item $trustFile -Force; throw "create-role failed for $execRoleName" }
  aws iam attach-role-policy --role-name $execRoleName --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
  if ($LASTEXITCODE -ne 0) { Remove-Item $trustFile -Force; throw "attach-role-policy failed for $execRoleName" }
  $execRoleArn = (aws iam get-role --role-name $execRoleName --query Role.Arn --output text).Trim()
  Remove-Item $trustFile -Force
  Write-Host "Created execution role $execRoleName"
} else {
  Write-Host "Execution role exists $execRoleName"
}

$s3Policy = @"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": [
        "arn:aws:s3:::$bucketAudio/*",
        "arn:aws:s3:::$bucketVideo/*",
        "arn:aws:s3:::$bucketPdfs/*",
        "arn:aws:s3:::$bucketImages/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::$bucketAudio",
        "arn:aws:s3:::$bucketVideo",
        "arn:aws:s3:::$bucketPdfs",
        "arn:aws:s3:::$bucketImages"
      ]
    }
  ]
}
"@

cmd /c "aws iam get-role --role-name $taskRoleName 2>nul 1>nul"
$taskRoleArn = $null
if ($LASTEXITCODE -eq 0) {
  $taskRoleArn = (aws iam get-role --role-name $taskRoleName --query Role.Arn --output text).Trim()
}
if (-not $taskRoleArn) {
  $trustFile = [System.IO.Path]::GetTempFileName()
  Write-Utf8NoBom -Path $trustFile -Content $trustEcs
  aws iam create-role --role-name $taskRoleName --assume-role-policy-document "file://$trustFile" | Out-Null
  if ($LASTEXITCODE -ne 0) { Remove-Item $trustFile -Force; throw "create-role failed for $taskRoleName" }
  Remove-Item $trustFile -Force
  $taskRoleArn = (aws iam get-role --role-name $taskRoleName --query Role.Arn --output text).Trim()
  Write-Host "Created task role $taskRoleName"
}
$polFile = [System.IO.Path]::GetTempFileName()
Write-Utf8NoBom -Path $polFile -Content $s3Policy
aws iam put-role-policy --role-name $taskRoleName --policy-name "${NamePrefix}-s3-assets" --policy-document "file://$polFile"
if ($LASTEXITCODE -ne 0) { Remove-Item $polFile -Force; throw "put-role-policy failed for $taskRoleName" }
Remove-Item $polFile -Force
Write-Host "Updated S3 inline policy on $taskRoleName"

cmd /c "aws logs create-log-group --log-group-name $logGroup --region $Region 2>nul 1>nul"
cmd /c "aws logs put-retention-policy --log-group-name $logGroup --retention-in-days 1 --region $Region 2>nul 1>nul"

cmd /c "aws ecr describe-repositories --repository-names $repoName --region $Region 2>nul 1>nul"
if ($LASTEXITCODE -ne 0) {
  aws ecr create-repository --repository-name $repoName --region $Region --image-scanning-configuration scanOnPush=false | Out-Null
  Write-Host "Created ECR repository $repoName"
} else {
  Write-Host "ECR repository exists $repoName"
}

$clusterJson = aws ecs describe-clusters --clusters $clusterName --region $Region | ConvertFrom-Json
$clusterObj = $clusterJson.clusters | Where-Object { $_.clusterName -eq $clusterName } | Select-Object -First 1
if (-not $clusterObj -or $clusterObj.status -ne "ACTIVE") {
  aws ecs create-cluster --cluster-name $clusterName --region $Region `
    --capacity-providers FARGATE FARGATE_SPOT `
    --default-capacity-provider-strategy capacityProvider=FARGATE_SPOT,weight=1 | Out-Null
  Write-Host "Created ECS cluster $clusterName (default capacity: FARGATE_SPOT)"
} else {
  Write-Host "ECS cluster exists $clusterName"
}

$ecrHost = "$account.dkr.ecr.$Region.amazonaws.com"
$imageUri = "${ecrHost}/${repoName}:${ImageTag}"

Write-Host ""
Write-Host "=== Backend env (AWS S3) ===" -ForegroundColor Green
Write-Host "# Use IAM role on ECS, or for local dev set AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY for an IAM user with the same S3 actions."
Write-Host "AWS_REGION=$Region"
Write-Host "S3_BUCKET_AUDIO=$bucketAudio"
Write-Host "S3_BUCKET_VIDEO=$bucketVideo"
Write-Host "S3_BUCKET_PDFS=$bucketPdfs"
Write-Host "S3_BUCKET_IMAGES=$bucketImages"
Write-Host ""
Write-Host "=== Build and push API image ===" -ForegroundColor Green
Write-Host "aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin $ecrHost"
$backendRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\backend")).Path
Write-Host "docker build -t ${repoName}:${ImageTag} -f Dockerfile `"$backendRoot`""
Write-Host "docker tag ${repoName}:${ImageTag} $imageUri"
Write-Host "docker push $imageUri"
Write-Host ""

if (-not $DeployEcs) {
  Write-Host "Skipping ECS service (pass -DeployEcs -DatabaseUrl '...' after image is in ECR)." -ForegroundColor Yellow
  exit 0
}

if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
  throw "-DeployEcs requires -DatabaseUrl (Postgres connection string)."
}

cmd /c "aws ecr describe-images --repository-name $repoName --region $Region --image-ids imageTag=$ImageTag 2>nul 1>nul"
$hasImage = ($LASTEXITCODE -eq 0)
if (-not $hasImage) {
  throw "No image $ImageTag in ECR yet. Push the image, then re-run with -DeployEcs."
}

$jwtA = [Guid]::NewGuid().ToString("N") + [Guid]::NewGuid().ToString("N")
$jwtR = [Guid]::NewGuid().ToString("N") + [Guid]::NewGuid().ToString("N")
$otp = [Guid]::NewGuid().ToString("N")

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
    @{ name = "DATABASE_URL"; value = $DatabaseUrl }
    @{ name = "JWT_ACCESS_SECRET"; value = $jwtA }
    @{ name = "JWT_REFRESH_SECRET"; value = $jwtR }
    @{ name = "OTP_SECRET"; value = $otp }
    @{ name = "S3_BUCKET_AUDIO"; value = $bucketAudio }
    @{ name = "S3_BUCKET_VIDEO"; value = $bucketVideo }
    @{ name = "S3_BUCKET_PDFS"; value = $bucketPdfs }
    @{ name = "S3_BUCKET_IMAGES"; value = $bucketImages }
    @{ name = "SMTP_HOST"; value = "smtp.example.com" }
    @{ name = "SMTP_PORT"; value = "587" }
    @{ name = "SMTP_USER"; value = "change-me" }
    @{ name = "SMTP_PASSWORD"; value = "change-me" }
    @{ name = "SMTP_FROM"; value = "OET LMS <no-reply@example.com>" }
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
$reg = aws ecs register-task-definition --cli-input-json "file://$taskJsonPath" --region $Region | ConvertFrom-Json
$taskRev = $reg.taskDefinition.revision
Remove-Item $taskJsonPath -Force
Write-Host "Registered task definition ${family}:$taskRev"

$vpcId = (aws ec2 describe-vpcs --filters Name=isDefault,Values=true --query "Vpcs[0].VpcId" --output text --region $Region).Trim()
if (-not $vpcId -or $vpcId -eq "None") {
  throw "No default VPC found. Create a VPC with an Internet Gateway and public subnets, then adapt this script."
}

$subnetIds = aws ec2 describe-subnets --filters "Name=vpc-id,Values=$vpcId" --query "Subnets[*].SubnetId" --output text --region $Region
$subnetList = $subnetIds -split "\s+" | Where-Object { $_ } | Select-Object -First 2
if ($subnetList.Count -lt 1) {
  throw "No subnets in default VPC."
}
$sgName = "$NamePrefix-api-sg"
$sgId = (aws ec2 describe-security-groups --filters "Name=group-name,Values=$sgName" "Name=vpc-id,Values=$vpcId" --query "SecurityGroups[0].GroupId" --output text --region $Region).Trim()
if (-not $sgId -or $sgId -eq "None") {
  $sgId = (aws ec2 create-security-group --group-name $sgName --description "OET LMS API" --vpc-id $vpcId --region $Region | ConvertFrom-Json).GroupId
  aws ec2 authorize-security-group-ingress --group-id $sgId --protocol tcp --port 4000 --cidr 0.0.0.0/0 --region $Region | Out-Null
  Write-Host "Created security group $sgId (TCP 4000 from 0.0.0.0/0 - tighten for production)"
} else {
  Write-Host "Security group exists $sgId"
}

$svcName = "$NamePrefix-api"
$svc = (aws ecs describe-services --cluster $clusterName --services $svcName --region $Region --query "services[0].status" --output text).Trim()
$subnetsJoined = $subnetList -join ","
$netCfg = "awsvpcConfiguration={subnets=[$subnetsJoined],securityGroups=[$sgId],assignPublicIp=ENABLED}"
if ($svc -eq "ACTIVE") {
  aws ecs update-service --cluster $clusterName --service $svcName `
    --task-definition "${family}:${taskRev}" `
    --desired-count 1 `
    --force-new-deployment `
    --capacity-provider-strategy capacityProvider=FARGATE_SPOT,weight=1 `
    --network-configuration $netCfg `
    --region $Region | Out-Null
  Write-Host "Updated ECS service $svcName"
} else {
  aws ecs create-service --cluster $clusterName --service-name $svcName `
    --task-definition "${family}:${taskRev}" `
    --desired-count 1 `
    --capacity-provider-strategy capacityProvider=FARGATE_SPOT,weight=1 `
    --network-configuration $netCfg `
    --region $Region | Out-Null
  Write-Host "Created ECS service $svcName (Fargate Spot, public IP)"
}

Write-Host ""
Write-Host "JWT secrets were generated for this deployment; save them if you need stable tokens across redeployments." -ForegroundColor Yellow
Write-Host "Get task public IP: ECS console -> cluster $clusterName -> Tasks -> task -> Public IP, then http://IP:4000" -ForegroundColor Green

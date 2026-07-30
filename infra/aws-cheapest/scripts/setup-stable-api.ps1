<#
.SYNOPSIS
  One-time setup: Network Load Balancer + Elastic IP for a stable API address (survives ECS redeploys).

.DESCRIPTION
  Fargate tasks get ephemeral public IPs. This script allocates a VPC Elastic IP, attaches it to an NLB,
  and stores the target group ARN + API URL in SSM. Run deploy-backend.sh afterward to wire ECS to the NLB.

.EXAMPLE
  .\infra\aws-cheapest\scripts\setup-stable-api.ps1
  .\infra\aws-cheapest\scripts\setup-stable-api.ps1 -Region us-east-1 -NamePrefix oetlms
#>
[CmdletBinding()]
param(
  [string] $Region = "us-east-1",
  [string] $NamePrefix = "oetlms"
)

$ErrorActionPreference = "Stop"

function Get-OrCreateElasticIp {
  param([string] $NameTag)
  $existing = aws ec2 describe-addresses --region $Region `
    --filters "Name=tag:Name,Values=$NameTag" --query "Addresses[0]" --output json 2>$null
  if ($existing -and $existing -ne "null") {
    $obj = $existing | ConvertFrom-Json
    if ($obj.AllocationId) {
      Write-Host "Reusing Elastic IP $($obj.PublicIp) ($($obj.AllocationId))"
      return @{ AllocationId = $obj.AllocationId; PublicIp = $obj.PublicIp }
    }
  }
  $alloc = aws ec2 allocate-address --domain vpc --region $Region | ConvertFrom-Json
  aws ec2 create-tags --resources $alloc.AllocationId --region $Region `
    --tags "Key=Name,Value=$NameTag" | Out-Null
  Write-Host "Allocated Elastic IP $($alloc.PublicIp) ($($alloc.AllocationId))"
  return @{ AllocationId = $alloc.AllocationId; PublicIp = $alloc.PublicIp }
}

$nlbName = "$NamePrefix-api-nlb"
$tgName = "$NamePrefix-api-tg"
$ssmTg = "/$NamePrefix/target-group-arn"
$ssmIp = "/$NamePrefix/api-public-ip"
$ssmUrl = "/$NamePrefix/api-url"

$vpcId = (aws ec2 describe-vpcs --filters Name=isDefault,Values=true --region $Region `
  --query "Vpcs[0].VpcId" --output text).Trim()
if (-not $vpcId -or $vpcId -eq "None") { throw "No default VPC in $Region" }

$subnetId = (aws ec2 describe-subnets --filters "Name=vpc-id,Values=$vpcId" --region $Region `
  --query "Subnets | sort_by(@, &AvailabilityZone)[0].SubnetId" --output text).Trim()
if (-not $subnetId -or $subnetId -eq "None") { throw "No subnets in VPC $vpcId" }

Write-Host "VPC $vpcId  subnet $subnetId" -ForegroundColor Cyan

$eip = Get-OrCreateElasticIp -NameTag "$NamePrefix-api-eip"

$nlbArn = ""
try {
  $nlbArn = (aws elbv2 describe-load-balancers --names $nlbName --region $Region `
    --query "LoadBalancers[0].LoadBalancerArn" --output text 2>$null).Trim()
} catch { $nlbArn = "" }
if (-not $nlbArn -or $nlbArn -eq "None") {
  $mapping = "SubnetId=$subnetId,AllocationId=$($eip.AllocationId)"
  $nlbArn = (aws elbv2 create-load-balancer --name $nlbName --type network --scheme internet-facing `
    --subnet-mappings $mapping --region $Region | ConvertFrom-Json).LoadBalancers[0].LoadBalancerArn
  Write-Host "Created NLB $nlbName"
} else {
  Write-Host "NLB exists $nlbName"
}

$tgArn = ""
try {
  $tgArn = (aws elbv2 describe-target-groups --names $tgName --region $Region `
    --query "TargetGroups[0].TargetGroupArn" --output text 2>$null).Trim()
} catch { $tgArn = "" }
if (-not $tgArn -or $tgArn -eq "None") {
  $tgArn = (aws elbv2 create-target-group --name $tgName --protocol TCP --port 4000 `
    --vpc-id $vpcId --target-type ip --region $Region `
    --health-check-protocol HTTP --health-check-path /health --health-check-port 4000 `
    --matcher HttpCode=200 --healthy-threshold-count 2 --unhealthy-threshold-count 2 `
    --health-check-interval-seconds 30 | ConvertFrom-Json).TargetGroups[0].TargetGroupArn
  Write-Host "Created target group $tgName"
} else {
  Write-Host "Target group exists $tgName"
}

$listeners = aws elbv2 describe-listeners --load-balancer-arn $nlbArn --region $Region `
  --query "Listeners[?Port==\`"4000\`"].ListenerArn" --output text 2>$null
if (-not $listeners -or $listeners.Trim() -eq "None" -or $listeners.Trim() -eq "") {
  aws elbv2 create-listener --load-balancer-arn $nlbArn --protocol TCP --port 4000 `
    --default-actions "Type=forward,TargetGroupArn=$tgArn" --region $Region | Out-Null
  Write-Host "Created NLB listener TCP 4000"
} else {
  Write-Host "NLB listener TCP 4000 exists"
}

$apiUrl = "http://$($eip.PublicIp):4000"
aws ssm put-parameter --name $ssmTg --value $tgArn --type String --overwrite --region $Region | Out-Null
aws ssm put-parameter --name $ssmIp --value $eip.PublicIp --type String --overwrite --region $Region | Out-Null
aws ssm put-parameter --name $ssmUrl --value $apiUrl --type String --overwrite --region $Region | Out-Null

Write-Host ""
Write-Host "=== Stable API endpoint (does not change on ECS redeploy) ===" -ForegroundColor Green
Write-Host "API_URL=$apiUrl"
Write-Host "Elastic IP: $($eip.PublicIp)"
Write-Host "Target group: $tgArn"
Write-Host ""
Write-Host "Next: redeploy the backend so ECS registers tasks with the NLB:"
Write-Host "  bash infra/aws-cheapest/scripts/deploy-backend.sh   (CI or after cli-deploy)"
Write-Host "  or .\infra\aws-cheapest\cli-deploy.ps1"
Write-Host ""
Write-Host "Then set Vercel / frontend env once:"
Write-Host "  NEXT_PUBLIC_API_BASE=$apiUrl"
Write-Host "  (or NEXT_PUBLIC_API_BASE=/api and API_URL=$apiUrl if using the proxy)"

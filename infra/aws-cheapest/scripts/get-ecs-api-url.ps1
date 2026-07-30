<#
.SYNOPSIS
  Print the API URL for the oetlms-api service (stable Elastic IP if NLB is configured, else task IP).

.EXAMPLE
  .\infra\aws-cheapest\scripts\get-ecs-api-url.ps1
#>
[CmdletBinding()]
param(
  [string] $Region = "us-east-1",
  [string] $NamePrefix = "oetlms"
)

$ErrorActionPreference = "Stop"

$ssmUrl = "/$NamePrefix/api-url"
$stable = (
  aws ssm get-parameter --name $ssmUrl --region $Region --query "Parameter.Value" --output text 2>$null
)
if ($stable -and $stable -ne "None") {
  Write-Host "API_URL=$stable"
  Write-Host "(Stable Elastic IP - set once in Vercel / .env)"
  Write-Host ""
  Write-Host "Health check:"
  Write-Host "  curl.exe $stable/health"
  exit 0
}

$cluster = "$NamePrefix-cluster"
$service = "$NamePrefix-api"

$taskArn = (
  aws ecs list-tasks --cluster $cluster --service-name $service --desired-status RUNNING `
    --region $Region --query "taskArns[0]" --output text
).Trim()

if (-not $taskArn -or $taskArn -eq "None") {
  Write-Error "No RUNNING task for service $service. Run setup-stable-api.ps1 for a fixed IP."
}

$eni = (
  aws ecs describe-tasks --cluster $cluster --tasks $taskArn --region $Region `
    --query "tasks[0].attachments[0].details[?name=='networkInterfaceId'].value | [0]" --output text
).Trim()

$publicIp = (
  aws ec2 describe-network-interfaces --network-interface-ids $eni --region $Region `
    --query "NetworkInterfaces[0].Association.PublicIp" --output text
).Trim()

if (-not $publicIp -or $publicIp -eq "None") {
  Write-Error "Task has no public IP. Run setup-stable-api.ps1 for NLB + Elastic IP."
}

$apiUrl = "http://${publicIp}:4000"
Write-Host "API_URL=$apiUrl"
Write-Host "(Ephemeral task IP - changes on redeploy. Run setup-stable-api.ps1 to fix.)"
Write-Host ""
Write-Host "Health check:"
Write-Host "  curl.exe $apiUrl/health"

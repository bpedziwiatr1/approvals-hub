# Builds the page, stages the solution sources in out/staging and packs the managed and unmanaged zips into out/.
# Needs Node and the Power Platform CLI (pac). Same steps as build-solution.sh.
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
function Invoke-Native { & $args[0] $args[1..($args.Length - 1)]; if ($LASTEXITCODE -ne 0) { throw "$($args -join ' ') failed with exit code $LASTEXITCODE" } }

Invoke-Native node scripts/solution.mjs check
Invoke-Native npm run build
Invoke-Native node scripts/check-dist.mjs
$staged = (& node scripts/solution.mjs stage)
if ($LASTEXITCODE -ne 0) { throw 'solution.mjs stage failed' }
New-Item -ItemType Directory -Force out | Out-Null
foreach ($kind in 'managed', 'unmanaged') {
  $name = (& node scripts/solution.mjs name $kind)
  if ($LASTEXITCODE -ne 0) { throw 'solution.mjs name failed' }
  $type = (Get-Culture).TextInfo.ToTitleCase($kind)
  Invoke-Native pac solution pack --zipfile "out/$name" --folder $staged --packagetype $type --errorlevel Warning
  Write-Host "Packed out/$name"
}

param([ValidateSet('dev','build','start','seed','test','typecheck')][string]$Command = 'dev')
$ErrorActionPreference = 'Stop'
$bundledNode = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
$selectedNode = if (Test-Path -LiteralPath $bundledNode) { $bundledNode } else { (Get-Command node).Source }
$version = & $selectedNode -p 'Number(process.versions.node.split(".")[0])'
if ([int]$version -lt 24) { throw 'Install Node.js 24 or newer before running MindSpine.' }
$env:Path = (Split-Path $selectedNode) + ';' + $env:Path
switch ($Command) {
 'dev' { & $selectedNode node_modules/next/dist/bin/next dev --hostname 127.0.0.1 }
 'build' { & $selectedNode node_modules/next/dist/bin/next build }
 'start' { & $selectedNode node_modules/next/dist/bin/next start --hostname 127.0.0.1 }
 'seed' { & $selectedNode --env-file-if-exists=.env.local --import tsx scripts/seed.ts }
 'test' { & $selectedNode --import tsx --test tests/domain.test.ts }
 'typecheck' { & $selectedNode node_modules/typescript/bin/tsc --noEmit }
}
exit $LASTEXITCODE

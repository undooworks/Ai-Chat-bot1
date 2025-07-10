# Kill any process using port 3001 or 3002 before starting backend
$ports = @(3001, 3002)
foreach ($port in $ports) {
    $pids = netstat -ano | Select-String ":$port\s" | ForEach-Object {
        ($_ -split '\s+')[-1]
    } | Select-Object -Unique
    foreach ($procId in $pids) {
        if ($procId -match '^\d+$') {
            try {
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
                Write-Host "[PRE-START] Killed process $procId on port $port"
            } catch {
                Write-Host "[PRE-START] Could not kill process $procId on port $port"
            }
        }
    }
}

Write-Host "[INFO] Pornesc backendul AI Chat Bot..."
$backendDir = Join-Path $PSScriptRoot '.'
Write-Host "[INFO] Director curent: $backendDir"
Set-Location $backendDir
Write-Host "[INFO] Pornesc serverul Node.js..."
node index.js 
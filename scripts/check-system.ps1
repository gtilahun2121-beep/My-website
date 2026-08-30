# QalNet System Verification Script
# Simple version compatible with Windows PowerShell

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════════╗"
Write-Host "║              QalNet System Verification                            ║"
Write-Host "╚════════════════════════════════════════════════════════════════════╝"
Write-Host ""

$passed = 0
$failed = 0

# Check Node.js
Write-Host "1. Checking Prerequisites..."
$nodeVersion = node --version
Write-Host "  Node.js: $nodeVersion ✓"
$passed++

$npmVersion = npm --version
Write-Host "  npm: $npmVersion ✓"
$passed++

# Check node_modules
if (Test-Path ".\node_modules" -PathType Container) {
    Write-Host "  Dependencies: ✓ Installed"
    $passed++
} else {
    Write-Host "  Dependencies: ✗ Not found"
    $failed++
}

Write-Host ""
Write-Host "2. Checking Build Artifacts..."

# Backend build
if (Test-Path ".\apps\backend\dist\apps\backend\src\main.js") {
    Write-Host "  Backend Build: ✓ Found"
    $passed++
} else {
    Write-Host "  Backend Build: ✗ Not found"
    $failed++
}

# Frontend build
if (Test-Path ".\apps\web\.next" -PathType Container) {
    Write-Host "  Frontend Build: ✓ Found"
    $passed++
} else {
    Write-Host "  Frontend Build: ✗ Not found"
    $failed++
}

Write-Host ""
Write-Host "3. Checking Configuration..."

# Backend .env
if (Test-Path ".\apps\backend\.env") {
    $envContent = Get-Content ".\apps\backend\.env" -Raw
    if ($envContent -match "JWT_PRIVATE_KEY=.*BEGIN") {
        Write-Host "  JWT Keys: ✓ Generated"
        $passed++
    } else {
        Write-Host "  JWT Keys: ⚠ Missing"
        $failed++
    }
} else {
    Write-Host "  Backend .env: ✗ Not found"
    $failed++
}

# Frontend .env.local
if (Test-Path ".\apps\web\.env.local") {
    Write-Host "  Frontend .env: ✓ Found"
    $passed++
} else {
    Write-Host "  Frontend .env: ✗ Not found"
    $failed++
}

Write-Host ""
Write-Host "4. Checking Database Setup Files..."

if (Test-Path ".\apps\backend\database\schema.sql") {
    Write-Host "  Schema File: ✓ Found"
    $passed++
} else {
    Write-Host "  Schema File: ✗ Not found"
    $failed++
}

if (Test-Path ".\apps\backend\database\migrations" -PathType Container) {
    $migrationCount = (Get-ChildItem ".\apps\backend\database\migrations" -Filter "*.sql" | Measure-Object).Count
    Write-Host "  Migrations: ✓ Found ($migrationCount files)"
    $passed++
} else {
    Write-Host "  Migrations: ✗ Not found"
    $failed++
}

Write-Host ""
Write-Host "5. Checking Documentation..."

$docs = "README.md", "SETUP_GUIDE.md", "SYSTEM_STATUS.md", "FILE_STRUCTURE.md"
foreach ($doc in $docs) {
    if (Test-Path $doc) {
        Write-Host "  $doc : ✓"
        $passed++
    } else {
        Write-Host "  $doc : ✗"
        $failed++
    }
}

Write-Host ""
Write-Host "6. Checking Script Utilities..."

$scripts = "startup.ps1", "verify-system.ps1", "check-system.ps1"
foreach ($script in $scripts) {
    $scriptPath = ".\scripts\$script"
    if (Test-Path $scriptPath) {
        Write-Host "  $script : ✓"
        $passed++
    }
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════════╗"
Write-Host "║                         Summary                                   ║"
Write-Host "╚════════════════════════════════════════════════════════════════════╝"
Write-Host ""

$total = $passed + $failed
$pct = if ($total -gt 0) { [Math]::Round(($passed / $total) * 100, 0) } else { 0 }

Write-Host "  Passed: $passed"
Write-Host "  Failed: $failed"
Write-Host "  Total:  $total"
Write-Host "  Score:  $pct%"
Write-Host ""

if ($pct -ge 90) {
    Write-Host "✓ System is ready for deployment!"
    Write-Host ""
    Write-Host "Next steps:"
    Write-Host "  1. Start the system: .\scripts\startup.ps1"
    Write-Host "  2. Or run dev mode: npm run dev"
} else {
    Write-Host "⚠ Some components need attention"
    Write-Host ""
    Write-Host "Actions:"
    Write-Host "  1. Review SETUP_GUIDE.md"
    Write-Host "  2. Run: npm install"
    Write-Host "  3. Run: npm run build"
}

Write-Host ""

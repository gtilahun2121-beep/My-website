# ============================================================================
# QalNet System Verification Script
# ============================================================================
# Comprehensive check of all system components
# Usage: .\scripts\verify-system.ps1
# ============================================================================

$script:checks = @()
$script:passed = 0
$script:failed = 0

function Add-Check {
    param([string]$Name, [bool]$Result, [string]$Details = "")
    $global:checks += @{
        Name    = $Name
        Result  = $Result
        Details = $Details
    }
    if ($Result) {
        $global:passed++
    } else {
        $global:failed++
    }
}

function Write-Header {
    param([string]$Text)
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════════════╗"
    Write-Host "║ $($Text.PadRight(66)) ║"
    Write-Host "╚════════════════════════════════════════════════════════════════════╝"
    Write-Host ""
}

function Write-CheckResult {
    param([string]$Name, [bool]$Passed, [string]$Details = "")
    if ($Passed) {
        Write-Host "  ✓ $Name"
    } else {
        Write-Host "  ✗ $Name"
    }
    if ($Details) {
        Write-Host "    └─ $Details"
    }
}

# Start verification
Write-Header "QalNet System Verification"

# ============================================================================
# Environment & Configuration
# ============================================================================
Write-Host "1. Environment Configuration"
Write-Host ""

# Check Node.js
$nodeVersion = (node --version).Trim()
$nodeCheck = $nodeVersion -like "v20*" -or $nodeVersion -like "v21*" -or $nodeVersion -like "v22*"
Add-Check "Node.js Version ($nodeVersion)" $nodeCheck "Requires v20+"
Write-CheckResult "Node.js Version" $nodeCheck "Installed: $nodeVersion"

# Check npm
$npmVersion = (npm --version).Trim()
$npmCheck = [version]$npmVersion -ge [version]"10.0.0"
Add-Check "npm Version ($npmVersion)" $npmCheck "Requires v10+"
Write-CheckResult "npm Version" $npmCheck "Installed: $npmVersion"

# Check node_modules
$nodeModulesExists = Test-Path ".\node_modules" -PathType Container
Add-Check "node_modules Directory" $nodeModulesExists
Write-CheckResult "Dependencies Installed" $nodeModulesExists

# Check environment files
$backendEnv = Test-Path ".\apps\backend\.env"
Add-Check "Backend .env File" $backendEnv
Write-CheckResult "Backend .env" $backendEnv

$frontendEnv = Test-Path ".\apps\web\.env.local"
Add-Check "Frontend .env.local File" $frontendEnv
Write-CheckResult "Frontend .env.local" $frontendEnv

Write-Host ""

# ============================================================================
# Build Artifacts
# ============================================================================
Write-Host "2. Build Artifacts"
Write-Host ""

$backendDist = Test-Path ".\apps\backend\dist" -PathType Container
Add-Check "Backend Dist Directory" $backendDist
Write-CheckResult "Backend Build Output" $backendDist

$backendMain = Test-Path ".\apps\backend\dist\apps\backend\src\main.js"
Add-Check "Backend Entry Point (main.js)" $backendMain
Write-CheckResult "Backend Entry Point" $backendMain "Path: dist/apps/backend/src/main.js"

$frontendNext = Test-Path ".\apps\web\.next" -PathType Container
Add-Check "Frontend .next Directory" $frontendNext
Write-CheckResult "Frontend Build Output" $frontendNext

$frontendStatic = Test-Path ".\apps\web\.next\static" -PathType Container
Add-Check "Frontend Static Assets" $frontendStatic
Write-CheckResult "Frontend Static Assets" $frontendStatic

Write-Host ""

# ============================================================================
# Configuration Files
# ============================================================================
Write-Host "3. Configuration Files"
Write-Host ""

# Check JWT keys
if ($backendEnv) {
    $envContent = Get-Content ".\apps\backend\.env" -Raw
    $hasPrivateKey = $envContent -match "JWT_PRIVATE_KEY=.*BEGIN"
    $hasPublicKey = $envContent -match "JWT_PUBLIC_KEY=.*BEGIN"
    
    Add-Check "JWT Private Key" $hasPrivateKey
    Write-CheckResult "JWT Private Key Generated" $hasPrivateKey
    
    Add-Check "JWT Public Key" $hasPublicKey
    Write-CheckResult "JWT Public Key Generated" $hasPublicKey
    
    # Check database URL
    $hasDb = $envContent -match "DATABASE_URL="
    Add-Check "Database URL Configured" $hasDb
    Write-CheckResult "Database URL Configured" $hasDb
    
    # Check Redis URL
    $hasRedis = $envContent -match "REDIS_URL="
    Add-Check "Redis URL Configured" $hasRedis
    Write-CheckResult "Redis URL Configured" $hasRedis
}

Write-Host ""

# ============================================================================
# Package Scripts
# ============================================================================
Write-Host "4. Package Scripts Availability"
Write-Host ""

$packageJson = Get-Content ".\package.json" | ConvertFrom-Json
$scripts = $packageJson.scripts | Get-Member -MemberType NoteProperty | Select-Object -ExpandProperty Name

$requiredScripts = @("dev", "build", "type-check", "test", "pm2:start")
foreach ($script in $requiredScripts) {
    $hasScript = $scripts -contains $script
    Add-Check "Script: $script" $hasScript
    Write-CheckResult "Script: npm run $script" $hasScript
}

Write-Host ""

Write-Host "5. External Services (Optional Check)"
Write-Host ""

# Check PostgreSQL
$pgCheck = $null
try {
    $pgCheck = psql --version 2>&1 | Select-Object -First 1
    $psqlAvailable = $LASTEXITCODE -eq 0
} catch {
    $psqlAvailable = $false
}

Add-Check "PostgreSQL Available (Optional)" $psqlAvailable $pgCheck
Write-CheckResult "PostgreSQL Available" $psqlAvailable "Status: $(if ($psqlAvailable) { $pgCheck.Trim() } else { 'Not installed (use Docker or cloud DB)' })"

# Check Redis
$redisCheck = $null
try {
    $redisCheck = redis-cli --version 2>&1 | Select-Object -First 1
    $redisAvailable = $LASTEXITCODE -eq 0
} catch {
    $redisAvailable = $false
}

Add-Check "Redis Available (Optional)" $redisAvailable $redisCheck
Write-CheckResult "Redis Available" $redisAvailable "Status: $(if ($redisAvailable) { $redisCheck.Trim() } else { 'Not installed (use Docker or cloud service)' })"

# Check Docker
$dockerCheck = $null
try {
    $dockerCheck = docker --version 2>&1 | Select-Object -First 1
    $dockerAvailable = $LASTEXITCODE -eq 0
} catch {
    $dockerAvailable = $false
}

Add-Check "Docker Available (Optional)" $dockerAvailable $dockerCheck
Write-CheckResult "Docker Available" $dockerAvailable "Status: $(if ($dockerAvailable) { $dockerCheck.Trim() } else { 'Not installed (see SETUP_GUIDE.md)' })"

Write-Host ""

# ============================================================================
# Database Schema Files
# ============================================================================
Write-Host "6. Database Schema Files"
Write-Host ""

$schemaFile = Test-Path ".\apps\backend\database\schema.sql"
Add-Check "Database Schema File" $schemaFile
Write-CheckResult "Database Schema" $schemaFile "File: apps/backend/database/schema.sql"

$migrationsDir = Test-Path ".\apps\backend\database\migrations" -PathType Container
Add-Check "Migrations Directory" $migrationsDir
Write-CheckResult "Database Migrations" $migrationsDir "Directory: apps/backend/database/migrations"

if ($migrationsDir) {
    $migrationFiles = Get-ChildItem ".\apps\backend\database\migrations" -Filter "*.sql" | Measure-Object
    Write-CheckResult "Migration Files" ($migrationFiles.Count -gt 0) "$($migrationFiles.Count) migration files"
}

Write-Host ""

# ============================================================================
# Source Code Structure
# ============================================================================
Write-Host "7. Source Code Structure"
Write-Host ""

# Check backend modules
$backendModules = @("auth", "users", "equbs", "payments", "notifications")
$modulesFound = 0
foreach ($module in $backendModules) {
    $modulePath = ".\apps\backend\src\modules\$module"
    if (Test-Path $modulePath -PathType Container) {
        $modulesFound++
    }
}

Add-Check "Backend Modules ($modulesFound/$($backendModules.Count))" ($modulesFound -eq $backendModules.Count)
Write-CheckResult "Backend Modules" ($modulesFound -eq $backendModules.Count) "Found: $modulesFound/$($backendModules.Count) core modules"

# Check frontend pages
$frontendPages = @("dashboard", "admin", "login")
$pagesFound = 0
foreach ($page in $frontendPages) {
    $pagePath = ".\apps\web\src\app\$page"
    if (Test-Path $pagePath -PathType Container) {
        $pagesFound++
    }
}

Add-Check "Frontend Pages" ($pagesFound -gt 0)
Write-CheckResult "Frontend Pages" ($pagesFound -gt 0) "Pages configured"

Write-Host ""

# ============================================================================
# Documentation
# ============================================================================
Write-Host "8. Documentation"
Write-Host ""

$docs = @(
    @{Name = "README.md"; Path = ".\README.md"},
    @{Name = "SETUP_GUIDE.md"; Path = ".\SETUP_GUIDE.md"},
    @{Name = "SYSTEM_STATUS.md"; Path = ".\SYSTEM_STATUS.md"},
    @{Name = "FILE_STRUCTURE.md"; Path = ".\FILE_STRUCTURE.md"}
)

foreach ($doc in $docs) {
    $exists = Test-Path $doc.Path
    Add-Check $doc.Name $exists
    Write-CheckResult $doc.Name $exists
}

Write-Host ""

# ============================================================================
# Summary
# ============================================================================
$total = $passed + $failed
$percentage = if ($total -gt 0) { [Math]::Round(($passed / $total) * 100) } else { 0 }

Write-Header "Verification Summary"

Write-Host "Results:"
Write-Host "  Passed: $passed"
Write-Host "  Failed: $failed"
Write-Host "  Total:  $total"
Write-Host "  Score:  $percentage%"
Write-Host ""

if ($percentage -ge 95) {
    Write-Host "✓ System is ready for use!"
    Write-Host ""
    Write-Host "Next steps:"
    Write-Host "  1. Start services: .\scripts\startup.ps1"
    Write-Host "  2. Or run directly: npm run dev"
    Write-Host ""
} elseif ($percentage -ge 70) {
    Write-Host "⚠ System is mostly ready"
    Write-Host ""
    Write-Host "Suggested actions:"
    Write-Host "  1. Install missing optional services (Docker, PostgreSQL, Redis)"
    Write-Host "  2. Follow SETUP_GUIDE.md for detailed instructions"
    Write-Host "  3. Run: .\scripts\startup.ps1"
    Write-Host ""
} else {
    Write-Host "✗ System needs setup"
    Write-Host ""
    Write-Host "To fix:"
    Write-Host "  1. Run: npm install"
    Write-Host "  2. Run: npm run build"
    Write-Host "  3. Follow SETUP_GUIDE.md"
    Write-Host ""
}

Write-Host "For more info: SETUP_GUIDE.md, SYSTEM_STATUS.md"
Write-Host ""

exit if ($failed -eq 0) { 0 } else { 1 }

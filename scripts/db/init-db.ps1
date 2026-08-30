# ============================================================================
# QalNet Database Initialization Script
# ============================================================================
# This script initializes the PostgreSQL database with schema and migrations
# Usage: .\scripts\db\init-db.ps1
# ============================================================================

param(
    [string]$Host = "localhost",
    [int]$Port = 5432,
    [string]$User = "postgres",
    [string]$Password = "postgres",
    [string]$Database = "qalnet_dev"
)

$ErrorActionPreference = "Stop"

Write-Host "╔════════════════════════════════════════════════════════════════════╗"
Write-Host "║        QalNet Database Initialization Script                       ║"
Write-Host "║        PostgreSQL Database Setup with Schema & Migrations          ║"
Write-Host "╚════════════════════════════════════════════════════════════════════╝"
Write-Host ""

# ============================================================================
# Check PostgreSQL connectivity
# ============================================================================
Write-Host "Step 1: Checking PostgreSQL connectivity..."
Write-Host "  Host: $Host"
Write-Host "  Port: $Port"
Write-Host "  User: $User"
Write-Host "  Database: $Database"
Write-Host ""

$env:PGPASSWORD = $Password

try {
    $output = psql -h $Host -p $Port -U $User -d postgres -t -c "SELECT version();" 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "PostgreSQL connection failed: $output"
    }
    Write-Host "✓ PostgreSQL is running"
    Write-Host "  Version: $($output -split 'PostgreSQL' | Select-Object -Last 1)"
} catch {
    Write-Host "✗ Failed to connect to PostgreSQL"
    Write-Host "  Error: $_"
    Write-Host ""
    Write-Host "Troubleshooting:"
    Write-Host "  1. Verify PostgreSQL is installed and running"
    Write-Host "  2. Check host/port: psql -h $Host -p $Port"
    Write-Host "  3. Verify user exists: psql -U postgres"
    Write-Host "  4. Check password is correct"
    Write-Host ""
    exit 1
}

Write-Host ""

# ============================================================================
# Check if database exists
# ============================================================================
Write-Host "Step 2: Checking if database exists..."

$dbExists = psql -h $Host -p $Port -U $User -d postgres -t -c "SELECT 1 FROM pg_database WHERE datname = '$Database';" 2>&1 | Select-Object -First 1

if ($dbExists -eq "1") {
    Write-Host "✓ Database '$Database' already exists"
} else {
    Write-Host "  Creating database '$Database'..."
    psql -h $Host -p $Port -U $User -d postgres -c "CREATE DATABASE $Database;" 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Database '$Database' created successfully"
    } else {
        Write-Host "✗ Failed to create database"
        exit 1
    }
}

Write-Host ""

# ============================================================================
# Initialize schema
# ============================================================================
Write-Host "Step 3: Loading database schema..."

$schemaPath = ".\apps\backend\database\schema.sql"
if (-not (Test-Path $schemaPath)) {
    Write-Host "✗ Schema file not found: $schemaPath"
    exit 1
}

Write-Host "  Schema file: $schemaPath"

try {
    $schemaSize = (Get-Item $schemaPath).Length / 1MB
    Write-Host "  File size: $([Math]::Round($schemaSize, 2)) MB"
    
    # Load schema
    psql -h $Host -p $Port -U $User -d $Database -f $schemaPath 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Database schema loaded successfully"
    } else {
        Write-Host "✗ Failed to load schema"
        exit 1
    }
} catch {
    Write-Host "✗ Error loading schema: $_"
    exit 1
}

Write-Host ""

# ============================================================================
# Verify tables were created
# ============================================================================
Write-Host "Step 4: Verifying tables..."

$tableCount = psql -h $Host -p $Port -U $User -d $Database -t -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';" 2>&1 | Select-Object -First 1 | ForEach-Object { $_.Trim() }

Write-Host "  Total tables: $tableCount"

$tables = psql -h $Host -p $Port -U $User -d $Database -t -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;" 2>&1

if ([int]$tableCount -gt 0) {
    Write-Host "✓ Database schema verified"
    Write-Host ""
    Write-Host "  Tables created:"
    $tables | ForEach-Object { 
        if ($_.Trim() -ne "") {
            Write-Host "    • $($_.Trim())"
        }
    }
} else {
    Write-Host "✗ No tables found in database"
    exit 1
}

Write-Host ""

# ============================================================================
# Check for admin user
# ============================================================================
Write-Host "Step 5: Checking for admin user..."

$adminExists = psql -h $Host -p $Port -U $User -d $Database -t -c "SELECT COUNT(*) FROM users WHERE role = 'admin';" 2>&1 | Select-Object -First 1 | ForEach-Object { $_.Trim() }

if ([int]$adminExists -gt 0) {
    Write-Host "✓ Admin user already exists ($adminExists admin(s) found)"
} else {
    Write-Host "⚠ No admin user found"
    Write-Host "  Run: node apps/backend/scripts/seed-admin.cjs"
}

Write-Host ""

# ============================================================================
# Connection string confirmation
# ============================================================================
Write-Host "Step 6: Connection Details"
Write-Host ""
Write-Host "  DATABASE_URL="
Write-Host "    postgresql://$User`:$($Password -replace '(.)', '*')@$Host`:$Port/$Database"
Write-Host ""
Write-Host "  Environment variable already configured in:"
Write-Host "    apps/backend/.env"
Write-Host ""

# ============================================================================
# Summary
# ============================================================================
Write-Host "╔════════════════════════════════════════════════════════════════════╗"
Write-Host "║                      Setup Completed ✓                            ║"
Write-Host "╚════════════════════════════════════════════════════════════════════╝"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Seed admin user: node apps/backend/scripts/seed-admin.cjs"
Write-Host "  2. Start dev servers: npm run dev"
Write-Host "  3. Access API: http://localhost:4000/api/docs"
Write-Host "  4. Access frontend: http://localhost:3001"
Write-Host ""

Remove-Item env:PGPASSWORD -ErrorAction SilentlyContinue

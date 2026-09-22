# ============================================================================
# QalNet System Startup Script
# ============================================================================
# This script guides through the complete setup process
# Usage: .\scripts\startup.ps1
# ============================================================================

$ErrorActionPreference = "Continue"

function Write-Header {
    param([string]$Text)
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════════════╗"
    Write-Host "║ $($Text.PadRight(66)) ║"
    Write-Host "╚════════════════════════════════════════════════════════════════════╝"
    Write-Host ""
}

function Write-Step {
    param([string]$Text, [int]$Number)
    Write-Host "  [$Number] $Text"
}

function Test-CommandExists {
    param([string]$Command)
    try {
        if (Get-Command $Command -ErrorAction Stop) { return $true }
    }
    catch { return $false }
}

# Main Script
Write-Host ""
Write-Header "QalNet System Startup Helper"

Write-Host "This script will guide you through starting QalNet with all services."
Write-Host ""
Write-Host "Prerequisites:"
Write-Host "  ✓ Node.js 20+ installed"
Write-Host "  ✓ npm 10+ installed"
Write-Host "  ✓ Dependencies installed (npm install)"
Write-Host ""

# Check prerequisites
Write-Host "Checking prerequisites..."
$nodeVersion = node --version
$npmVersion = npm --version
Write-Host "  ✓ Node.js: $nodeVersion"
Write-Host "  ✓ npm: $npmVersion"
Write-Host ""

# Menu
Write-Host "Choose your setup option:"
Write-Host ""
Write-Host "  [1] Quick Start (Development mode only, no database)"
Write-Host "  [2] Docker Setup (PostgreSQL + Redis in containers)"
Write-Host "  [3] Local PostgreSQL Setup (requires local installation)"
Write-Host "  [4] Cloud Setup (Neon PostgreSQL)"
Write-Host "  [5] Production Setup (PM2 with all services)"
Write-Host ""

$choice = Read-Host "Enter choice (1-5)"

Write-Host ""

switch ($choice) {
    "1" {
        Write-Header "Quick Start Mode"
        Write-Host "Starting development servers without database..."
        Write-Host ""
        Write-Step "Starting frontend at http://localhost:3001" 1
        Write-Step "API will be unavailable (no database)" 2
        Write-Host ""
        Write-Host "Press Ctrl+C to stop."
        Write-Host ""
        npm run dev
    }

    "2" {
        Write-Header "Docker Setup"
        
        Write-Host "Checking Docker installation..."
        if (-not (Test-CommandExists "docker")) {
            Write-Host "✗ Docker is not installed"
            Write-Host "  Install from: https://www.docker.com/products/docker-desktop"
            exit 1
        }
        Write-Host "✓ Docker is installed"
        Write-Host ""
        
        Write-Host "Checking Docker daemon..."
        $dockerCheck = docker ps 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "✗ Docker daemon is not running"
            Write-Host "  Start Docker Desktop and try again"
            exit 1
        }
        Write-Host "✓ Docker daemon is running"
        Write-Host ""
        
        Write-Step "Starting PostgreSQL and Redis containers" 1
        docker-compose -f docker-compose-lite.yml up -d
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Containers started"
            Write-Host ""
            Start-Sleep -Seconds 3
            
            Write-Step "Waiting for services to be ready (30 seconds)..." 2
            for ($i = 1; $i -le 30; $i++) {
                Write-Host -NoNewline "."
                Start-Sleep -Seconds 1
            }
            Write-Host ""
            Write-Host ""
            
            Write-Step "Checking database connectivity" 3
            $dbCheck = node scripts/db/dbcheck.cjs 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✓ Database is ready"
            } else {
                Write-Host "⚠ Database check failed (may still be initializing)"
            }
            Write-Host ""
            
            Write-Step "Seeding admin user" 4
            node apps/backend/scripts/seed-admin.cjs 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✓ Admin user seeded"
            } else {
                Write-Host "⚠ Admin seeding may have failed"
            }
            Write-Host ""
            
            Write-Step "Starting development servers" 5
            Write-Host ""
            npm run dev
        } else {
            Write-Host "✗ Failed to start containers"
        }
    }

    "3" {
        Write-Header "Local PostgreSQL Setup"
        
        Write-Host "Checking PostgreSQL installation..."
        if (-not (Test-CommandExists "psql")) {
            Write-Host "✗ PostgreSQL psql is not available"
            Write-Host ""
            Write-Host "To install PostgreSQL:"
            Write-Host "  1. Download: https://www.postgresql.org/download/windows/"
            Write-Host "  2. Run installer for PostgreSQL 18"
            Write-Host "  3. Remember the password you set"
            Write-Host "  4. Run this script again"
            exit 1
        }
        Write-Host "✓ PostgreSQL is installed"
        Write-Host ""
        
        Write-Step "Initializing PostgreSQL database" 1
        .\scripts\db\init-db.ps1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Step "Seeding admin user" 2
            node apps/backend/scripts/seed-admin.cjs 2>&1
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✓ Admin user seeded"
            } else {
                Write-Host "⚠ Admin seeding failed"
            }
            Write-Host ""
            
            Write-Step "Starting development servers" 3
            Write-Host ""
            npm run dev
        } else {
            Write-Host "✗ Database initialization failed"
        }
    }

    "4" {
        Write-Header "Cloud Setup (Neon PostgreSQL)"
        Write-Host "Follow these steps to set up with Neon:"
        Write-Host ""
        Write-Host "  1. Visit: https://console.neon.tech"
        Write-Host "  2. Create a new account or sign in"
        Write-Host "  3. Create a new project"
        Write-Host "  4. Copy the connection string"
        Write-Host "  5. Update apps/backend/.env:"
        Write-Host "     DATABASE_URL=<your-neon-connection-string>"
        Write-Host ""
        Write-Host "  6. Run database initialization:"
        Write-Host "     node scripts/db/dbcheck.cjs"
        Write-Host ""
        Write-Host "  7. Seed admin user:"
        Write-Host "     node apps/backend/scripts/seed-admin.cjs"
        Write-Host ""
        Write-Host "  8. Start development:"
        Write-Host "     npm run dev"
        Write-Host ""
    }

    "5" {
        Write-Header "Production Setup (PM2)"
        
        Write-Host "This will build and start both apps with PM2."
        Write-Host "Apps will auto-restart on failure and persist across reboots."
        Write-Host ""
        
        if (-not (Test-CommandExists "pm2")) {
            Write-Host "Installing PM2 globally..."
            npm install -g pm2
        }
        
        Write-Step "Building application" 1
        npm run build
        if ($LASTEXITCODE -ne 0) {
            Write-Host "✗ Build failed"
            exit 1
        }
        Write-Host "✓ Build successful"
        Write-Host ""
        
        Write-Step "Starting with PM2" 2
        npm run pm2:start
        Write-Host ""
        
        Write-Step "Checking status" 3
        npm run pm2:status
        Write-Host ""
        
        Write-Host "Production servers are now running!"
        Write-Host ""
        Write-Host "Backend:  http://localhost:4000"
        Write-Host "Frontend: http://localhost:3001"
        Write-Host ""
        Write-Host "Useful commands:"
        Write-Host "  npm run pm2:logs    # View live logs"
        Write-Host "  npm run pm2:status  # Check health"
        Write-Host "  npm run pm2:restart # Restart apps"
        Write-Host "  npm run pm2:stop    # Stop apps"
        Write-Host ""
    }

    default {
        Write-Host "Invalid choice. Exiting."
        exit 1
    }
}

Write-Host ""
Write-Header "Setup Complete"
Write-Host "Access QalNet at: http://localhost:3001"
Write-Host "API Docs at: http://localhost:4000/api/docs"
Write-Host ""

# QalNet API Endpoint Testing Script
# Tests core API endpoints after services are running
# Usage: .\scripts\test-api.ps1

$baseUrl = "http://localhost:4000/api/v1"
$frontendUrl = "http://localhost:3001"

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════════╗"
Write-Host "║           QalNet API Endpoint Testing Script                      ║"
Write-Host "╚════════════════════════════════════════════════════════════════════╝"
Write-Host ""

$testsPassed = 0
$testsFailed = 0

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Method = "GET",
        [hashtable]$Headers = @{},
        [string]$Body = ""
    )
    
    Write-Host "Testing: $Name"
    Write-Host "  URL: $Url"
    
    try {
        if ($Method -eq "GET") {
            $response = Invoke-WebRequest -Uri $Url -Method GET -Headers $Headers -ErrorAction Stop -TimeoutSec 10
        } elseif ($Method -eq "POST") {
            $response = Invoke-WebRequest -Uri $Url -Method POST -Headers $Headers -Body $Body -ContentType "application/json" -ErrorAction Stop -TimeoutSec 10
        }
        
        if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 201 -or $response.StatusCode -eq 204) {
            Write-Host "  Status: $($response.StatusCode) - OK"
            $script:testsPassed++
            return $true
        } else {
            Write-Host "  Status: $($response.StatusCode) - Unexpected"
            $script:testsFailed++
            return $false
        }
    }
    catch {
        Write-Host "  Error: $($_.Exception.Message)"
        $script:testsFailed++
        return $false
    }
    Write-Host ""
}

# Check if services are running
Write-Host "1. Checking if services are running..."
Write-Host ""

$backendReady = $false
$frontendReady = $false

try {
    $response = Invoke-WebRequest -Uri "$baseUrl/health" -Method GET -ErrorAction Stop -TimeoutSec 5
    $backendReady = $true
    Write-Host "✓ Backend is running at $baseUrl"
} catch {
    Write-Host "✗ Backend not responding at $baseUrl"
    Write-Host "  Make sure: npm run dev"
    Write-Host ""
    exit 1
}

try {
    $response = Invoke-WebRequest -Uri $frontendUrl -Method GET -ErrorAction Stop -TimeoutSec 5
    $frontendReady = $true
    Write-Host "✓ Frontend is running at $frontendUrl"
} catch {
    Write-Host "✗ Frontend not responding at $frontendUrl"
}

Write-Host ""

# Test API endpoints
Write-Host "2. Testing API Endpoints..."
Write-Host ""

# Health check
Test-Endpoint "Health Check" "$baseUrl/health"

# Auth endpoints
Write-Host ""
Write-Host "3. Testing Authentication Endpoints..."
Write-Host ""

# Get available OTP
Test-Endpoint "Check Phone Availability" "$baseUrl/auth/check-availability?phone=%2B251900000000"

# Get all users (admin check)
Write-Host ""
Write-Host "4. Testing User Management..."
Write-Host ""

Test-Endpoint "Get All Users" "$baseUrl/users"

# Frontend pages
if ($frontendReady) {
    Write-Host ""
    Write-Host "5. Testing Frontend Pages..."
    Write-Host ""
    
    Test-Endpoint "Home Page" $frontendUrl
    Test-Endpoint "Login Page" "$frontendUrl/login"
    Test-Endpoint "Dashboard" "$frontendUrl/dashboard"
}

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════════╗"
Write-Host "║                         Test Summary                              ║"
Write-Host "╚════════════════════════════════════════════════════════════════════╝"
Write-Host ""

$total = $testsPassed + $testsFailed
$pct = if ($total -gt 0) { [Math]::Round(($testsPassed / $total) * 100) } else { 0 }

Write-Host "  Tests Passed: $testsPassed"
Write-Host "  Tests Failed: $testsFailed"
Write-Host "  Total Tests:  $total"
Write-Host "  Success Rate: $pct%"
Write-Host ""

if ($testsFailed -eq 0) {
    Write-Host "✓ All tests passed! System is fully operational."
} else {
    Write-Host "⚠ Some tests failed. Check service status."
}

Write-Host ""

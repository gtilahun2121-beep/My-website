# Start ngrok tunnel for the NestJS Backend (Port 3000)
# This allows mobile devices and external services (like Telebirr webhooks) to reach the local backend.
# Run this in a new terminal window.

Write-Host "Starting ngrok tunnel for backend on port 3000..." -ForegroundColor Green
Write-Host "Please copy the https://...ngrok-free.app URL and paste it into apps/web/.env.local" -ForegroundColor Yellow
ngrok http 3000

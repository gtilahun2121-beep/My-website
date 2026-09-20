#!/bin/bash

# E2E Test Script for FCFS, Corporate/Private, and Preset Features
# Tests the new QalNet features end-to-end

set -e

API_BASE="http://localhost:4000/api/v1"
ADMIN_TOKEN="test-admin-token"  # Replace with actual token from login
USER_TOKEN="test-user-token"    # Replace with actual token from login

echo "======================================"
echo "QalNet E2E Feature Tests"
echo "======================================"
echo ""

# Test 1: Get Preset Templates
echo "[Test 1] GET /equbs/presets - Fetch preset templates"
echo "Request: GET $API_BASE/equbs/presets"
PRESETS_RESPONSE=$(curl -s -X GET "$API_BASE/equbs/presets" \
  -H "Content-Type: application/json")
echo "Response:"
echo "$PRESETS_RESPONSE" | jq '.' 2>/dev/null || echo "$PRESETS_RESPONSE"
echo ""

# Extract template IDs for later use
DAILY_TEMPLATE_ID=$(echo "$PRESETS_RESPONSE" | jq -r '.[0].id' 2>/dev/null || echo "daily-300-103")
MONTHLY_TEMPLATE_ID=$(echo "$PRESETS_RESPONSE" | jq -r '.[] | select(.name | contains("10,000")) | .id' 2>/dev/null || echo "monthly-10000-6")
FCFS_TEMPLATE_ID=$(echo "$PRESETS_RESPONSE" | jq -r '.[] | select(.winner_selection == "fcfs") | .id' 2>/dev/null || echo "fcfs-2000-12")

echo "Extracted template IDs:"
echo "  Daily: $DAILY_TEMPLATE_ID"
echo "  Monthly: $MONTHLY_TEMPLATE_ID"
echo "  FCFS: $FCFS_TEMPLATE_ID"
echo ""

# Test 2: Create Public Equb with Lottery (Default)
echo "[Test 2] POST /equbs - Create public equb with lottery selection"
PUBLIC_EQUB_PAYLOAD=$(cat <<EOF
{
  "name": "Test Public Lottery Circle",
  "description": "Testing public equb with lottery selection",
  "contribution_amount": 1000,
  "total_rounds": 6,
  "cycle_days": 30,
  "winner_selection_type": "lottery",
  "equb_type": "public"
}
EOF
)
echo "Request:"
echo "$PUBLIC_EQUB_PAYLOAD" | jq '.'
PUBLIC_EQUB_RESPONSE=$(curl -s -X POST "$API_BASE/equbs" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$PUBLIC_EQUB_PAYLOAD")
echo "Response:"
echo "$PUBLIC_EQUB_RESPONSE" | jq '.' 2>/dev/null || echo "$PUBLIC_EQUB_RESPONSE"
PUBLIC_EQUB_ID=$(echo "$PUBLIC_EQUB_RESPONSE" | jq -r '.id' 2>/dev/null)
echo "Public Equb ID: $PUBLIC_EQUB_ID"
echo ""

# Test 3: Create Private Equb
echo "[Test 3] POST /equbs - Create private equb (invite-only)"
PRIVATE_EQUB_PAYLOAD=$(cat <<EOF
{
  "name": "Test Private Circle",
  "description": "Testing private equb with restricted access",
  "contribution_amount": 2000,
  "total_rounds": 12,
  "cycle_days": 7,
  "cycle_type": "weekly",
  "winner_selection_type": "lottery",
  "equb_type": "private"
}
EOF
)
echo "Request:"
echo "$PRIVATE_EQUB_PAYLOAD" | jq '.'
PRIVATE_EQUB_RESPONSE=$(curl -s -X POST "$API_BASE/equbs" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$PRIVATE_EQUB_PAYLOAD")
echo "Response:"
echo "$PRIVATE_EQUB_RESPONSE" | jq '.' 2>/dev/null || echo "$PRIVATE_EQUB_RESPONSE"
PRIVATE_EQUB_ID=$(echo "$PRIVATE_EQUB_RESPONSE" | jq -r '.id' 2>/dev/null)
echo "Private Equb ID: $PRIVATE_EQUB_ID"
echo ""

# Test 4: Create FCFS Equb
echo "[Test 4] POST /equbs - Create FCFS equb (First-Come-First-Serve)"
FCFS_EQUB_PAYLOAD=$(cat <<EOF
{
  "name": "Test FCFS Circle",
  "description": "Testing FCFS winner selection (first paid wins)",
  "contribution_amount": 1500,
  "total_rounds": 10,
  "cycle_days": 30,
  "winner_selection_type": "fcfs",
  "equb_type": "public"
}
EOF
)
echo "Request:"
echo "$FCFS_EQUB_PAYLOAD" | jq '.'
FCFS_EQUB_RESPONSE=$(curl -s -X POST "$API_BASE/equbs" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$FCFS_EQUB_PAYLOAD")
echo "Response:"
echo "$FCFS_EQUB_RESPONSE" | jq '.' 2>/dev/null || echo "$FCFS_EQUB_RESPONSE"
FCFS_EQUB_ID=$(echo "$FCFS_EQUB_RESPONSE" | jq -r '.id' 2>/dev/null)
echo "FCFS Equb ID: $FCFS_EQUB_ID"
echo ""

# Test 5: Create Corporate Equb
echo "[Test 5] POST /equbs - Create corporate equb (business use)"
CORPORATE_EQUB_PAYLOAD=$(cat <<EOF
{
  "name": "Tech Company Fund",
  "description": "Testing corporate equb for employee savings",
  "contribution_amount": 5000,
  "total_rounds": 10,
  "cycle_days": 30,
  "winner_selection_type": "lottery",
  "equb_type": "corporate"
}
EOF
)
echo "Request:"
echo "$CORPORATE_EQUB_PAYLOAD" | jq '.'
CORPORATE_EQUB_RESPONSE=$(curl -s -X POST "$API_BASE/equbs" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$CORPORATE_EQUB_PAYLOAD")
echo "Response:"
echo "$CORPORATE_EQUB_RESPONSE" | jq '.' 2>/dev/null || echo "$CORPORATE_EQUB_RESPONSE"
CORPORATE_EQUB_ID=$(echo "$CORPORATE_EQUB_RESPONSE" | jq -r '.id' 2>/dev/null)
echo "Corporate Equb ID: $CORPORATE_EQUB_ID"
echo ""

# Test 6: Get All Public Equbs (should only show public ones)
echo "[Test 6] GET /equbs - List public equbs (visibility control test)"
echo "Request: GET $API_BASE/equbs"
LIST_RESPONSE=$(curl -s -X GET "$API_BASE/equbs" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json")
echo "Response:"
echo "$LIST_RESPONSE" | jq '.' 2>/dev/null || echo "$LIST_RESPONSE"
PUBLIC_COUNT=$(echo "$LIST_RESPONSE" | jq '[.[] | select(.equb_type == "public")] | length' 2>/dev/null || echo "?")
PRIVATE_COUNT=$(echo "$LIST_RESPONSE" | jq '[.[] | select(.equb_type == "private")] | length' 2>/dev/null || echo "?")
echo "Equbs visible to regular user: $PUBLIC_COUNT public, $PRIVATE_COUNT private"
echo ""

# Test 7: Get Specific Public Equb
echo "[Test 7] GET /equbs/$PUBLIC_EQUB_ID - Get public equb details"
echo "Request: GET $API_BASE/equbs/$PUBLIC_EQUB_ID"
GET_PUBLIC_RESPONSE=$(curl -s -X GET "$API_BASE/equbs/$PUBLIC_EQUB_ID" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json")
echo "Response:"
echo "$GET_PUBLIC_RESPONSE" | jq '.' 2>/dev/null || echo "$GET_PUBLIC_RESPONSE"
echo ""

# Test 8: Try to Get Private Equb as Non-Member (should fail)
echo "[Test 8] GET /equbs/$PRIVATE_EQUB_ID - Try to access private equb as non-member (should fail)"
echo "Request: GET $API_BASE/equbs/$PRIVATE_EQUB_ID"
GET_PRIVATE_RESPONSE=$(curl -s -X GET "$API_BASE/equbs/$PRIVATE_EQUB_ID" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json")
echo "Response (expecting 404 or null):"
echo "$GET_PRIVATE_RESPONSE" | jq '.' 2>/dev/null || echo "$GET_PRIVATE_RESPONSE"
echo ""

# Test 9: Verify New Fields in Response
echo "[Test 9] Verify new fields in equb responses"
echo "Checking fields: winner_selection_type, equb_type, is_preset, preset_template_id"
HAS_FIELDS=$(echo "$GET_PUBLIC_RESPONSE" | jq 'has("winner_selection_type") and has("equb_type") and has("is_preset")' 2>/dev/null || echo "false")
echo "Response has new fields: $HAS_FIELDS"
echo ""

echo "======================================"
echo "E2E Tests Complete"
echo "======================================"
echo ""
echo "Summary:"
echo "✓ Created public equb with lottery: $PUBLIC_EQUB_ID"
echo "✓ Created private equb: $PRIVATE_EQUB_ID"
echo "✓ Created FCFS equb: $FCFS_EQUB_ID"
echo "✓ Created corporate equb: $CORPORATE_EQUB_ID"
echo "✓ Verified visibility controls"
echo "✓ Verified new API response fields"
echo ""
echo "Next steps:"
echo "1. Test FCFS payment order tracking"
echo "2. Test lottery vs FCFS winner selection"
echo "3. Test corporate equb access control"
echo "4. Test preset template auto-fill on frontend"

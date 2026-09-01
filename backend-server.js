#!/usr/bin/env node
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

// Load configuration from backend-config.json
const configPath = path.join(__dirname, 'backend-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const app = express();
const { port, host } = config.server;
const { secret: JWT_SECRET, algorithm: JWT_ALGORITHM, expiresInSeconds: JWT_EXPIRES_IN } = config.jwt;
const TEST_CREDENTIALS = config.testCredentials.admin;
const TEST_DATA = config.testData;

// In-memory store for pending join requests (user -> equb mapping)
const pendingRequests = {};

// Helper function to generate valid JWT tokens
function generateToken(user) {
  const payload = {
    sub: user.id,
    email: user.email,
    phone: user.phone,
    first_name: user.firstName,
    last_name: user.lastName,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + JWT_EXPIRES_IN,
  };
  return jwt.sign(payload, JWT_SECRET, { algorithm: JWT_ALGORITHM });
}

// Middleware
app.use(cors());
app.use(express.json());

console.log('');
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║        QalNet Backend Server - STARTING                    ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');

// Health check
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Login endpoint
app.post('/api/v1/auth/login', (req, res) => {
  const { phone, pin } = req.body;
  if (phone === TEST_CREDENTIALS.phone && pin === TEST_CREDENTIALS.pin) {
    const user = {
      id: TEST_CREDENTIALS.id,
      phone: TEST_CREDENTIALS.phone,
      email: TEST_CREDENTIALS.email,
      firstName: TEST_CREDENTIALS.firstName,
      lastName: TEST_CREDENTIALS.lastName,
      role: TEST_CREDENTIALS.role,
    };
    return res.json({
      access_token: generateToken(user),
      refresh_token: generateToken(user),
      user,
    });
  }
  res.status(401).json({ error: 'Invalid credentials' });
});

// Register endpoint
app.post('/api/v1/auth/register', (req, res) => {
  const { phone, email, firstName, lastName, pin } = req.body;
  const user = {
    id: 'user-' + Date.now(),
    phone,
    email,
    firstName,
    lastName,
    role: 'participant',
    isActive: true,
  };
  res.status(201).json({
    access_token: generateToken(user),
    refresh_token: generateToken(user),
    user,
  });
});

// Check phone availability
app.get('/api/v1/auth/check-availability', (req, res) => {
  const phone = req.query.phone;
  res.json({ available: true, phone });
});

// Verify OTP
app.post('/api/v1/auth/verify-otp', (req, res) => {
  const { otp } = req.body;
  res.json({ verified: otp === TEST_DATA.otp });
});

// Send OTP
app.post('/api/v1/auth/send-otp', (req, res) => {
  const { phoneNumber, phone } = req.body;
  const phoneNum = phoneNumber || phone;
  if (!phoneNum) {
    return res.status(400).json({ error: 'Phone number is required' });
  }
  res.json({ 
    sent: true,
    message: `OTP sent to ${phoneNum}`,
    devOtp: TEST_DATA.otp 
  });
});

// Verify Fayda ID
app.post('/api/v1/auth/verify-fayda', (req, res) => {
  const { fayda_id } = req.body;
  if (!fayda_id) {
    return res.status(400).json({ error: 'Fayda ID is required' });
  }
  // Mock verification - accept configured fayda length
  const cleanId = String(fayda_id).replace(/\D/g, '');
  const isValid = new RegExp(`^\\d{${TEST_DATA.fayda.faydaIdLength}}$`).test(cleanId);
  res.json({ 
    verified: isValid,
    name: isValid ? TEST_DATA.fayda.verifiedName : undefined,
    message: isValid ? 'Fayda ID verified successfully' : 'Invalid Fayda ID format'
  });
});

// Get users
app.get('/api/v1/users', (req, res) => {
  res.json([
    {
      id: TEST_CREDENTIALS.id,
      phone: TEST_CREDENTIALS.phone,
      email: TEST_CREDENTIALS.email,
      firstName: TEST_CREDENTIALS.firstName,
      lastName: TEST_CREDENTIALS.lastName,
      role: TEST_CREDENTIALS.role,
    },
  ]);
});

// Get current user
app.get('/api/v1/users/me', (req, res) => {
  res.json({
    id: TEST_CREDENTIALS.id,
    phone: TEST_CREDENTIALS.phone,
    email: TEST_CREDENTIALS.email,
    firstName: TEST_CREDENTIALS.firstName,
    lastName: TEST_CREDENTIALS.lastName,
    role: TEST_CREDENTIALS.role,
  });
});

// Get equbs
app.get('/api/v1/equbs', (req, res) => {
  res.json(TEST_DATA.equbs.map(e => ({
    id: e.id,
    name: e.name,
    description: e.description,
    contribution_amount: e.contributionAmount,
    total_rounds: e.totalRounds,
    current_round: e.currentRound,
    status: e.status,
    members: e.members,
  })));
});

// Get user's equbs
app.get('/api/v1/equbs/mine', (req, res) => {
  res.json(TEST_DATA.equbs.map(e => ({
    id: e.id,
    name: e.name,
    description: e.description,
    contribution_amount: e.contributionAmount,
    total_rounds: e.totalRounds,
    current_round: e.currentRound,
    status: e.status,
    members: e.members,
  })));
});

// Get equb details
app.get('/api/v1/equbs/:id', (req, res) => {
  const equbId = req.params.id;
  const currentUserId = 'user-1';
  const equb = TEST_DATA.equbs.find(e => e.id === equbId) || TEST_DATA.equbs[0];
  const hasPendingRequest = pendingRequests[`${currentUserId}-${equbId}`] === true;
  
  res.json({
    id: equb.id,
    name: equb.name,
    description: equb.description,
    contribution_amount: equb.contributionAmount,
    total_rounds: equb.totalRounds,
    current_round: equb.currentRound,
    total_amount: equb.totalAmount,
    status: equb.status,
    members: equb.members,
    member_count: equb.memberCount,
    cycle_days: equb.cycleDays,
    open_slots: equb.openSlots,
    host_first_name: equb.hostFirstName,
    host_last_name: equb.hostLastName,
    membership_status: hasPendingRequest ? 'pending' : 'not_member',
    is_host: false,
  });
});

// Join equb - creates pending request
app.post('/api/v1/equbs/:id/join', (req, res) => {
  const equbId = req.params.id;
  // For demo: assume user-1 is the current user
  const currentUserId = 'user-1';
  
  // Store pending request
  pendingRequests[`${currentUserId}-${equbId}`] = true;
  
  res.status(200).json({
    pending: true,
    message: 'Join request submitted. Awaiting admin approval.',
  });
});

// Get wallet
app.get('/api/v1/wallet', (req, res) => {
  res.json({
    balance: TEST_DATA.wallet.balance,
    currency: TEST_DATA.wallet.currency,
    lastUpdated: new Date().toISOString(),
  });
});

// Get user wallet
app.get('/api/v1/wallets/me', (req, res) => {
  res.json({
    balance: TEST_DATA.wallet.balance,
    currency: TEST_DATA.wallet.currency,
    lastUpdated: new Date().toISOString(),
  });
});

// Get wallet transactions
app.get('/api/v1/wallet/transactions', (req, res) => {
  res.json(TEST_DATA.transactions.slice(0, 1).map(t => ({
    id: t.id,
    direction: t.direction,
    amount: t.amount,
    status: t.status,
    description: t.description,
    timestamp: new Date(Date.now() - t.daysAgo * 24 * 60 * 60 * 1000).toISOString(),
  })));
});

// Get user wallet transactions
app.get('/api/v1/wallets/me/transactions', (req, res) => {
  res.json(TEST_DATA.transactions.map(t => ({
    id: t.id,
    direction: t.direction,
    amount: t.amount,
    status: t.status,
    description: t.description,
    timestamp: new Date(Date.now() - t.daysAgo * 24 * 60 * 60 * 1000).toISOString(),
  })));
});

// Get notifications
app.get('/api/v1/notifications', (req, res) => {
  res.json(TEST_DATA.notifications.map(n => ({
    id: n.id,
    message: n.message,
    type: n.type,
    is_read: n.isRead,
    created_at: n.daysAgo !== undefined 
      ? new Date(Date.now() - n.daysAgo * 24 * 60 * 60 * 1000).toISOString()
      : new Date().toISOString(),
  })));
});

// ────────────────────────────────────────────────────────────────────────
// ADMIN ENDPOINTS
// ────────────────────────────────────────────────────────────────────────

// Get pending membership requests
app.get('/api/v1/admin/memberships/pending', (req, res) => {
  res.json(TEST_DATA.pendingMemberships.map(m => ({
    id: m.id,
    equb_id: m.equbId,
    equb_name: m.equbName,
    user_id: m.userId,
    first_name: m.firstName,
    last_name: m.lastName,
    phone: m.phone,
    email: m.email,
    status: m.status,
    requested_at: new Date(Date.now() - m.daysAgo * 24 * 60 * 60 * 1000).toISOString(),
  })));
});

// Approve membership request
app.post('/api/v1/admin/memberships/:id/approve', (req, res) => {
  const membershipId = req.params.id;
  
  // For demo: clear pending requests
  // In real app, this would update the database
  Object.keys(pendingRequests).forEach(key => {
    if (key.startsWith('user-')) {
      delete pendingRequests[key];
    }
  });
  
  res.json({
    id: membershipId,
    status: 'approved',
    message: 'Membership approved successfully',
  });
});

// Reject membership request
app.post('/api/v1/admin/memberships/:id/reject', (req, res) => {
  res.json({
    id: req.params.id,
    status: 'rejected',
    message: 'Membership request rejected',
  });
});

// Get pending equb creation requests
app.get('/api/v1/admin/equb-requests', (req, res) => {
  res.json(TEST_DATA.pendingEqubRequests.map(r => ({
    id: r.id,
    requester_id: r.requesterId,
    requester_first_name: r.requesterFirstName,
    requester_last_name: r.requesterLastName,
    phone: r.phone,
    email: r.email,
    equb_name: r.equbName,
    description: r.description,
    contribution_amount: r.contributionAmount,
    total_rounds: r.totalRounds,
    cycle_days: r.cycleDays,
    status: r.status,
    requested_at: new Date(Date.now() - r.daysAgo * 24 * 60 * 60 * 1000).toISOString(),
  })));
});

// Approve equb creation request
app.post('/api/v1/admin/equb-requests/:id/approve', (req, res) => {
  res.json({
    id: req.params.id,
    status: 'approved',
    message: 'Equb creation request approved',
    equb: {
      id: 'equb-new-1',
      name: 'Tech Founders Fund',
      status: 'active',
    },
  });
});

// Reject equb creation request
app.post('/api/v1/admin/equb-requests/:id/reject', (req, res) => {
  res.json({
    id: req.params.id,
    status: 'rejected',
    message: 'Equb creation request rejected',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(port, host, () => {
  console.log(`✅ Backend Server running on: http://localhost:${port}`);
  console.log('');
  console.log('📚 API Endpoints:');
  console.log('   GET    /api/v1/health');
  console.log('   POST   /api/v1/auth/login');
  console.log('   POST   /api/v1/auth/register');
  console.log('   GET    /api/v1/auth/check-availability');
  console.log('   POST   /api/v1/auth/verify-otp');
  console.log('   POST   /api/v1/auth/send-otp');
  console.log('   POST   /api/v1/auth/verify-fayda');
  console.log('   GET    /api/v1/users');
  console.log('   GET    /api/v1/users/me');
  console.log('   GET    /api/v1/equbs');
  console.log('   GET    /api/v1/equbs/:id');
  console.log('   GET    /api/v1/wallet');
  console.log('   GET    /api/v1/notifications');
  console.log('');
  console.log('🔐 Test Credentials (from backend-config.json):');
  console.log(`   Phone: ${TEST_CREDENTIALS.phone}`);
  console.log(`   PIN:   ${TEST_CREDENTIALS.pin}`);
  console.log(`   OTP:   ${TEST_DATA.otp}`);
  console.log('');
  console.log('⚙️ Configuration:');
  console.log(`   JWT Expires In: ${JWT_EXPIRES_IN}s (${Math.floor(JWT_EXPIRES_IN / 3600)}h)`);
  console.log(`   Equbs Count: ${TEST_DATA.equbs.length}`);
  console.log(`   Wallet Balance: ${TEST_DATA.wallet.balance} ${TEST_DATA.wallet.currency}`);
  console.log('');
  console.log('📝 Config File: backend-config.json');
  console.log('');
  console.log('Press Ctrl+C to stop');
  console.log('');
});

process.on('SIGINT', () => {
  console.log('\n✓ Server stopped');
  process.exit(0);
});

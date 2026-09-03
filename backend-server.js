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

// In-memory user registry (phone -> user mapping)
const userRegistry = {
  [TEST_CREDENTIALS.phone]: {
    id: TEST_CREDENTIALS.id,
    phone: TEST_CREDENTIALS.phone,
    email: TEST_CREDENTIALS.email,
    firstName: TEST_CREDENTIALS.firstName,
    lastName: TEST_CREDENTIALS.lastName,
    role: TEST_CREDENTIALS.role,
    pin: TEST_CREDENTIALS.pin,
  },
};

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

// Error handling wrapper for all routes
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

console.log('');
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║        QalNet Backend Server - STARTING                    ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');

// Health check
app.get('/api/v1/health', (req, res) => {
  try {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ error: 'Health check failed' });
  }
});

// Login endpoint - checks if user exists, returns 404 if not found
app.post('/api/v1/auth/login', (req, res) => {
  const { phone, pin } = req.body;
  
  // Check if user exists in registry
  const user = userRegistry[phone];
  if (!user) {
    // User not found - they should sign up
    return res.status(404).json({ 
      error: 'User not found',
      message: 'This phone number is not registered. Please sign up first.',
      code: 'USER_NOT_FOUND'
    });
  }
  
  // User exists - check PIN
  if (pin !== user.pin) {
    return res.status(401).json({ 
      error: 'Invalid PIN',
      message: 'The PIN you entered is incorrect.',
      code: 'INVALID_PIN'
    });
  }
  
  // Authentication successful
  const userData = {
    id: user.id,
    phone: user.phone,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
  };
  
  return res.json({
    access_token: generateToken(userData),
    refresh_token: generateToken(userData),
    user: userData,
  });
});

// Register endpoint - creates new user if phone not already registered
app.post('/api/v1/auth/register', (req, res) => {
  const { phone, email, firstName, lastName, pin } = req.body;
  
  // Check if user already exists
  if (userRegistry[phone]) {
    return res.status(409).json({ 
      error: 'User already exists',
      message: 'This phone number is already registered. Please sign in instead.',
      code: 'USER_EXISTS'
    });
  }
  
  // Create new user
  const newUser = {
    id: 'user-' + Date.now(),
    phone,
    email,
    firstName,
    lastName,
    role: 'participant',
    pin,
  };
  
  // Add to registry
  userRegistry[phone] = newUser;
  
  // Return user data without PIN
  const userData = {
    id: newUser.id,
    phone: newUser.phone,
    email: newUser.email,
    firstName: newUser.firstName,
    lastName: newUser.lastName,
    role: newUser.role,
  };
  
  res.status(201).json({
    access_token: generateToken(userData),
    refresh_token: generateToken(userData),
    user: userData,
  });
});

// Check phone availability - returns whether phone is registered
app.get('/api/v1/auth/check-availability', (req, res) => {
  const phone = req.query.phone;
  const exists = !!userRegistry[phone];
  res.json({ 
    phone,
    exists,
    available: !exists, // available = not registered
  });
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
  try {
    const { fayda_id, faydaId } = req.body;
    const id = fayda_id || faydaId;
    
    if (!id) {
      return res.status(400).json({ 
        error: 'Fayda ID is required',
        received: req.body 
      });
    }
    
    // Mock verification - accept configured fayda length
    const cleanId = String(id).replace(/\D/g, '');
    const faydaLength = TEST_DATA.fayda?.faydaIdLength || 16;
    const isValid = new RegExp(`^\\d{${faydaLength}}$`).test(cleanId);
    
    res.json({ 
      verified: isValid,
      name: isValid ? (TEST_DATA.fayda?.verifiedName || 'Verified User') : undefined,
      message: isValid ? 'Fayda ID verified successfully' : `Invalid Fayda ID format. Expected ${faydaLength} digits, got ${cleanId.length}`,
      debug: {
        received: id,
        cleaned: cleanId,
        expected_length: faydaLength
      }
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
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

// Join equb tier - creates pending request
app.post('/api/v1/equbs/join', (req, res) => {
  const { tier_type, user_id, user_name, phone, email } = req.body;

  // Validate tier type
  if (!['DAILY', 'WEEKLY', 'MONTHLY'].includes(tier_type)) {
    return res.status(400).json({ error: 'Invalid tier type' });
  }

  // Mock: Create equb based on tier
  const tierConfig = {
    DAILY: {
      name: 'Daily Equb Pool',
      contribution: 300,
      capacity: 103,
      members: 1,
    },
    WEEKLY: {
      name: 'Weekly Equb Pool',
      contribution: 2000,
      capacity: 12,
      members: 1,
    },
    MONTHLY: {
      name: 'Monthly Equb Pool',
      contribution: 10000,
      capacity: 6,
      members: 1,
    },
  };

  const config = tierConfig[tier_type];
  
  // For demo: assume user-1 is the current user
  const currentUserId = user_id || 'user-1';
  
  // Store join request
  pendingRequests[`${currentUserId}-equb-${tier_type}`] = true;
  
  res.status(201).json({
    success: true,
    message: `Successfully joined ${tier_type} Equb`,
    enrollment: {
      user_id: currentUserId,
      user_name,
      phone,
      email,
      tier_type,
      equb_name: config.name,
      contribution: config.contribution,
      status: 'PENDING_PAYMENT',
      joined_at: new Date().toISOString(),
    },
  });
});

// Get wallet
// Helper: Generate unique wallet balance per user
function generateUserBalance(userId) {
  // Hash user ID to generate consistent balance between 10,000 - 100,000 ETB
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash |= 0;
  }
  const minBalance = 10000;
  const maxBalance = 100000;
  return minBalance + ((Math.abs(hash) % (maxBalance - minBalance)) * 100) / 100;
}

// Helper: Generate unique transaction list per user
function generateUserTransactions(userId) {
  const userHash = Math.abs(userId.split('').reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0));
  const amounts = [300, 2000, 10000];
  const statuses = ['paid', 'auto_debited', 'pending'];
  
  return TEST_DATA.transactions.slice(0, 5).map((t, idx) => ({
    id: `${userId}-txn-${idx}`,
    direction: t.direction,
    amount: amounts[(userHash + idx) % amounts.length],
    status: statuses[(userHash + idx) % statuses.length],
    description: t.description,
    timestamp: new Date(Date.now() - t.daysAgo * 24 * 60 * 60 * 1000).toISOString(),
  }));
}

app.get('/api/v1/wallet', (req, res) => {
  // Extract user ID from token if available
  const authHeader = req.headers.authorization;
  let userId = 'guest';
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      const decoded = jwt.decode(token);
      userId = decoded?.sub || 'guest';
    } catch (e) {
      // Fall back to guest
    }
  }

  res.json({
    id: `wallet-${userId}`,
    balance: generateUserBalance(userId),
    currency: TEST_DATA.wallet.currency,
    lastUpdated: new Date().toISOString(),
  });
});

// Get user wallet
app.get('/api/v1/wallets/me', (req, res) => {
  // Extract user ID from token if available
  const authHeader = req.headers.authorization;
  let userId = 'guest';
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      const decoded = jwt.decode(token);
      userId = decoded?.sub || 'guest';
    } catch (e) {
      // Fall back to guest
    }
  }

  res.json({
    id: `wallet-${userId}`,
    balance: generateUserBalance(userId),
    currency: TEST_DATA.wallet.currency,
    lastUpdated: new Date().toISOString(),
  });
});

// Get wallet transactions
app.get('/api/v1/wallet/transactions', (req, res) => {
  // Extract user ID from token if available
  const authHeader = req.headers.authorization;
  let userId = 'guest';
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      const decoded = jwt.decode(token);
      userId = decoded?.sub || 'guest';
    } catch (e) {
      // Fall back to guest
    }
  }

  res.json(generateUserTransactions(userId).slice(0, 1));
});

// Get user wallet transactions
app.get('/api/v1/wallets/me/transactions', (req, res) => {
  // Extract user ID from token if available
  const authHeader = req.headers.authorization;
  let userId = 'guest';
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      const decoded = jwt.decode(token);
      userId = decoded?.sub || 'guest';
    } catch (e) {
      // Fall back to guest
    }
  }

  res.json(generateUserTransactions(userId));
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
  console.warn(`[404] ${req.method} ${req.path}`);
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

// Error handler - catches all unhandled errors
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err);
  
  // Don't leak error details in production
  const isDev = process.env.NODE_ENV !== 'production';
  
  res.status(err.status || 500).json({ 
    error: 'Internal server error',
    message: isDev ? err.message : 'An error occurred processing your request',
    ...(isDev && { stack: err.stack })
  });
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

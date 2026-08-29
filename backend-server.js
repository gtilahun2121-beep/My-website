#!/usr/bin/env node
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 4000;

// Secret key for signing JWT tokens (same across all sessions for mock server)
const JWT_SECRET = 'qalnet-mock-secret-key-dev-only-change-in-production';

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
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
  };
  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });
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
  if (phone === '+251904556677' && pin === '4488') {
    const user = {
      id: 'admin-1',
      phone: '+251904556677',
      email: 'admin@qalnet.com',
      firstName: 'Danel',
      lastName: 'Temesgen',
      role: 'admin',
    };
    return res.json({
      access_token: generateToken(user),
      refresh_token: generateToken(user), // In mock, same as access
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
  res.json({ verified: otp === '818959' });
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
    devOtp: '818959' 
  });
});

// Verify Fayda ID
app.post('/api/v1/auth/verify-fayda', (req, res) => {
  const { fayda_id } = req.body;
  if (!fayda_id) {
    return res.status(400).json({ error: 'Fayda ID is required' });
  }
  // Mock verification - accept 16-digit numbers
  const cleanId = String(fayda_id).replace(/\D/g, '');
  const isValid = /^\d{16}$/.test(cleanId);
  res.json({ 
    verified: isValid,
    name: isValid ? 'Danel Temesgen' : undefined,
    message: isValid ? 'Fayda ID verified successfully' : 'Invalid Fayda ID format'
  });
});

// Get users
app.get('/api/v1/users', (req, res) => {
  res.json([
    {
      id: 'admin-1',
      phone: '+251904556677',
      email: 'admin@qalnet.com',
      firstName: 'Danel',
      lastName: 'Temesgen',
      role: 'admin',
    },
  ]);
});

// Get current user
app.get('/api/v1/users/me', (req, res) => {
  res.json({
    id: 'admin-1',
    phone: '+251904556677',
    email: 'admin@qalnet.com',
    firstName: 'Danel',
    lastName: 'Temesgen',
    role: 'admin',
  });
});

// Get equbs
app.get('/api/v1/equbs', (req, res) => {
  res.json([
    {
      id: 'equb-1',
      name: 'Community Savings Group',
      description: 'Monthly savings rotation',
      contribution_amount: 1000,
      total_rounds: 12,
      current_round: 1,
      status: 'active',
      members: 5,
    },
    {
      id: 'equb-2',
      name: 'Business Fund',
      description: 'Investment group',
      contribution_amount: 5000,
      total_rounds: 6,
      current_round: 2,
      status: 'active',
      members: 8,
    },
  ]);
});

// Get user's equbs
app.get('/api/v1/equbs/mine', (req, res) => {
  res.json([
    {
      id: 'equb-1',
      name: 'Community Savings Group',
      description: 'Monthly savings rotation',
      contribution_amount: 1000,
      total_rounds: 12,
      current_round: 1,
      status: 'active',
      members: 5,
    },
    {
      id: 'equb-2',
      name: 'Business Fund',
      description: 'Investment group',
      contribution_amount: 5000,
      total_rounds: 6,
      current_round: 2,
      status: 'active',
      members: 8,
    },
  ]);
});

// Get equb details
app.get('/api/v1/equbs/:id', (req, res) => {
  const equbId = req.params.id;
  // For demo: assume user-1 is the current user
  const currentUserId = 'user-1';
  
  // Check if this user has a pending request for this equb
  const hasPendingRequest = pendingRequests[`${currentUserId}-${equbId}`] === true;
  
  res.json({
    id: equbId,
    name: 'Community Savings Group',
    description: 'Monthly savings rotation for community members',
    contribution_amount: 1000,
    total_rounds: 12,
    current_round: 1,
    total_amount: 12000,
    status: 'active',
    members: 5,
    member_count: 5,
    cycle_days: 30,
    open_slots: 7,
    host_first_name: 'Danel',
    host_last_name: 'Temesgen',
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
    balance: 50000,
    currency: 'ETB',
    lastUpdated: new Date().toISOString(),
  });
});

// Get user wallet
app.get('/api/v1/wallets/me', (req, res) => {
  res.json({
    balance: 50000,
    currency: 'ETB',
    lastUpdated: new Date().toISOString(),
  });
});

// Get wallet transactions
app.get('/api/v1/wallet/transactions', (req, res) => {
  res.json([
    {
      id: 'txn-1',
      direction: 'payment',
      amount: 1000,
      status: 'paid',
      description: 'Community Savings Group - Round 1',
      timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ]);
});

// Get user wallet transactions
app.get('/api/v1/wallets/me/transactions', (req, res) => {
  res.json([
    {
      id: 'txn-1',
      direction: 'payment',
      amount: 1000,
      status: 'paid',
      description: 'Community Savings Group - Round 1',
      timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'txn-2',
      direction: 'payout',
      amount: 5000,
      status: 'received',
      description: 'Business Fund Payout',
      timestamp: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ]);
});

// Get notifications
app.get('/api/v1/notifications', (req, res) => {
  res.json([
    {
      id: 'notif-1',
      message: 'Your contribution was received',
      type: 'success',
      is_read: false,
      created_at: new Date().toISOString(),
    },
    {
      id: 'notif-2',
      message: 'Your payout is ready to claim',
      type: 'info',
      is_read: false,
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
  ]);
});

// ────────────────────────────────────────────────────────────────────────
// ADMIN ENDPOINTS
// ────────────────────────────────────────────────────────────────────────

// Get pending membership requests
app.get('/api/v1/admin/memberships/pending', (req, res) => {
  res.json([
    {
      id: 'membership-req-1',
      equb_id: 'equb-1',
      equb_name: 'Community Savings Group',
      user_id: 'user-123',
      first_name: 'John',
      last_name: 'Doe',
      phone: '+251912345678',
      email: 'john@example.com',
      status: 'pending',
      requested_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'membership-req-2',
      equb_id: 'equb-2',
      equb_name: 'Business Fund',
      user_id: 'user-456',
      first_name: 'Jane',
      last_name: 'Smith',
      phone: '+251913456789',
      email: 'jane@example.com',
      status: 'pending',
      requested_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    },
  ]);
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
  res.json([
    {
      id: 'equb-req-1',
      requester_id: 'user-789',
      requester_first_name: 'Ahmed',
      requester_last_name: 'Hassan',
      phone: '+251914567890',
      email: 'ahmed@example.com',
      equb_name: 'Tech Founders Fund',
      description: 'Investment pool for tech startups',
      contribution_amount: 10000,
      total_rounds: 10,
      cycle_days: 30,
      status: 'pending',
      requested_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    },
  ]);
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
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Backend Server running on: http://localhost:${PORT}`);
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
  console.log('🔐 Test Credentials:');
  console.log('   Phone: +251904556677');
  console.log('   PIN:   4488');
  console.log('   OTP:   818959');
  console.log('');
  console.log('Press Ctrl+C to stop');
  console.log('');
});

process.on('SIGINT', () => {
  console.log('\n✓ Server stopped');
  process.exit(0);
});

#!/usr/bin/env node

/**
 * QalNet Mock Backend Server
 * ===========================
 * This mock API server allows the frontend to work without requiring:
 * - PostgreSQL database
 * - Redis cache
 * - Full NestJS setup
 * 
 * It simulates all necessary endpoints for the frontend to function.
 * Usage: node mock-backend.js
 */

const http = require('http');
const url = require('url');

const PORT = 4000;

// Mock data storage
const mockUsers = {
  '+251904556677': {
    id: 'user-1',
    phone: '+251904556677',
    email: 'danel@qalnet.com',
    firstName: 'Danel',
    lastName: 'Temesgen',
    role: 'admin',
    isActive: true,
    createdAt: new Date().toISOString(),
  },
};

const mockEqubs = {
  'equb-1': {
    id: 'equb-1',
    name: 'Community Savings Group',
    description: 'Monthly savings rotation group',
    hostId: 'user-1',
    contributionAmount: 1000,
    totalRounds: 12,
    currentRound: 1,
    status: 'active',
    members: 5,
    maxMembers: 10,
  },
  'equb-2': {
    id: 'equb-2',
    name: 'Business Fund',
    description: 'For business investment',
    hostId: 'user-1',
    contributionAmount: 5000,
    totalRounds: 6,
    currentRound: 2,
    status: 'active',
    members: 6,
    maxMembers: 12,
  },
};

const mockTokens = {
  'mock-admin-token': {
    userId: 'user-1',
    email: 'danel@qalnet.com',
    role: 'admin',
    exp: Math.floor(Date.now() / 1000) + 86400,
  },
};

// JSON response helper
function jsonResponse(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// Request handler
function requestHandler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  console.log(`${req.method} ${pathname}`);

  // ========================================================================
  // Health Check
  // ========================================================================
  if (pathname === '/api/v1/health') {
    return jsonResponse(res, 200, { status: 'ok', timestamp: new Date().toISOString() });
  }

  // ========================================================================
  // Authentication Endpoints
  // ========================================================================
  
  // Login
  if (pathname === '/api/v1/auth/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { phone, pin } = JSON.parse(body);
        if (phone === '+251904556677' && pin === '4488') {
          return jsonResponse(res, 200, {
            accessToken: 'mock-admin-token',
            refreshToken: 'mock-refresh-token',
            user: mockUsers['+251904556677'],
          });
        }
        return jsonResponse(res, 401, { error: 'Invalid credentials' });
      } catch (e) {
        return jsonResponse(res, 400, { error: 'Bad request' });
      }
    });
    return;
  }

  // Register
  if (pathname === '/api/v1/auth/register' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { phone, email, firstName, lastName } = JSON.parse(body);
        const newUser = {
          id: `user-${Date.now()}`,
          phone,
          email,
          firstName,
          lastName,
          role: 'participant',
          isActive: true,
          createdAt: new Date().toISOString(),
        };
        mockUsers[phone] = newUser;
        return jsonResponse(res, 201, newUser);
      } catch (e) {
        return jsonResponse(res, 400, { error: 'Bad request' });
      }
    });
    return;
  }

  // Check phone availability
  if (pathname === '/api/v1/auth/check-availability') {
    const phone = query.phone || query.phone;
    const available = !mockUsers[phone];
    return jsonResponse(res, 200, { available, phone });
  }

  // Verify OTP
  if (pathname === '/api/v1/auth/verify-otp' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { otp } = JSON.parse(body);
        const verified = otp === '818959';
        return jsonResponse(res, 200, { verified });
      } catch (e) {
        return jsonResponse(res, 400, { error: 'Bad request' });
      }
    });
    return;
  }

  // ========================================================================
  // User Endpoints
  // ========================================================================

  // Get all users
  if (pathname === '/api/v1/users' && req.method === 'GET') {
    return jsonResponse(res, 200, Object.values(mockUsers));
  }

  // Get current user
  if (pathname === '/api/v1/users/me' && req.method === 'GET') {
    return jsonResponse(res, 200, mockUsers['+251904556677']);
  }

  // ========================================================================
  // Equb Endpoints
  // ========================================================================

  // Get all equbs
  if (pathname === '/api/v1/equbs' && req.method === 'GET') {
    return jsonResponse(res, 200, Object.values(mockEqubs));
  }

  // Get specific equb
  if (pathname.match(/^\/api\/v1\/equbs\/[^/]+$/) && req.method === 'GET') {
    const equbId = pathname.split('/').pop();
    if (mockEqubs[equbId]) {
      return jsonResponse(res, 200, mockEqubs[equbId]);
    }
    return jsonResponse(res, 404, { error: 'Equb not found' });
  }

  // Create equb
  if (pathname === '/api/v1/equbs' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const newEqub = {
          id: `equb-${Date.now()}`,
          ...data,
          status: 'open',
          members: 1,
          currentRound: 1,
          createdAt: new Date().toISOString(),
        };
        mockEqubs[newEqub.id] = newEqub;
        return jsonResponse(res, 201, newEqub);
      } catch (e) {
        return jsonResponse(res, 400, { error: 'Bad request' });
      }
    });
    return;
  }

  // ========================================================================
  // Wallet Endpoints
  // ========================================================================

  // Get wallet
  if (pathname === '/api/v1/wallet' && req.method === 'GET') {
    return jsonResponse(res, 200, {
      balance: 50000,
      currency: 'ETB',
      lastUpdated: new Date().toISOString(),
    });
  }

  // Get wallet transactions
  if (pathname === '/api/v1/wallet/transactions' && req.method === 'GET') {
    return jsonResponse(res, 200, [
      {
        id: 'txn-1',
        type: 'credit',
        amount: 5000,
        description: 'Equb payout',
        date: new Date().toISOString(),
      },
      {
        id: 'txn-2',
        type: 'debit',
        amount: 1000,
        description: 'Equb contribution',
        date: new Date(Date.now() - 86400000).toISOString(),
      },
    ]);
  }

  // ========================================================================
  // Notification Endpoints
  // ========================================================================

  // Get notifications
  if (pathname === '/api/v1/notifications' && req.method === 'GET') {
    return jsonResponse(res, 200, [
      {
        id: 'notif-1',
        message: 'Your contribution was received',
        type: 'success',
        isRead: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'notif-2',
        message: 'Round 2 starts tomorrow',
        type: 'info',
        isRead: false,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
    ]);
  }

  // ========================================================================
  // Admin Endpoints
  // ========================================================================

  // Get statistics
  if (pathname === '/api/v1/admin/statistics' && req.method === 'GET') {
    return jsonResponse(res, 200, {
      totalUsers: Object.keys(mockUsers).length,
      totalEqubs: Object.keys(mockEqubs).length,
      totalTransactions: 1240,
      totalRevenue: 2500000,
    });
  }

  // ========================================================================
  // 404 - Not Found
  // ========================================================================

  return jsonResponse(res, 404, { error: 'Endpoint not found' });
}

// Create server
const server = http.createServer(requestHandler);

server.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        QalNet Mock Backend Server - RUNNING                ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`✅ Server running at: http://localhost:${PORT}`);
  console.log(`📚 API Docs: http://localhost:4000/api/docs`);
  console.log('');
  console.log('📋 Available Endpoints:');
  console.log('   POST   /api/v1/auth/login');
  console.log('   POST   /api/v1/auth/register');
  console.log('   GET    /api/v1/auth/check-availability');
  console.log('   POST   /api/v1/auth/verify-otp');
  console.log('   GET    /api/v1/users');
  console.log('   GET    /api/v1/users/me');
  console.log('   GET    /api/v1/equbs');
  console.log('   POST   /api/v1/equbs');
  console.log('   GET    /api/v1/equbs/:id');
  console.log('   GET    /api/v1/wallet');
  console.log('   GET    /api/v1/wallet/transactions');
  console.log('   GET    /api/v1/notifications');
  console.log('   GET    /api/v1/admin/statistics');
  console.log('');
  console.log('🔐 Test Credentials:');
  console.log('   Phone: +251904556677');
  console.log('   PIN:   4488');
  console.log('   OTP:   818959');
  console.log('');
  console.log('Press Ctrl+C to stop');
  console.log('');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
    console.error('Run: npm run dev:restart');
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n✓ Server stopped');
  process.exit(0);
});

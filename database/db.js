/**
 * QalNet Database Module
 * Handles PostgreSQL connections and queries
 */

const { Pool } = require('pg');
require('dotenv').config();

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost/qalnet',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Connection error handling
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// Test connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
  } else {
    console.log('✅ Database connected at', res.rows[0].now);
  }
});

/**
 * Execute a query
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Log slow queries (> 1s)
    if (duration > 1000) {
      console.log('🐢 Slow query detected:', { text: text.substring(0, 50), duration });
    }
    
    return res;
  } catch (error) {
    console.error('❌ Query error:', { text, error: error.message });
    throw error;
  }
}

/**
 * Get a single row
 */
async function getOne(text, params) {
  const res = await query(text, params);
  return res.rows[0] || null;
}

/**
 * Get all rows
 */
async function getAll(text, params) {
  const res = await query(text, params);
  return res.rows;
}

/**
 * Insert and return the inserted row
 */
async function insertReturning(text, params) {
  const res = await query(text + ' RETURNING *', params);
  return res.rows[0];
}

/**
 * Begin transaction
 */
async function beginTransaction() {
  const client = await pool.connect();
  await client.query('BEGIN');
  return client;
}

/**
 * Commit transaction
 */
async function commit(client) {
  try {
    await client.query('COMMIT');
  } finally {
    client.release();
  }
}

/**
 * Rollback transaction
 */
async function rollback(client) {
  try {
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
}

/**
 * Close the pool
 */
async function closePool() {
  await pool.end();
}

// ===== USER QUERIES =====

async function getUserByPhone(phone) {
  return getOne(
    'SELECT * FROM users WHERE phone = $1',
    [phone]
  );
}

async function getUserByEmail(email) {
  return getOne(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );
}

async function createUser(userData) {
  return insertReturning(
    `INSERT INTO users (phone, email, first_name, last_name, pin_hash, fayda_id, telegram_handle)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [userData.phone, userData.email, userData.firstName, userData.lastName, userData.pinHash, userData.faydaId, userData.telegramHandle]
  );
}

async function updateUserLastLogin(userId) {
  return query(
    'UPDATE users SET last_login = NOW() WHERE id = $1',
    [userId]
  );
}

// ===== WALLET QUERIES =====

async function getWalletByUserId(userId) {
  return getOne(
    'SELECT * FROM wallets WHERE user_id = $1',
    [userId]
  );
}

async function createWallet(userId) {
  return insertReturning(
    'INSERT INTO wallets (user_id, balance) VALUES ($1, 0)',
    [userId]
  );
}

async function updateWalletBalance(userId, amount, operation = 'add') {
  const operator = operation === 'add' ? '+' : '-';
  return query(
    `UPDATE wallets SET balance = balance ${operator} $1, updated_at = NOW() WHERE user_id = $2`,
    [amount, userId]
  );
}

// ===== TRANSACTION QUERIES =====

async function createTransaction(transactionData) {
  return insertReturning(
    `INSERT INTO transactions (user_id, wallet_id, transaction_type, direction, amount, status, payment_method, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [transactionData.userId, transactionData.walletId, transactionData.type, transactionData.direction, 
     transactionData.amount, transactionData.status || 'pending', transactionData.paymentMethod, transactionData.description]
  );
}

async function getTransactionsByUser(userId, limit = 50) {
  return getAll(
    'SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
    [userId, limit]
  );
}

async function updateTransactionStatus(transactionId, status) {
  return query(
    'UPDATE transactions SET status = $1, updated_at = NOW() WHERE id = $2',
    [status, transactionId]
  );
}

// ===== EQUB QUERIES =====

async function getAllEqubs(status = null) {
  if (status) {
    return getAll(
      'SELECT * FROM equbs WHERE status = $1 ORDER BY created_at DESC',
      [status]
    );
  }
  return getAll('SELECT * FROM equbs ORDER BY created_at DESC');
}

async function getEqubById(equbId) {
  return getOne(
    'SELECT * FROM equbs WHERE id = $1',
    [equbId]
  );
}

async function createEqub(equbData) {
  return insertReturning(
    `INSERT INTO equbs (name, description, host_id, contribution_amount, total_rounds, cycle_days, lottery_type, total_members, open_slots)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [equbData.name, equbData.description, equbData.hostId, equbData.contributionAmount, 
     equbData.totalRounds, equbData.cycleDays, equbData.lotteryType, equbData.totalMembers, equbData.totalMembers]
  );
}

// ===== MEMBERSHIP QUERIES =====

async function getMemberships(userId, status = 'active') {
  return getAll(
    `SELECT m.*, e.name, e.contribution_amount, e.current_round, e.total_rounds
     FROM memberships m
     JOIN equbs e ON m.equb_id = e.id
     WHERE m.user_id = $1 AND m.status = $2
     ORDER BY m.joined_at DESC`,
    [userId, status]
  );
}

async function addMembership(userId, equbId) {
  return insertReturning(
    'INSERT INTO memberships (user_id, equb_id, status) VALUES ($1, $2, $1)',
    [userId, equbId, 'active']
  );
}

async function getMembersCount(equbId, status = 'active') {
  const res = await getOne(
    'SELECT COUNT(*) as count FROM memberships WHERE equb_id = $1 AND status = $2',
    [equbId, status]
  );
  return parseInt(res.count, 10);
}

// ===== NOTIFICATION QUERIES =====

async function createNotification(notificationData) {
  return insertReturning(
    `INSERT INTO notifications (user_id, title, message, type, action_url, related_equb_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [notificationData.userId, notificationData.title, notificationData.message, 
     notificationData.type, notificationData.actionUrl, notificationData.equbId]
  );
}

async function getUserNotifications(userId, limit = 20) {
  return getAll(
    'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
    [userId, limit]
  );
}

async function markNotificationAsRead(notificationId) {
  return query(
    'UPDATE notifications SET is_read = true WHERE id = $1',
    [notificationId]
  );
}

// ===== AUDIT LOG QUERIES =====

async function logAudit(logData) {
  return insertReturning(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [logData.userId, logData.action, logData.entityType, logData.entityId, 
     JSON.stringify(logData.oldValues), JSON.stringify(logData.newValues), logData.ipAddress, logData.userAgent]
  );
}

// ===== ANALYTICS QUERIES =====

async function getSystemStats() {
  const users = await getOne('SELECT COUNT(*) as count FROM users WHERE status = $1', ['active']);
  const equbs = await getOne('SELECT COUNT(*) as count FROM equbs WHERE status IN ($1, $2)', ['open', 'active']);
  const totalValue = await getOne(
    `SELECT SUM(m.equb_id * e.contribution_amount) as total
     FROM memberships m
     JOIN equbs e ON m.equb_id = e.id
     WHERE m.status = $1`,
    ['active']
  );
  const totalTransacted = await getOne(
    'SELECT SUM(amount) as total FROM transactions WHERE status = $1',
    ['completed']
  );

  return {
    activeUsers: parseInt(users.count, 10),
    activeEqubs: parseInt(equbs.count, 10),
    totalValueLocked: totalValue.total || 0,
    totalTransacted: totalTransacted.total || 0
  };
}

module.exports = {
  query,
  getOne,
  getAll,
  insertReturning,
  beginTransaction,
  commit,
  rollback,
  closePool,
  
  // User queries
  getUserByPhone,
  getUserByEmail,
  createUser,
  updateUserLastLogin,
  
  // Wallet queries
  getWalletByUserId,
  createWallet,
  updateWalletBalance,
  
  // Transaction queries
  createTransaction,
  getTransactionsByUser,
  updateTransactionStatus,
  
  // Equb queries
  getAllEqubs,
  getEqubById,
  createEqub,
  
  // Membership queries
  getMemberships,
  addMembership,
  getMembersCount,
  
  // Notification queries
  createNotification,
  getUserNotifications,
  markNotificationAsRead,
  
  // Audit queries
  logAudit,
  
  // Analytics
  getSystemStats
};

-- QalNet Production Database Schema
-- PostgreSQL

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  pin_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
  fayda_id VARCHAR(20),
  telegram_handle VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP
);

CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);

-- Equbs Table
CREATE TABLE IF NOT EXISTS equbs (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  host_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contribution_amount DECIMAL(12, 2) NOT NULL,
  total_rounds INT NOT NULL,
  current_round INT DEFAULT 1,
  cycle_days INT NOT NULL,
  lottery_type VARCHAR(20) DEFAULT 'random' CHECK (lottery_type IN ('random', 'rotation', 'bidding')),
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'active', 'completed', 'cancelled')),
  total_members INT DEFAULT 0,
  open_slots INT,
  start_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_equbs_host ON equbs(host_id);
CREATE INDEX idx_equbs_status ON equbs(status);

-- Memberships Table
CREATE TABLE IF NOT EXISTS memberships (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  equb_id INT NOT NULL REFERENCES equbs(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'removed')),
  round_won INT,
  guarantor_name VARCHAR(100),
  guarantor_phone VARCHAR(20),
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, equb_id)
);

CREATE INDEX idx_memberships_user ON memberships(user_id);
CREATE INDEX idx_memberships_equb ON memberships(equb_id);

-- Wallets Table
CREATE TABLE IF NOT EXISTS wallets (
  id SERIAL PRIMARY KEY,
  user_id INT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  balance DECIMAL(15, 2) DEFAULT 0 CHECK (balance >= 0),
  currency VARCHAR(5) DEFAULT 'ETB',
  total_deposits DECIMAL(15, 2) DEFAULT 0,
  total_withdrawals DECIMAL(15, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wallets_user ON wallets(user_id);

-- Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_id INT REFERENCES wallets(id) ON DELETE SET NULL,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal', 'payment', 'payout', 'fee')),
  direction VARCHAR(20) NOT NULL CHECK (direction IN ('in', 'out')),
  amount DECIMAL(12, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'reversed')),
  payment_method VARCHAR(50),
  payment_provider VARCHAR(50),
  transaction_reference VARCHAR(100),
  equb_id INT REFERENCES equbs(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_type ON transactions(transaction_type);
CREATE INDEX idx_transactions_created ON transactions(created_at DESC);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(100),
  message TEXT NOT NULL,
  type VARCHAR(20) DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  is_read BOOLEAN DEFAULT FALSE,
  action_url VARCHAR(255),
  related_equb_id INT REFERENCES equbs(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, is_read);

-- Payments Table (for tracking payment status)
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  transaction_id INT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  provider_reference VARCHAR(100),
  amount DECIMAL(12, 2) NOT NULL,
  fee DECIMAL(12, 2),
  net_amount DECIMAL(12, 2),
  status VARCHAR(20) DEFAULT 'initiated',
  error_message TEXT,
  webhook_received BOOLEAN DEFAULT FALSE,
  webhook_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_payments_transaction ON payments(transaction_id);
CREATE INDEX idx_payments_provider_ref ON payments(provider, provider_reference);

-- Bids Table (for bidding-based lottery)
CREATE TABLE IF NOT EXISTS bids (
  id SERIAL PRIMARY KEY,
  equb_id INT NOT NULL REFERENCES equbs(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  round INT NOT NULL,
  bid_amount DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(equb_id, round, user_id)
);

CREATE INDEX idx_bids_equb ON bids(equb_id);
CREATE INDEX idx_bids_round ON bids(equb_id, round);

-- Audit Log Table (track all important actions)
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INT,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- Referrals Table (for referral program)
CREATE TABLE IF NOT EXISTS referrals (
  id SERIAL PRIMARY KEY,
  referred_by INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_amount DECIMAL(12, 2),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  UNIQUE(referred_by, referred_user)
);

CREATE INDEX idx_referrals_referrer ON referrals(referred_by);

-- Disputes Table (for handling disputes between members)
CREATE TABLE IF NOT EXISTS disputes (
  id SERIAL PRIMARY KEY,
  equb_id INT NOT NULL REFERENCES equbs(id) ON DELETE CASCADE,
  reporter_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  respondent_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(100) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
  resolution TEXT,
  resolved_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP
);

CREATE INDEX idx_disputes_equb ON disputes(equb_id);
CREATE INDEX idx_disputes_status ON disputes(status);

-- View: User Summary
CREATE OR REPLACE VIEW v_user_summary AS
SELECT 
  u.id,
  u.phone,
  u.email,
  u.first_name,
  u.last_name,
  u.role,
  w.balance,
  COALESCE(m.equb_count, 0) as active_equbs,
  u.created_at,
  u.last_login
FROM users u
LEFT JOIN wallets w ON u.id = w.user_id
LEFT JOIN (
  SELECT user_id, COUNT(*) as equb_count 
  FROM memberships 
  WHERE status = 'active' 
  GROUP BY user_id
) m ON u.id = m.user_id
WHERE u.status = 'active';

-- View: Equb Summary
CREATE OR REPLACE VIEW v_equb_summary AS
SELECT 
  e.id,
  e.name,
  e.host_id,
  u.first_name as host_name,
  e.contribution_amount,
  e.total_rounds,
  e.current_round,
  e.cycle_days,
  e.status,
  COALESCE(m.member_count, 0) as current_members,
  e.total_members - COALESCE(m.member_count, 0) as open_slots,
  COALESCE(t.total_value, 0) as total_value_locked,
  e.created_at
FROM equbs e
LEFT JOIN users u ON e.host_id = u.id
LEFT JOIN (
  SELECT equb_id, COUNT(*) as member_count 
  FROM memberships 
  WHERE status = 'active' 
  GROUP BY equb_id
) m ON e.id = m.equb_id
LEFT JOIN (
  SELECT equb_id, COUNT(*) * MAX(e2.contribution_amount) as total_value
  FROM memberships m2
  JOIN equbs e2 ON m2.equb_id = e2.id
  WHERE m2.status = 'active'
  GROUP BY equb_id
) t ON e.id = t.equb_id;

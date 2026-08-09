// ========================================================================
// APPLICATION CONSTANTS & CONFIGURATION
// ========================================================================

// ========================================================================
// FINANCIAL CONSTANTS
// ========================================================================

export const FINANCIAL = {
  // NBE Transaction Limits
  NBE_DAILY_LIMIT: 75000, // ETB
  NBE_SINGLE_TRANSACTION_LIMIT: 75000, // ETB
  NBE_LEVEL_2_DAILY_LIMIT: 300000, // ETB

  // Platform Fees
  PLATFORM_SERVICE_FEE_PERCENT: 0.1, // 0.1%
  PLATFORM_ADMIN_FEE_PERCENT: 0.08, // 0.08%
  PLATFORM_HOST_COMMISSION_PERCENT: 0.02, // 0.02%

  // Credit Score Ranges
  CREDIT_SCORE_MIN: 300,
  CREDIT_SCORE_MAX: 850,
  CREDIT_SCORE_DEFAULT: 500,

  // Trust Tier Thresholds
  TRUST_TIER_THRESHOLDS: {
    standard: 300,
    bronze: 500,
    silver: 650,
    gold: 800,
    verified_trust: 820,
  },

  // Payout Limits
  MULTI_SIG_THRESHOLD: 1000000, // 1M ETB
  MULTI_SIG_REQUIRED_APPROVALS: 2,

  // Currency
  DEFAULT_CURRENCY: 'ETB',
  CURRENCY_DECIMAL_PLACES: 2,
};

// ========================================================================
// TIME CONSTANTS
// ========================================================================

export const TIME = {
  // Grace Periods
  GRACE_PERIOD_SHORT: 12 * 60 * 60 * 1000, // 12 hours
  GRACE_PERIOD_LONG: 24 * 60 * 60 * 1000, // 24 hours

  // Notification Timing
  NOTIFICATION_BEFORE_DEADLINE_24H: 24 * 60 * 60 * 1000,
  NOTIFICATION_BEFORE_DEADLINE_6H: 6 * 60 * 60 * 1000,
  NOTIFICATION_BEFORE_AUTO_DEBIT_30M: 30 * 60 * 1000,

  // Batch Processing
  AUTO_DEBIT_RETRY_INTERVAL: 5 * 60 * 1000, // 5 minutes
  AUTO_DEBIT_MAX_RETRIES: 3,

  // Session Management
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
  TOKEN_REFRESH_BUFFER: 5 * 60 * 1000, // 5 minutes

  // Rate Limiting
  LOGIN_RATE_LIMIT_WINDOW: 5 * 60 * 1000, // 5 minutes
  LOGIN_MAX_ATTEMPTS: 5,
  OTP_RATE_LIMIT_WINDOW: 10 * 60 * 1000, // 10 minutes
  OTP_MAX_ATTEMPTS: 3,

  // CRB Reporting
  CRB_REPORT_DEADLINE: 5 * 24 * 60 * 60 * 1000, // 5 working days

  // Data Retention
  DATA_RETENTION_YEARS: 7,

  // Cycle Frequencies (in days)
  CYCLE_DAILY: 1,
  CYCLE_WEEKLY: 7,
  CYCLE_BIWEEKLY: 14,
  CYCLE_MONTHLY: 30,
};

// ========================================================================
// PENALTY & LATE FEE CONSTANTS
// ========================================================================

export const PENALTIES = {
  // Base Penalty
  BASE_PENALTY_PERCENT: 1, // 1% of contribution

  // Time Damping Factor for logarithmic penalty scaling
  TIME_DAMPING_FACTOR: 12,

  // Risk Coefficients
  LOW_RISK_COEFFICIENT: 0.5,
  MEDIUM_RISK_COEFFICIENT: 1.0,
  HIGH_RISK_COEFFICIENT: 1.5,

  // Default Risk Thresholds
  MISSED_PAYMENTS_FOR_HIGH_RISK: 2,
  CREDIT_SCORE_FOR_HIGH_RISK: 500,
};

// ========================================================================
// API & ENDPOINT CONSTANTS
// ========================================================================

export const API = {
  VERSION: 'v1',
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,

  // Rate Limiting
  RATE_LIMIT_PER_MINUTE: 100,
  RATE_LIMIT_PER_HOUR: 3000,

  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,

  // Webhooks
  WEBHOOK_TIMEOUT: 30000,
  WEBHOOK_RETRY_ATTEMPTS: 3,
  WEBHOOK_RETRY_BACKOFF_BASE: 2,
};

// ========================================================================
// VALIDATION CONSTANTS
// ========================================================================

export const VALIDATION = {
  // Phone Number
  PHONE_NUMBER_REGEX: /^(\+251|0)(9|7)[0-9]{8}$/,
  PHONE_LENGTH_MIN: 10,
  PHONE_LENGTH_MAX: 20,

  // Email
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,

  // Password
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_REQUIRE_UPPERCASE: true,
  PASSWORD_REQUIRE_LOWERCASE: true,
  PASSWORD_REQUIRE_NUMBER: true,
  PASSWORD_REQUIRE_SPECIAL: false,

  // PIN (for USSD)
  PIN_LENGTH: 4,
  PIN_REGEX: /^\d{4}$/,

  // Equb Pool
  EQUB_NAME_MIN_LENGTH: 3,
  EQUB_NAME_MAX_LENGTH: 100,
  EQUB_DESCRIPTION_MAX_LENGTH: 500,
  MIN_CONTRIBUTION_AMOUNT: 100,
  MAX_CONTRIBUTION_AMOUNT: 100000,
  MIN_MEMBERS: 2,
  MAX_MEMBERS: 100,
  MIN_ROUNDS: 1,
  MAX_ROUNDS: 120,

  // Proposal
  PROPOSAL_TITLE_MAX_LENGTH: 150,
  PROPOSAL_DESCRIPTION_MAX_LENGTH: 1000,

  // Support Ticket
  TICKET_SUBJECT_MAX_LENGTH: 100,
  TICKET_DESCRIPTION_MAX_LENGTH: 2000,
};

// ========================================================================
// UI/UX CONSTANTS
// ========================================================================

export const UI = {
  // Colors
  COLORS: {
    PRIMARY: '#10b981', // Emerald green
    SUCCESS: '#10b981',
    ERROR: '#ef4444',
    WARNING: '#f59e0b',
    INFO: '#3b82f6',
    SECONDARY: '#64748b', // Slate gray
    BACKGROUND: '#ffffff',
    TEXT_PRIMARY: '#1f2937',
    TEXT_SECONDARY: '#6b7280',
    BORDER: '#e5e7eb',
  },

  // Spacing
  SPACING: {
    XS: 4,
    SM: 8,
    MD: 16,
    LG: 24,
    XL: 32,
    XXL: 48,
  },

  // Border Radius
  BORDER_RADIUS: {
    NONE: 0,
    SM: 4,
    MD: 8,
    LG: 12,
    XL: 16,
    FULL: 9999,
  },

  // Font Sizes
  FONT_SIZE: {
    XS: 12,
    SM: 14,
    MD: 16,
    LG: 18,
    XL: 20,
    XXL: 24,
    XXXL: 32,
  },

  // Z-Index
  Z_INDEX: {
    DROPDOWN: 100,
    STICKY: 200,
    MODAL: 300,
    POPOVER: 350,
    TOAST: 400,
    TOOLTIP: 450,
  },

  // Animation
  ANIMATION_DURATION: {
    FAST: 150,
    NORMAL: 300,
    SLOW: 500,
  },

  // Icons
  ICON_SIZE: {
    SM: 16,
    MD: 24,
    LG: 32,
    XL: 48,
  },
};

// ========================================================================
// LOCALIZATION CONSTANTS
// ========================================================================

export const LOCALIZATION = {
  SUPPORTED_LANGUAGES: {
    en: 'English',
    am: 'አማርኛ (Amharic)',
    om: 'Afaan Oromoo',
    ti: 'ትግርኛ (Tigrinya)',
  },

  RTL_LANGUAGES: ['am', 'ti', 'ar'],
  LTR_LANGUAGES: ['en', 'om'],

  // Text Expansion Factors (compared to English)
  TEXT_EXPANSION_FACTOR: {
    en: 1.0,
    am: 1.35, // Amharic expands by ~35%
    om: 1.2,
    ti: 1.3, // Tigrinya expands by ~30%
  },

  DEFAULT_LANGUAGE: 'en',
  FALLBACK_LANGUAGE: 'en',

  // Date Formats
  DATE_FORMATS: {
    en: 'MM/DD/YYYY',
    am: 'DD/MM/YYYY',
    om: 'DD/MM/YYYY',
    ti: 'DD/MM/YYYY',
  },

  // Number Formats
  CURRENCY_SYMBOL: 'Br', // Ethiopian Birr
  DECIMAL_SEPARATOR: {
    en: '.',
    am: '.',
    om: '.',
    ti: '.',
  },
  THOUSANDS_SEPARATOR: {
    en: ',',
    am: ',',
    om: ',',
    ti: ',',
  },
};

// ========================================================================
// ACCESSIBILITY CONSTANTS
// ========================================================================

export const ACCESSIBILITY = {
  // WCAG 2.1 AA Standards
  MIN_TOUCH_TARGET_SIZE: 48, // pixels
  MIN_COLOR_CONTRAST_RATIO: 4.5,
  FOCUS_OUTLINE_WIDTH: 2,
  FOCUS_OUTLINE_OFFSET: 2,

  // Font Scaling
  MIN_FONT_SIZE: 12,
  MAX_FONT_SIZE: 32,

  // Motion
  PREFERS_REDUCED_MOTION: '(prefers-reduced-motion: reduce)',
};

// ========================================================================
// FEATURE FLAGS DEFAULTS
// ========================================================================

export const FEATURE_FLAG_DEFAULTS = {
  enableAutoDebit: true,
  enableAuctionBidding: true,
  enableSecondaryMarket: true,
  enableSnbl: true,
  enableSocialProposals: true,
  enableMultiSig: true,
  enableTelegramIntegration: true,
  enableUssdAccess: true,
  enableOfflineMode: true,
  enableA11y: true,
  enableBiometricAuth: true,
  enableDarkMode: true,
  enableRtlLayout: true,
  betaFeatures: false,
};

// ========================================================================
// ERROR CODES & MESSAGES
// ========================================================================

export const ERROR_CODES = {
  // Auth Errors
  INVALID_CREDENTIALS: 'ERR_AUTH_001',
  OTP_EXPIRED: 'ERR_AUTH_002',
  OTP_INVALID: 'ERR_AUTH_003',
  SESSION_EXPIRED: 'ERR_AUTH_004',
  UNAUTHORIZED: 'ERR_AUTH_005',

  // Validation Errors
  INVALID_PHONE: 'ERR_VAL_001',
  INVALID_EMAIL: 'ERR_VAL_002',
  INVALID_PASSWORD: 'ERR_VAL_003',
  INVALID_AMOUNT: 'ERR_VAL_004',

  // Payment Errors
  INSUFFICIENT_BALANCE: 'ERR_PAY_001',
  PAYMENT_DECLINED: 'ERR_PAY_002',
  PAYMENT_TIMEOUT: 'ERR_PAY_003',
  DOUBLE_PAYMENT_DETECTED: 'ERR_PAY_004',

  // Equb Errors
  EQUB_NOT_FOUND: 'ERR_EQUB_001',
  EQUB_FULL: 'ERR_EQUB_002',
  ALREADY_MEMBER: 'ERR_EQUB_003',
  NOT_MEMBER: 'ERR_EQUB_004',

  // General Errors
  NETWORK_ERROR: 'ERR_NET_001',
  SERVER_ERROR: 'ERR_SRV_001',
  NOT_FOUND: 'ERR_NOT_FOUND',
  CONFLICT: 'ERR_CONFLICT',
};

export default {
  FINANCIAL,
  TIME,
  PENALTIES,
  API,
  VALIDATION,
  UI,
  LOCALIZATION,
  ACCESSIBILITY,
  FEATURE_FLAG_DEFAULTS,
  ERROR_CODES,
};

// ========================================================================
// TYPE DEFINITIONS & ENUMS - ALIGNED WITH QALNET ENTERPRISE SCHEMA
// ========================================================================

export type UserRole = 'participant' | 'host' | 'admin';
export type VerificationStatus = 'pending' | 'verified' | 'rejected';
export type EqubStatus = 'open' | 'active' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'auto_debited' | 'failed';
export type PayoutStatus = 'pending' | 'approved' | 'batched' | 'completed' | 'failed';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'rejected';
export type TrustTier = 'standard' | 'bronze' | 'silver' | 'gold' | 'verified_trust';
export type AlertCategory = 'operational' | 'social_trust' | 'system_policy';
export type CycleFrequency = 'weekly' | 'biweekly' | 'monthly' | 'daily';
export type PayoutMechanism = 'lottery' | 'auction' | 'bidding';
export type NotificationChannel = 'telegram' | 'sms' | 'push' | 'in_app';

// ========================================================================
// USER & AUTHENTICATION TYPES
// ========================================================================

export interface User {
  id: string;
  phone: string;
  email: string;
  firstName: string;
  lastName: string;
  telegramHandle?: string;
  telegramChatId?: number;
  faydaId?: string; // Encrypted in database
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface AuthCredentials {
  phone: string;
  password: string;
  otp?: string; // For multi-factor verification
}

// ========================================================================
// WALLET & CREDIT SCORE TYPES
// ========================================================================

export interface Wallet {
  id: string;
  userId: string;
  balance: number;
  currency: string; // 'ETB'
  updatedAt: string;
}

export interface CreditScore {
  id: string;
  userId: string;
  trustScore: number; // 300-850
  tier: TrustTier;
  successfulPaymentsCount: number;
  delayedPaymentsCount: number;
  defaultRate?: number; // Calculated percentage
  updatedAt: string;
}

// ========================================================================
// EQUB GROUP & MEMBERSHIP TYPES
// ========================================================================

export interface EqubGroup {
  id: string;
  hostId: string;
  name: string;
  description?: string;
  telegramGroupId?: number;
  totalAmount: number;
  contributionAmount: number;
  cycleDays: number;
  totalRounds: number;
  currentRound: number;
  status: EqubStatus;
  socialFundBalance: number;
  createdAt: string;
  updatedAt: string;
  
  // Extended fields for UI
  hostName?: string;
  hostReputation?: number;
  members?: EqubMember[];
  payoutMechanism?: PayoutMechanism;
  cycleFrequency?: CycleFrequency;
  nextDeadline?: string;
  unpaidRoundsCount?: number;
  progressPercent?: number;
}

export interface Membership {
  id: string;
  userId: string;
  equbId: string;
  autoDebitToken?: string;
  consentGrantedAt?: string;
  joinedAt: string;
}

// ========================================================================
// PAYMENT & PAYOUT TYPES
// ========================================================================

export interface Payment {
  id: string;
  userId: string;
  equbId: string;
  roundNumber: number;
  amount: number;
  feeDeducted: number; // Platform's 0.08%
  hostCommissionDeducted: number; // Host's 0.02%
  paymentStatus: PaymentStatus;
  transactionReference?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payout {
  id: string;
  equbId: string;
  roundNumber: number;
  winnerId: string;
  totalPotAmount: number;
  status: PayoutStatus;
  createdAt: string;
}

export interface PayoutBatch {
  id: string;
  payoutId: string;
  amount: number;
  scheduledDate: string;
  processedAt?: string;
  transactionReference?: string;
  status: PaymentStatus;
}

export interface MultiSigApproval {
  id: string;
  payoutId: string;
  approverId: string;
  approvedAt: string;
}

export interface PayoutSlotTrade {
  id: string;
  equbId: string;
  roundNumber: number;
  sellerUserId: string;
  buyerUserId?: string;
  premiumAskingPrice: number;
  tradeStatus: TicketStatus;
  completedAt?: string;
  createdAt: string;
}

// ========================================================================
// SOCIAL & GOVERNANCE TYPES
// ========================================================================

export interface SocialProposal {
  id: string;
  equbId: string;
  proposerId: string;
  title: string;
  description: string;
  budget: number;
  status: TicketStatus;
  createdAt: string;
  votesFor?: number;
  votesAgainst?: number;
  voted?: 'for' | 'against';
}

export interface SocialVote {
  id: string;
  proposalId: string;
  userId: string;
  voteValue: boolean; // true = approve, false = reject
  votedAt: string;
}

// ========================================================================
// NOTIFICATION & ALERT TYPES
// ========================================================================

export interface Notification {
  id: string;
  userId: string;
  category: AlertCategory;
  title: string;
  body: string;
  isRead: boolean;
  deliveredChannels: NotificationChannel[];
  createdAt: string;
}

// ========================================================================
// RECONCILIATION & SUPPORT TYPES
// ========================================================================

export interface ReconciliationTicket {
  id: string;
  userId: string;
  paymentId?: string;
  transactionReference: string;
  reportedAmount: number;
  status: TicketStatus;
  assignedAdminId?: string;
  notes?: string;
  resolvedAt?: string;
  createdAt: string;
}

// ========================================================================
// CRB & COMPLIANCE TYPES
// ========================================================================

export interface CrbBlacklist {
  id: string;
  userId: string;
  reason: string;
  reportedAt: string;
  isReleased: boolean;
  releasedAt?: string;
}

// ========================================================================
// USSD SESSION TYPE
// ========================================================================

export interface UssdSession {
  id: string;
  phoneNumber: string;
  sessionId: string;
  lastMenuState: string;
  createdAt: string;
  updatedAt: string;
}

// ========================================================================
// LOTTERY & DRAW TYPES
// ========================================================================

export interface LotteryDraw {
  id: string;
  equbId: string;
  roundNumber: number;
  winnerId: string;
  drawTimestamp: string;
  videoUrl?: string;
  svgCanvasData?: string;
  isPurged: boolean;
  createdAt: string;
}

// ========================================================================
// TRANSLATION & LOCALIZATION TYPES
// ========================================================================

export interface TranslationMap {
  [key: string]: {
    en: string;
    am: string;
    om: string;
    ti: string;
  };
}

export const translations: TranslationMap = {
  // Navigation tabs
  my_equbs: {
    en: "My Equbs",
    am: "የእኔ እቁቦች",
    om: "Qubii koo",
    ti: "ናተይ ዕቑብ",
  },
  discover: {
    en: "Discover",
    am: "አዳዲስ እቁቦች",
    om: "Barbaadi",
    ti: "ሓደሽቲ ዕቑብ",
  },
  calendar: {
    en: "Calendar",
    am: "ቀን መቁጠሪያ",
    om: "Kaalandarii",
    ti: "ዓውደ-አዋርሕ",
  },
  wallet: {
    en: "Wallet",
    am: "ኪስ",
    om: "Koomto",
    ti: "ቦርሳ",
  },
  more: {
    en: "More",
    am: "ተጨማሪ",
    om: "Dabalata",
    ti: "ተወሳኺ",
  },
  
  // Dashboard & Profile
  trust_score: {
    en: "Trust Score",
    am: "የታማኝነት ውጤት",
    om: "Qabxii amanamummaa",
    ti: "ነጥቢ እምነት",
  },
  gold_tier: {
    en: "Gold Tier",
    am: "ወርቅ ደረጃ",
    om: "Sadarkaa Warqee",
    ti: "ወርቂ ደረጃ",
  },
  active: {
    en: "Active",
    am: "አክቲቭ",
    om: "Hojirra",
    ti: "ንጡፍ",
  },
  pending: {
    en: "Pending",
    am: "በጥበቃ ላይ",
    om: "Eeggamaa",
    ti: "ኣብ ምፅባይ",
  },
  completed: {
    en: "Completed",
    am: "የተጠናቀቀ",
    om: "Xumurame",
    ti: "ዝተዛዘመ",
  },
  
  // Actions
  pay_now: {
    en: "Pay Now",
    am: "አሁን ይክፈሉ",
    om: "Amma Kafali",
    ti: "ሕዚ ክፈሉ",
  },
  unpaid_rounds: {
    en: "Unpaid Rounds",
    am: "ያልተከፈሉ ዙሮች",
    om: "Kafaltii hir’ate",
    ti: "ዘይተኸፈሉ ዙራት",
  },
  next_deadline: {
    en: "Next Deadline",
    am: "የመጨረሻ ቀን",
    om: "Guyyaa xumuraa",
    ti: "ናይ መወዳእታ መዓልቲ",
  },
  auto_debit: {
    en: "Auto-Debit",
    am: "ቀጥታ ክፍያ",
    om: "Ofiin kaffaluu",
    ti: "ብቀጥታ ክፍሊት",
  },
  place_bid: {
    en: "Place Bid",
    am: "ጨረታ ይጫረቱ",
    om: "Bid gochuu",
    ti: "ጨረታ ይወዳደሩ",
  },
  lottery_draw: {
    en: "Lottery Draw",
    am: "ዕጣ ማውጣት",
    om: "Icoo baasuu",
    ti: "ዕጫ ምውፃእ",
  },
  current_balance: {
    en: "Current Balance",
    am: "የአሁኑ ቀሪ ሂሳብ",
    om: "Hanga qubannoo",
    ti: "ናይ ሕዚ ባላንስ",
  },
  linked_accounts: {
    en: "Linked Accounts",
    am: "የተገናኙ ሂሳቦች",
    om: "Herrega walqabate",
    ti: "ዝተኣሳሰሩ ሕሳባት",
  },
  transaction_history: {
    en: "Transaction History",
    am: "የክፍያ ታሪክ",
    om: "Seenaa kaffaltii",
    ti: "ታሪክ ክፍሊት",
  },
  faq_title: {
    en: "Frequently Asked Questions",
    am: "ተደጋግመው የሚጠየቁ ጥያቄዎች",
    om: "Gaaffilee yeroo baay'ee",
    ti: "ተደጋጋሚ ሕቶታት",
  },
  co_signer_hub: {
    en: "Guarantee Requests (Co-signer Hub)",
    am: "የዋስትና ጥያቄዎች (ዋስ ማስተዳደሪያ)",
    om: "Koomto Wabummaa",
    ti: "ሕቶታት ዋስትና (ዋስ መተሓባበሪ)",
  },
  liability_tracker: {
    en: "Collateral Liability Tracking",
    am: "የዋስትና እዳ መከታተያ",
    om: "Hordoffii kaffaltii wabummaa",
    ti: "ክትትል ዕዳ ዋስትና",
  },
  bank_integration: {
    en: "Bank/Wallet Integration",
    am: "የባንክ እና የዲጂታል ኪስ ማገናኛ",
    om: "Hordoffii kaffaltii Baankii",
    ti: "ምትእስሳር ባንክን ቦርሳን",
  },
  participation_ledger: {
    en: "Equb Participation Ledger",
    am: "የእቁብ ተሳትፎ መዝገብ",
    om: "Galmee hirmaannaa Qubii",
    ti: "መዝገብ ተሳትፎ ዕቑብ",
  },
  role_member: {
    en: "Saver / Member",
    am: "ቆጣቢ / አባል",
    om: "Qusataa / Miseensa",
    ti: "ቆጣቢ / ኣባል",
  },
  role_host: {
    en: "Organizer / Host",
    am: "አዘጋጅ / እቁብ ዳኛ",
    om: "Qopheessaa",
    ti: "ኣሰናዳኢ / እቁብ ዳኛ",
  },
  role_guarantor: {
    en: "Guarantor / Trust Partner",
    am: "ዋስ / የታማኝነት አጋር",
    om: "Wabi / Amanamaa",
    ti: "ዋስ / ናይ እምነት መሻርኽቲ",
  },
  host_dashboard: {
    en: "Host Control Panel",
    am: "የእቁብ ዳኛ መቆጣጠሪያ",
    om: "Gabaasa Qopheessaa",
    ti: "ናይ እቁብ ዳኛ መቆጣጠሪ",
  },
  create_pool: {
    en: "Launch New Equb Circle",
    am: "አዲስ እቁብ መመስረት",
    om: "Qubii Haaraa Uumi",
    ti: "ሓድሽ እቁብ መስርት",
  },
  active_role: {
    en: "Active Actor Role",
    am: "ንቁ የስራ ድርሻ",
    om: "Gahee Hojii",
    ti: "ንጡፍ ናይ ስራሕ ተራ",
  },
};

export interface EqubMember {
  id: string;
  name: string;
  avatar: string;
  paidThisRound: boolean;
  trustScore: number;
}

export interface EqubPool {
  id: string;
  name: string;
  hostName: string;
  hostReputation: number; // 0 to 5.0
  contributionSize: number; // in ETB
  cycleFrequency: "weekly" | "biweekly" | "monthly";
  payoutMechanism: "lottery" | "auction";
  totalCapacity: number;
  currentMembersCount: number;
  progressPercent: number;
  unpaidRoundsCount: number;
  nextDeadline: string;
  autoDebitEnabled: boolean;
  status: "active" | "pending" | "completed";
  currentRound: number;
  totalRounds: number;
  members: EqubMember[];
  payoutAmount: number;
  socialProposals?: {
    id: string;
    title: string;
    description: string;
    votesFor: number;
    votesAgainst: number;
    voted?: "for" | "against";
    status: "active" | "passed" | "rejected";
  }[];
  multisigApprovals?: {
    id: string;
    action: string;
    amount: number;
    approvedBy: string[];
    requiredCount: number;
    status: "pending" | "approved" | "rejected";
  }[];
}

export const initialActiveEqubs: EqubPool[] = [];

export const initialDiscoverEqubs: EqubPool[] = [];

export const faqList: { q: string; a: string }[] = [];

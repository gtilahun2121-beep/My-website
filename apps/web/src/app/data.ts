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

export const initialActiveEqubs: EqubPool[] = [
  {
    id: "active-1",
    name: "Addis Merchants Circle",
    hostName: "Mamo & Sons Trading",
    hostReputation: 4.9,
    contributionSize: 5000,
    cycleFrequency: "weekly",
    payoutMechanism: "auction",
    totalCapacity: 12,
    currentMembersCount: 12,
    progressPercent: 65,
    unpaidRoundsCount: 1, // Focus highlight for unpaid round
    nextDeadline: "2026-08-02",
    autoDebitEnabled: true,
    status: "active",
    currentRound: 8,
    totalRounds: 12,
    payoutAmount: 60000,
    members: [
      { id: "m-1", name: "Mamo (Host)", avatar: "👨‍💼", paidThisRound: true, trustScore: 920 },
      { id: "m-2", name: "Aster K.", avatar: "👩‍🍳", paidThisRound: true, trustScore: 890 },
      { id: "m-3", name: "Kebede A.", avatar: "👨‍🌾", paidThisRound: false, trustScore: 780 }, // unpaid
      { id: "m-4", name: "Tsehay M.", avatar: "👩‍⚕️", paidThisRound: true, trustScore: 940 },
      { id: "m-5", name: "Selam G.", avatar: "👩‍💼", paidThisRound: true, trustScore: 850 },
      { id: "m-6", name: "Yonas B.", avatar: "👨‍💻", paidThisRound: true, trustScore: 880 },
    ],
    socialProposals: [
      {
        id: "prop-1",
        title: "Extend grace period to 48 hours",
        description: "Due to telebirr system maintenance, extend payment window from 24h to 48h.",
        votesFor: 8,
        votesAgainst: 2,
        status: "active"
      },
      {
        id: "prop-2",
        title: "Buy shop refrigerator for Aster",
        description: "Social Emergency Fund payout request of 15,000 ETB. Aster will repay with 2% premium.",
        votesFor: 10,
        votesAgainst: 1,
        status: "passed"
      }
    ],
    multisigApprovals: [
      {
        id: "sig-1",
        action: "Release Bid Payout to Selam G.",
        amount: 54000,
        approvedBy: ["m-1", "m-4"],
        requiredCount: 3,
        status: "pending"
      }
    ]
  },
  {
    id: "active-2",
    name: "Bole Tech Startups",
    hostName: "Sheger Tech Labs",
    hostReputation: 4.8,
    contributionSize: 10000,
    cycleFrequency: "monthly",
    payoutMechanism: "lottery",
    totalCapacity: 10,
    currentMembersCount: 10,
    progressPercent: 30,
    unpaidRoundsCount: 0,
    nextDeadline: "2026-08-15",
    autoDebitEnabled: false,
    status: "active",
    currentRound: 3,
    totalRounds: 10,
    payoutAmount: 100000,
    members: [
      { id: "t-1", name: "Host (Sheger)", avatar: "🏢", paidThisRound: true, trustScore: 950 },
      { id: "t-2", name: "Elias T.", avatar: "👨‍💻", paidThisRound: true, trustScore: 910 },
      { id: "t-3", name: "Meron H.", avatar: "👩‍💻", paidThisRound: true, trustScore: 890 },
      { id: "t-4", name: "Dawit S.", avatar: "👨‍🎨", paidThisRound: true, trustScore: 840 },
    ]
  }
];

export const initialDiscoverEqubs: EqubPool[] = [
  {
    id: "disc-1",
    name: "Mercato Spices & Grains Pool",
    hostName: "Almaz Agricultural Wholesale",
    hostReputation: 4.95,
    contributionSize: 2000,
    cycleFrequency: "weekly",
    payoutMechanism: "auction",
    totalCapacity: 15,
    currentMembersCount: 12,
    progressPercent: 80, // 12/15 members filled
    unpaidRoundsCount: 0,
    nextDeadline: "2026-08-01",
    autoDebitEnabled: false,
    status: "pending",
    currentRound: 0,
    totalRounds: 15,
    payoutAmount: 30000,
    members: []
  },
  {
    id: "disc-2",
    name: "Telebirr Agents Savings Circle",
    hostName: "EthioTelecom Agent Hub",
    hostReputation: 4.7,
    contributionSize: 3000,
    cycleFrequency: "weekly",
    payoutMechanism: "lottery",
    totalCapacity: 20,
    currentMembersCount: 18,
    progressPercent: 90,
    unpaidRoundsCount: 0,
    nextDeadline: "2026-08-05",
    autoDebitEnabled: true,
    status: "pending",
    currentRound: 0,
    totalRounds: 20,
    payoutAmount: 60000,
    members: []
  },
  {
    id: "disc-3",
    name: "SNBL - Dashen Agri-Equipment",
    hostName: "Dashen Bank Partner",
    hostReputation: 4.85,
    contributionSize: 8000,
    cycleFrequency: "monthly",
    payoutMechanism: "lottery", // Save Now, Buy Later (SNBL) Redemptions
    totalCapacity: 8,
    currentMembersCount: 6,
    progressPercent: 75,
    unpaidRoundsCount: 0,
    nextDeadline: "2026-08-10",
    autoDebitEnabled: false,
    status: "pending",
    currentRound: 0,
    totalRounds: 8,
    payoutAmount: 64000, // redeemable in commercial high-efficiency motor pumps
    members: []
  }
];

export const faqList = [
  {
    q: "What is an Equb (እቁብ)?",
    a: "An Equb is a traditional Ethiopian Rotating Savings and Credit Association (RoSCA). A group of members agree to save a fixed amount regularly (weekly or monthly), and the pooled sum is distributed to one member each round, selected either by lottery or bidding/auction."
  },
  {
    q: "How does the Auction Payout (Discount Premium) work?",
    a: "In bidding Equbs, members submit the discount premium they are willing to offer (e.g. bidding 1,000 ETB from a 10,000 ETB payout). The highest bidder gets the payout immediately, and their bid amount is redistributed among the other members as an instant bonus return. This enables collateral-free urgent capital mobilization."
  },
  {
    q: "What is SNBL (Save Now, Buy Later)?",
    a: "SNBL connects savings milestones with partner commercial redemptions (e.g. agricultural equipment, wholesale stock). Instead of raw cash, pools are integrated with verified merchants who provide high-value assets at bulk-discounted rates."
  },
  {
    q: "How does Offline USSD Mode (*808#) sync?",
    a: "Feature phone users dial *808# to participate in the exact same ledger database. They receive SMS notifications and complete payments via Telebirr or CBE instant menus. Smart phone users can also drop to offline state, and their actions queue up locally, syncing instantly when network is restored."
  }
];

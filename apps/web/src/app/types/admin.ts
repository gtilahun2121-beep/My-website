// Admin Role Definitions
export type AdminRole = 
  | 'super_admin' 
  | 'kyc_approver' 
  | 'dispute_manager' 
  | 'finance_auditor';

// Permission Types
export type Permission = 
  | 'view_members'
  | 'approve_kyc'
  | 'reject_kyc'
  | 'manage_disputes'
  | 'resolve_disputes'
  | 'view_financial_records'
  | 'generate_reports'
  | 'assign_roles'
  | 'manage_permissions'
  | 'view_audit_logs'
  | 'manage_admin_users'
  | 'system_settings';

// Admin User Data Structure
export interface AdminUser {
  id: string;
  email: string;
  passwordHash: string; // In production, use bcrypt or similar
  role: AdminRole;
  fullName: string;
  phone?: string;
  mfaEnabled: boolean;
  mfaSecret?: string; // For TOTP
  mfaMethod: 'email' | 'totp' | 'both';
  mfaCode?: string; // For demo purposes only
  createdAt: string;
  lastLogin?: string;
  permissions: Permission[];
  status: 'active' | 'inactive' | 'suspended';
  twoFactorBackupCodes?: string[];
}

// Role to Permissions Mapping
export const rolePermissions: Record<AdminRole, Permission[]> = {
  super_admin: [
    'view_members',
    'approve_kyc',
    'reject_kyc',
    'manage_disputes',
    'resolve_disputes',
    'view_financial_records',
    'generate_reports',
    'assign_roles',
    'manage_permissions',
    'view_audit_logs',
    'manage_admin_users',
    'system_settings',
  ],
  kyc_approver: [
    'view_members',
    'approve_kyc',
    'reject_kyc',
    'view_audit_logs',
  ],
  dispute_manager: [
    'view_members',
    'manage_disputes',
    'resolve_disputes',
    'view_financial_records',
    'view_audit_logs',
  ],
  finance_auditor: [
    'view_members',
    'view_financial_records',
    'generate_reports',
    'view_audit_logs',
  ],
};

// Role Display Names and Colors
export const roleDisplay: Record<AdminRole, { name: string; color: string; icon: string }> = {
  super_admin: {
    name: 'Super Admin',
    color: 'from-[#ce1126] to-[#0d7e4d]',
    icon: '👑',
  },
  kyc_approver: {
    name: 'KYC Approver',
    color: 'from-[#0d7e4d] to-[#d4af37]',
    icon: '✅',
  },
  dispute_manager: {
    name: 'Dispute Manager',
    color: 'from-yellow-500 to-orange-500',
    icon: '⚖️',
  },
  finance_auditor: {
    name: 'Finance Auditor',
    color: 'from-blue-500 to-blue-600',
    icon: '💰',
  },
};

// Member Data Structure
export interface Member {
  id: string;
  phoneNumber: string;
  fullName: string;
  pin: string;
  faydaNumber: string;
  email?: string;
  status: 'active' | 'suspended' | 'inactive';
  kycStatus: 'pending' | 'approved' | 'rejected';
  kycDocuments?: {
    idPhoto: string;
    proofOfResidence: string;
    submittedAt: string;
  };
  registeredAt: string;
  lastActive?: string;
}

// KYC Document Structure
export interface KYCDocument {
  id: string;
  memberId: string;
  memberName: string;
  memberPhone: string;
  documentType: 'id_photo' | 'proof_of_residence' | 'business_license';
  documentUrl: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvalNotes?: string;
  rejectionReason?: string;
}

// Dispute Structure
export interface Dispute {
  id: string;
  complainantId: string;
  complainantName: string;
  respondentId: string;
  respondentName: string;
  description: string;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: string;
  resolvedAt?: string;
  assignedTo?: string;
  resolution?: string;
  evidence?: string[];
}

// Financial Record Structure
export interface FinancialRecord {
  id: string;
  memberId: string;
  memberName: string;
  type: 'payment' | 'payout' | 'fee' | 'refund';
  amount: number;
  currency: 'ETB' | 'USD';
  description: string;
  status: 'completed' | 'pending' | 'failed';
  date: string;
  equbId?: string;
}

// MFA Challenge Structure
export interface MFAChallenge {
  id: string;
  adminId: string;
  method: 'email' | 'totp';
  code?: string;
  expiresAt: number;
  attempts: number;
  maxAttempts: number;
}

// Audit Log Structure
export interface AuditLog {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  targetId?: string;
  targetType?: string;
  changes?: Record<string, any>;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
}

// Default Super Admin Seed (for initial setup)
export const DEFAULT_SUPER_ADMIN: Omit<AdminUser, 'id'> = {
  email: 'admin@qalnet.com',
  passwordHash: '', // Should be set with a strong password
  role: 'super_admin',
  fullName: 'QalNet Administrator',
  mfaEnabled: true,
  mfaMethod: 'both',
  createdAt: new Date().toISOString(),
  permissions: rolePermissions.super_admin,
  status: 'active',
};

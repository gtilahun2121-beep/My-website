/**
 * Admin Service Layer
 * Handles admin authentication, role-based access control, and permission management
 */

export type AdminRole = 'super_admin' | 'kyc_approver' | 'dispute_manager' | 'finance_auditor';

export interface AdminUser {
  id: string;
  email: string;
  role: AdminRole;
  permissions: string[];
  lastLogin?: string;
  createdAt: string;
}

export interface AdminLoginRequest {
  email: string;
  masterPassword: string;
}

export interface AdminLoginResponse {
  user: AdminUser;
  token: string;
}

// Role-based permissions
const ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  super_admin: [
    'manage_users',
    'manage_admins',
    'approve_kyc',
    'manage_disputes',
    'view_finance',
    'view_reports',
    'system_settings',
    'all',
  ],
  kyc_approver: [
    'approve_kyc',
    'reject_kyc',
    'view_members',
    'view_reports',
  ],
  dispute_manager: [
    'manage_disputes',
    'view_members',
    'view_transactions',
    'view_reports',
  ],
  finance_auditor: [
    'view_finance',
    'view_transactions',
    'view_reports',
    'audit_logs',
  ],
};

/**
 * Admin Service Class
 * Handles all admin-related operations with RBAC
 */
export class AdminService {
  private static readonly STORAGE_PREFIX = 'qalnet_';
  private static readonly ADMIN_KEY = `${AdminService.STORAGE_PREFIX}admin`;
  private static readonly ADMIN_TOKEN_KEY = `${AdminService.STORAGE_PREFIX}admin_token`;
  private static readonly CURRENT_ADMIN_KEY = `${AdminService.STORAGE_PREFIX}current_admin`;

  /**
   * Admin Login
   */
  static async adminLogin(credentials: AdminLoginRequest): Promise<AdminLoginResponse> {
    this.validateLoginCredentials(credentials);

    const admin = this.getAdminByEmail(credentials.email);
    if (!admin) {
      throw new Error('Admin account not found');
    }

    if (admin.masterPassword !== credentials.masterPassword) {
      throw new Error('Invalid credentials');
    }

    // Update last login
    admin.lastLogin = new Date().toISOString();
    this.persistAdmin(admin);

    // Generate and store token
    const token = this.generateToken(admin.id);
    this.setAdminToken(token);
    this.setCurrentAdmin(admin);

    return {
      user: this.stripSensitiveData(admin),
      token,
    };
  }

  /**
   * Get Current Admin
   */
  static getCurrentAdmin(): AdminUser | null {
    const token = this.getAdminToken();
    if (!token) return null;

    const admin = JSON.parse(localStorage.getItem(this.CURRENT_ADMIN_KEY) || 'null');
    return admin;
  }

  /**
   * Logout
   */
  static adminLogout(): void {
    localStorage.removeItem(this.ADMIN_TOKEN_KEY);
    localStorage.removeItem(this.CURRENT_ADMIN_KEY);
  }

  /**
   * Check Permission
   */
  static hasPermission(email: string, permission: string): boolean {
    const admin = this.getAdminByEmail(email);
    if (!admin) return false;

    // Super admin has all permissions
    if (admin.role === 'super_admin') return true;

    return admin.permissions.includes(permission);
  }

  /**
   * Check Role
   */
  static hasRole(email: string, role: AdminRole): boolean {
    const admin = this.getAdminByEmail(email);
    if (!admin) return false;
    return admin.role === role;
  }

  /**
   * Can Perform Action
   */
  static canPerformAction(email: string, action: string): { allowed: boolean; reason?: string } {
    const admin = this.getAdminByEmail(email);
    if (!admin) {
      return { allowed: false, reason: 'Admin not found' };
    }

    if (!this.hasPermission(email, action)) {
      return { allowed: false, reason: `Insufficient permissions for action: ${action}` };
    }

    return { allowed: true };
  }

  /**
   * Get Admin by Email
   */
  static getAdminByEmail(email: string): AdminUser & { masterPassword?: string } | null {
    try {
      const admins = this.getAllAdmins();
      return admins.find((a) => a.email === email) || null;
    } catch {
      return null;
    }
  }

  /**
   * Get All Admins
   */
  static getAllAdmins(): (AdminUser & { masterPassword?: string })[] {
    try {
      const data = localStorage.getItem(this.ADMIN_KEY);
      return data ? JSON.parse(data) : this.getDefaultAdmins();
    } catch {
      return this.getDefaultAdmins();
    }
  }

  /**
   * Get Admins by Role
   */
  static getAdminsByRole(role: AdminRole): AdminUser[] {
    const admins = this.getAllAdmins();
    return admins.filter((a) => a.role === role) as AdminUser[];
  }

  /**
   * Validation Methods
   */
  private static validateLoginCredentials(credentials: AdminLoginRequest): void {
    if (!credentials.email) {
      throw new Error('Email is required');
    }
    if (!credentials.masterPassword) {
      throw new Error('Master password is required');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(credentials.email)) {
      throw new Error('Invalid email format');
    }
  }

  /**
   * Token Management
   */
  private static generateToken(adminId: string): string {
    // Simple token generation (in production, use JWT)
    return `${adminId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static setAdminToken(token: string): void {
    localStorage.setItem(this.ADMIN_TOKEN_KEY, token);
  }

  private static getAdminToken(): string | null {
    return localStorage.getItem(this.ADMIN_TOKEN_KEY);
  }

  /**
   * Persistence
   */
  private static persistAdmin(admin: AdminUser & { masterPassword?: string }): void {
    const admins = this.getAllAdmins();
    const index = admins.findIndex((a) => a.id === admin.id);
    if (index >= 0) {
      admins[index] = admin;
    } else {
      admins.push(admin);
    }
    localStorage.setItem(this.ADMIN_KEY, JSON.stringify(admins));
  }

  private static setCurrentAdmin(admin: AdminUser & { masterPassword?: string }): void {
    const safeAdmin: AdminUser = this.stripSensitiveData(admin);
    localStorage.setItem(this.CURRENT_ADMIN_KEY, JSON.stringify(safeAdmin));
  }

  /**
   * Utility Methods
   */
  private static stripSensitiveData(admin: AdminUser & { masterPassword?: string }): AdminUser {
    const { masterPassword, ...safe } = admin;
    return safe;
  }

  private static getDefaultAdmins(): (AdminUser & { masterPassword?: string })[] {
    return [
      {
        id: 'admin_1',
        email: 'super@qalnet.com',
        role: 'super_admin',
        masterPassword: 'master123',
        permissions: ROLE_PERMISSIONS.super_admin,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'admin_2',
        email: 'kyc@qalnet.com',
        role: 'kyc_approver',
        masterPassword: 'kyc123',
        permissions: ROLE_PERMISSIONS.kyc_approver,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'admin_3',
        email: 'dispute@qalnet.com',
        role: 'dispute_manager',
        masterPassword: 'dispute123',
        permissions: ROLE_PERMISSIONS.dispute_manager,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'admin_4',
        email: 'finance@qalnet.com',
        role: 'finance_auditor',
        masterPassword: 'finance123',
        permissions: ROLE_PERMISSIONS.finance_auditor,
        createdAt: new Date().toISOString(),
      },
    ];
  }
}

export default AdminService;

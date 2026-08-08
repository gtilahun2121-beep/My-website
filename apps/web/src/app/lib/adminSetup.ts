import { AdminUser, rolePermissions } from '@/app/types/admin';

/**
 * Initialize demo admin accounts for testing
 * This should only be called once during setup
 */
export function initializeDemoAdmins() {
  const demoAdmins: Record<string, AdminUser> = {
    'super@qalnet.com': {
      id: 'admin1',
      email: 'super@qalnet.com',
      passwordHash: btoa('SuperAdmin123!'),
      role: 'super_admin',
      fullName: 'Abeba Getnet',
      phone: '+251911000001',
      mfaEnabled: true,
      mfaMethod: 'both',
      mfaCode: '000000',
      createdAt: new Date().toISOString(),
      permissions: rolePermissions.super_admin,
      status: 'active',
    },
    'kyc@qalnet.com': {
      id: 'admin2',
      email: 'kyc@qalnet.com',
      passwordHash: btoa('KYC@Approver123'),
      role: 'kyc_approver',
      fullName: 'Mekdes Tekle',
      phone: '+251911000002',
      mfaEnabled: true,
      mfaMethod: 'email',
      mfaCode: '000000',
      createdAt: new Date().toISOString(),
      permissions: rolePermissions.kyc_approver,
      status: 'active',
    },
    'dispute@qalnet.com': {
      id: 'admin3',
      email: 'dispute@qalnet.com',
      passwordHash: btoa('Dispute@Manager123'),
      role: 'dispute_manager',
      fullName: 'Yohannes Mulugeta',
      phone: '+251911000003',
      mfaEnabled: false,
      mfaMethod: 'email',
      createdAt: new Date().toISOString(),
      permissions: rolePermissions.dispute_manager,
      status: 'active',
    },
    'auditor@qalnet.com': {
      id: 'admin4',
      email: 'auditor@qalnet.com',
      passwordHash: btoa('Auditor@Finance123'),
      role: 'finance_auditor',
      fullName: 'Zerihun Tekest',
      phone: '+251911000004',
      mfaEnabled: true,
      mfaMethod: 'totp',
      mfaCode: '000000',
      createdAt: new Date().toISOString(),
      permissions: rolePermissions.finance_auditor,
      status: 'active',
    },
  };

  // Store in localStorage
  Object.entries(demoAdmins).forEach(([email, admin]) => {
    const key = `qalnet_admin_${email}`;
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, JSON.stringify(admin));
    }
  });

  return demoAdmins;
}

/**
 * Get all demo admin credentials for testing
 */
export function getDemoAdminCredentials() {
  return [
    {
      email: 'super@qalnet.com',
      password: 'SuperAdmin123!',
      role: 'Super Admin',
      mfa: 'Enabled (000000)',
    },
    {
      email: 'kyc@qalnet.com',
      password: 'KYC@Approver123',
      role: 'KYC Approver',
      mfa: 'Enabled - Email (000000)',
    },
    {
      email: 'dispute@qalnet.com',
      password: 'Dispute@Manager123',
      role: 'Dispute Manager',
      mfa: 'Disabled',
    },
    {
      email: 'auditor@qalnet.com',
      password: 'Auditor@Finance123',
      role: 'Finance Auditor',
      mfa: 'Enabled - TOTP (000000)',
    },
  ];
}

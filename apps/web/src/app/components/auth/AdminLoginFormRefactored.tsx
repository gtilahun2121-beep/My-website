'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import FormInput from '@/app/components/forms/FormInput';
import FormButton from '@/app/components/forms/FormButton';
import FormError from '@/app/components/forms/FormError';
import FormSuccess from '@/app/components/forms/FormSuccess';
import ValidationSchema from '@/app/utils/validation';
import AdminService, { AdminUser } from '@/app/services/adminService';

interface AdminLoginFormRefactoredProps {
  onSuccess?: (title: string, message: string, duration?: number) => void;
  onError?: (title: string, message: string, duration?: number) => void;
}

type AdminLoginStep = 'credentials' | 'mfa' | 'success';

/**
 * Refactored Admin Login Form Component
 * Professional admin authentication with RBAC and security
 */
export default function AdminLoginFormRefactored({
  onSuccess,
  onError,
}: AdminLoginFormRefactoredProps) {
  // Step tracking
  const [step, setStep] = useState<AdminLoginStep>('credentials');

  // Form state
  const [email, setEmail] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [admin, setAdmin] = useState<AdminUser | null>(null);

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  // Handlers
  const handleCredentialsSubmit = async () => {
    setLoading(true);
    try {
      // Validate input
      const emailValidation = ValidationSchema.validateEmail(email);
      if (!emailValidation.valid) {
        throw new Error(emailValidation.error);
      }

      if (!masterPassword) {
        throw new Error('Master password is required');
      }

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Use AdminService for login
      const response = await AdminService.adminLogin({
        email,
        masterPassword,
      });

      onSuccess?.(
        '✓ Credentials Verified',
        'Proceeding to multi-factor authentication',
        3000
      );
      setError('');
      setStep('mfa');
    } catch (err: any) {
      setError(err.message);
      onError?.('Login Failed', err.message, 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async () => {
    setLoading(true);
    try {
      if (mfaCode.length !== 6 || !/^\d+$/.test(mfaCode)) {
        throw new Error('MFA code must be exactly 6 digits');
      }

      // Simulate MFA validation
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Get admin data
      const adminData = AdminService.getAdminByEmail(email);
      if (!adminData) {
        throw new Error('Admin data not found');
      }

      const cleanAdmin: AdminUser = {
        id: adminData.id,
        email: adminData.email,
        role: adminData.role,
        permissions: adminData.permissions,
        lastLogin: adminData.lastLogin,
        createdAt: adminData.createdAt,
      };

      setAdmin(cleanAdmin);
      onSuccess?.(
        '🔐 Login Successful',
        `Welcome back, ${adminData.email}!`,
        4000
      );
      setError('');
      setStep('success');
    } catch (err: any) {
      setError(err.message);
      onError?.('MFA Failed', err.message, 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleBackFromMfa = () => {
    setStep('credentials');
    setError('');
    setMfaCode('');
  };

  return (
    <motion.div
      className="bg-white rounded-2xl p-8 shadow-xl"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Step 1: Credentials */}
      {step === 'credentials' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div>
            <h3 className="text-2xl font-black text-purple-600 mb-2 text-center">
              👑 Admin Portal
            </h3>
            <p className="text-center text-sm text-gray-600 mb-4">
              Enter your admin credentials to continue
            </p>
          </div>

          <FormInput
            label="Admin Email"
            type="email"
            placeholder="admin@qalnet.com"
            value={email}
            onChange={setEmail}
            icon="📧"
            hint="Your admin email address"
            autoComplete="email"
          />

          <FormInput
            label="Master Password"
            type="password"
            placeholder="••••••••"
            value={masterPassword}
            onChange={setMasterPassword}
            icon="🔐"
            hint="Your secure master password"
            autoComplete="current-password"
          />

          {error && <FormError message={error} onDismiss={() => setError('')} />}

          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3 text-xs text-blue-700">
            <p className="font-bold mb-2">Demo Accounts:</p>
            <p>super@qalnet.com / master123 (Super Admin)</p>
            <p>kyc@qalnet.com / kyc123 (KYC Approver)</p>
            <p>dispute@qalnet.com / dispute123 (Dispute Manager)</p>
            <p>finance@qalnet.com / finance123 (Finance Auditor)</p>
          </div>

          <FormButton
            onClick={handleCredentialsSubmit}
            disabled={!email || !masterPassword || loading}
            loading={loading}
            variant="danger"
            icon="→"
          >
            Verify Credentials
          </FormButton>
        </motion.div>
      )}

      {/* Step 2: MFA */}
      {step === 'mfa' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div>
            <h3 className="text-2xl font-black text-purple-600 mb-2 text-center">
              🔑 Multi-Factor Authentication
            </h3>
            <p className="text-center text-sm text-gray-600 mb-4">
              Enter the 6-digit MFA code from your authenticator
            </p>
          </div>

          <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-3">
            <p className="text-xs text-purple-700 font-bold">📧 Email: {email}</p>
          </div>

          <FormInput
            label="MFA Code"
            type="text"
            placeholder="000000"
            value={mfaCode}
            onChange={(val) => setMfaCode(val.replace(/\D/g, ''))}
            maxLength={6}
            icon="🔐"
            hint="Demo: Enter any 6-digit code"
          />

          {error && <FormError message={error} onDismiss={() => setError('')} />}

          <FormButton
            onClick={handleMfaSubmit}
            disabled={mfaCode.length !== 6 || loading}
            loading={loading}
            variant="danger"
            icon="✓"
          >
            Verify MFA Code
          </FormButton>

          <FormButton onClick={handleBackFromMfa} disabled={loading} variant="secondary">
            ← Back
          </FormButton>
        </motion.div>
      )}

      {/* Step 3: Success */}
      {step === 'success' && admin && (
        <>
          <FormSuccess
            title="✅ Admin Login Successful!"
            message="You have been authenticated with multi-factor security"
            icon="🔐"
          />

          <div className="mt-6 bg-purple-50 border-2 border-purple-200 rounded-lg p-4 space-y-3">
            <div>
              <p className="text-xs font-bold text-purple-900 mb-3">Admin Details:</p>
              <div className="space-y-1 text-xs text-purple-800">
                <p>
                  <span className="font-bold">📧 Email:</span> {admin.email}
                </p>
                <p>
                  <span className="font-bold">👑 Role:</span>{' '}
                  {admin.role.replace('_', ' ').toUpperCase()}
                </p>
                <p>
                  <span className="font-bold">🔑 Permissions:</span> {admin.permissions.length}
                </p>
                <p>
                  <span className="font-bold">📅 Created:</span>{' '}
                  {new Date(admin.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          <motion.button
            onClick={() => (window.location.href = '/admin/dashboard')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-full py-3 mt-6 bg-gradient-to-r from-purple-600 to-red-600 text-white font-black rounded-full hover:shadow-lg transition-all duration-300"
          >
            📊 Go to Admin Dashboard
          </motion.button>
        </>
      )}
    </motion.div>
  );
}

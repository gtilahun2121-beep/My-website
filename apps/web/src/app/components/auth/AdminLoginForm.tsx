'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { AdminUser, roleDisplay } from '@/app/types/admin';

interface AdminLoginFormProps {
  onSuccess?: (title: string, message: string, duration?: number) => void;
  onError?: (title: string, message: string, duration?: number) => void;
}

type AdminLoginStep = 'email' | 'password' | 'mfa' | 'success';

export default function AdminLoginForm({ onSuccess, onError }: AdminLoginFormProps) {
  const [step, setStep] = useState<AdminLoginStep>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [adminData, setAdminData] = useState<AdminUser | null>(null);

  // Step 1: Email submission
  const handleEmailSubmit = async () => {
    setError('');
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setError('Invalid email format');
      onError?.('Invalid Email', 'Please enter a valid email address', 3000);
      return;
    }

    setLoading(true);
    // Simulate API call - Check if admin exists
    setTimeout(() => {
      const storedAdmin = localStorage.getItem(`qalnet_admin_${email}`);
      if (!storedAdmin) {
        setError('Admin account not found');
        onError?.('Account Not Found', 'Email not registered as admin', 3000);
        setLoading(false);
        return;
      }

      onSuccess?.('Email Found', 'Enter your master password');
      setLoading(false);
      setStep('password');
    }, 1000);
  };

  // Step 2: Password verification
  const handlePasswordSubmit = async () => {
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      onError?.('Invalid Password', 'Password too short', 3000);
      return;
    }

    setLoading(true);
    // Simulate API call - Verify password
    setTimeout(() => {
      const storedAdmin = localStorage.getItem(`qalnet_admin_${email}`);
      if (!storedAdmin) {
        setError('Admin not found');
        setLoading(false);
        return;
      }

      const admin = JSON.parse(storedAdmin);
      // In production, use bcrypt.compare()
      if (admin.passwordHash !== btoa(password)) {
        setError('Invalid password');
        onError?.('Wrong Password', 'The password you entered is incorrect', 3000);
        setLoading(false);
        return;
      }

      if (admin.mfaEnabled) {
        onSuccess?.('Password Verified', 'Enter your MFA code');
        setLoading(false);
        setStep('mfa');
      } else {
        setAdminData(admin);
        setLoading(false);
        onSuccess?.('✅ Login Successful', `Welcome ${admin.fullName}!`);
        setStep('success');
      }
    }, 1000);
  };

  // Step 3: MFA verification
  const handleMFASubmit = async () => {
    setError('');
    if (mfaCode.length !== 6) {
      setError('MFA code must be 6 digits');
      onError?.('Invalid Code', 'Code must be exactly 6 digits', 3000);
      return;
    }

    setLoading(true);
    // Simulate API call - Verify MFA
    setTimeout(() => {
      const storedAdmin = localStorage.getItem(`qalnet_admin_${email}`);
      if (!storedAdmin) {
        setError('Admin not found');
        setLoading(false);
        return;
      }

      const admin = JSON.parse(storedAdmin);
      // In production, verify TOTP token or email OTP
      if (mfaCode !== '000000' && mfaCode !== admin.mfaCode) {
        setError('Invalid MFA code');
        onError?.('Invalid Code', 'The MFA code is incorrect or expired', 3000);
        setLoading(false);
        return;
      }

      setAdminData(admin);
      setLoading(false);
      onSuccess?.('🔓 Login Successful', `Welcome ${admin.fullName}!`);
      setStep('success');

      // Store auth token
      localStorage.setItem('qalnet_admin_token', email);
      localStorage.setItem('qalnet_admin_role', admin.role);
    }, 1500);
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  return (
    <motion.div
      className="bg-white rounded-2xl p-8 shadow-xl"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Step 1: Email */}
      {step === 'email' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h3 className="text-2xl font-black text-[#ce1126] mb-2 text-center">
            🔐 Admin Portal
          </h3>
          <p className="text-center text-sm text-gray-600 mb-6">
            Sign in with your admin email
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-[#0d7e4d] mb-2">
                Admin Email
              </label>
              <input
                type="email"
                placeholder="admin@qalnet.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border-2 border-[#d4af37] rounded-lg focus:outline-none focus:border-[#ce1126] font-bold"
              />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded"
              >
                {error}
              </motion.div>
            )}

            <motion.button
              onClick={handleEmailSubmit}
              disabled={loading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-full py-3 bg-gradient-to-r from-[#ce1126] to-[#d4af37] text-white font-black rounded-full hover:shadow-lg transition-all duration-300 disabled:opacity-50"
            >
              {loading ? '⏳ Verifying...' : '✓ Continue'}
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* Step 2: Password */}
      {step === 'password' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h3 className="text-2xl font-black text-[#ce1126] mb-2 text-center">
            🔑 Enter Master Password
          </h3>
          <p className="text-center text-sm text-gray-600 mb-6">
            Email: {email}
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-[#0d7e4d] mb-2">
                Master Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border-2 border-[#d4af37] rounded-lg focus:outline-none focus:border-[#ce1126] font-bold"
              />
              <p className="text-xs text-[#5a5a5a] mt-1">
                Minimum 8 characters
              </p>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded"
              >
                {error}
              </motion.div>
            )}

            <motion.button
              onClick={handlePasswordSubmit}
              disabled={loading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-full py-3 bg-gradient-to-r from-[#ce1126] to-[#d4af37] text-white font-black rounded-full hover:shadow-lg transition-all duration-300 disabled:opacity-50"
            >
              {loading ? '⏳ Verifying...' : '✓ Verify Password'}
            </motion.button>

            <button
              onClick={() => {
                setStep('email');
                setPassword('');
                setError('');
              }}
              className="w-full py-2 text-[#0d7e4d] font-bold hover:underline"
            >
              ← Back
            </button>
          </div>
        </motion.div>
      )}

      {/* Step 3: MFA */}
      {step === 'mfa' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h3 className="text-2xl font-black text-[#ce1126] mb-2 text-center">
            🔐 Two-Factor Authentication
          </h3>
          <p className="text-center text-sm text-gray-600 mb-6">
            Check your email or authenticator app
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-[#0d7e4d] mb-2">
                MFA Code (6 digits)
              </label>
              <input
                type="text"
                placeholder="000000"
                maxLength={6}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 border-2 border-[#d4af37] rounded-lg focus:outline-none focus:border-[#ce1126] font-bold text-3xl text-center tracking-widest"
              />
              <p className="text-xs text-[#5a5a5a] mt-2">
                Demo: Enter 000000
              </p>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded"
              >
                {error}
              </motion.div>
            )}

            <motion.button
              onClick={handleMFASubmit}
              disabled={loading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-full py-3 bg-gradient-to-r from-[#ce1126] to-[#d4af37] text-white font-black rounded-full hover:shadow-lg transition-all duration-300 disabled:opacity-50"
            >
              {loading ? '⏳ Verifying...' : '✓ Verify MFA'}
            </motion.button>

            <button
              onClick={() => {
                setStep('password');
                setMfaCode('');
                setError('');
              }}
              className="w-full py-2 text-[#0d7e4d] font-bold hover:underline"
            >
              ← Back
            </button>
          </div>
        </motion.div>
      )}

      {/* Step 4: Success */}
      {step === 'success' && adminData && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="text-5xl mb-4">👑</div>
          <h3 className="text-2xl font-black text-[#0d7e4d] mb-2">
            Welcome Back!
          </h3>
          <p className="text-gray-600 mb-6">
            {adminData.fullName}
          </p>

          <div className={`bg-gradient-to-r ${roleDisplay[adminData.role].color} rounded-lg p-4 mb-6 text-white`}>
            <p className="text-sm font-bold mb-2">
              {roleDisplay[adminData.role].icon} {roleDisplay[adminData.role].name}
            </p>
            <p className="text-xs">
              {adminData.email}
            </p>
          </div>

          <motion.button
            onClick={() => window.location.href = '/admin/dashboard'}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-full py-3 bg-gradient-to-r from-[#0d7e4d] to-[#d4af37] text-white font-black rounded-full hover:shadow-lg transition-all duration-300 mb-3"
          >
            📊 Go to Admin Dashboard
          </motion.button>

          <motion.button
            onClick={() => window.location.href = '/'}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-full py-2 border-2 border-[#0d7e4d] text-[#0d7e4d] font-bold rounded-full hover:bg-[#0d7e4d]/10 transition-all"
          >
            🏠 Go to Home
          </motion.button>
        </motion.div>
      )}
    </motion.div>
  );
}

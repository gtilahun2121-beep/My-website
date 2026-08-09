'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Language } from '@/i18n/config';
import { translations } from '@/i18n/translations';
import { equbCategories, EqubCategory } from '@/app/data/equbCategories';

interface RegistrationFormProps {
  lang: Language;
  onSuccess?: (title: string, message: string, duration?: number) => void;
  onError?: (title: string, message: string, duration?: number) => void;
}

type RegistrationStep = 'equb' | 'phone' | 'otp' | 'details' | 'success';

export default function RegistrationForm({ lang, onSuccess, onError }: RegistrationFormProps) {
  const t = translations[lang];
  const [step, setStep] = useState<RegistrationStep>('equb');
  const [selectedEqub, setSelectedEqub] = useState<EqubCategory | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [fullName, setFullName] = useState('');
  const [pin, setPin] = useState('');
  const [faydaNumber, setFaydaNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchEqub, setSearchEqub] = useState('');

  // Filter equbs by search
  const filteredEqubs = equbCategories.filter(equb =>
    equb.name.toLowerCase().includes(searchEqub.toLowerCase()) ||
    equb.profession.toLowerCase().includes(searchEqub.toLowerCase())
  );

  // Simulated OTP sending
  const handleSendOTP = async () => {
    setError('');
    if (!phoneNumber.match(/^\+?[1-9]\d{1,14}$/)) {
      setError('Invalid phone number format');
      onError?.('Invalid Number', 'Please enter a valid phone number with country code', 3000);
      return;
    }
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      console.log('OTP sent to:', phoneNumber);
      onSuccess?.('OTP Sent', `Verification code sent to ${phoneNumber}`, 4000);
      setLoading(false);
      setStep('otp');
    }, 1500);
  };

  // Simulated OTP verification
  const handleVerifyOTP = async () => {
    setError('');
    if (otp.length !== 6) {
      setError('OTP must be 6 digits');
      onError?.('Invalid OTP', 'OTP must be exactly 6 digits', 3000);
      return;
    }
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      console.log('OTP verified:', otp);
      onSuccess?.('OTP Verified', 'Phone number verified successfully', 3000);
      setLoading(false);
      setStep('details');
    }, 1500);
  };

  // Simulated registration completion
  const handleCompleteRegistration = async () => {
    setError('');
    if (!fullName.trim()) {
      setError('Full name is required');
      onError?.('Missing Name', 'Please enter your full name', 3000);
      return;
    }
    if (pin.length !== 4 || !/^\d+$/.test(pin)) {
      setError('PIN must be exactly 4 digits');
      onError?.('Invalid PIN', 'PIN must be exactly 4 digits', 3000);
      return;
    }
    if (!faydaNumber.trim()) {
      setError('Fayda number is required');
      onError?.('Missing Fayda Number', 'Please enter your Kebele ID', 3000);
      return;
    }

    setLoading(true);
    // Simulate API call - Save to localStorage for demo
    const userData = {
      phoneNumber,
      fullName,
      pin,
      faydaNumber,
      registeredAt: new Date().toISOString(),
    };
    localStorage.setItem(`qalnet_user_${phoneNumber}`, JSON.stringify(userData));
    
    setTimeout(() => {
      setLoading(false);
      onSuccess?.('✅ Account Created!', `Welcome to QalNet, ${fullName}! Your account is ready.`, 5000);
      setStep('success');
    }, 1500);
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  };

  return (
    <motion.div
      className="card-eth p-8 rounded-2xl"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Step 0: Equb Selection */}
      {step === 'equb' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h3 className="text-2xl font-black text-[#0d7e4d] mb-6 text-center">
            🏢 Choose Your Equb Group
          </h3>
          <p className="text-center text-sm text-gray-600 mb-4">
            Select the profession-based Equb that matches your income level
          </p>

          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search profession or income level..."
              value={searchEqub}
              onChange={(e) => setSearchEqub(e.target.value)}
              className="w-full px-4 py-3 border-2 border-[#d4af37] rounded-lg focus:outline-none focus:border-[#0d7e4d] font-bold"
            />
          </div>

          {/* Equb List */}
          <div className="space-y-3 max-h-72 overflow-y-auto mb-4">
            {filteredEqubs.map((equb) => (
              <motion.div
                key={equb.id}
                onClick={() => setSelectedEqub(equb)}
                whileHover={{ scale: 1.02 }}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedEqub?.id === equb.id
                    ? 'border-[#0d7e4d] bg-[#0d7e4d]/10'
                    : 'border-[#d4af37] bg-white hover:shadow-lg'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{equb.icon}</span>
                  <div className="flex-1">
                    <h4 className="font-black text-[#0d7e4d] text-sm">{equb.name}</h4>
                    <p className="text-xs text-gray-600 mb-2">{equb.description}</p>
                    <div className="flex gap-2 flex-wrap text-xs">
                      <span className="px-2 py-1 bg-[#0d7e4d]/10 text-[#0d7e4d] rounded font-bold">
                        ETB {equb.monthlyPayment}/mo
                      </span>
                      <span className={`px-2 py-1 rounded font-bold ${
                        equb.incomeLevel === 'low' ? 'bg-yellow-100 text-yellow-700' :
                        equb.incomeLevel === 'medium' ? 'bg-blue-100 text-blue-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {equb.incomeLevel.charAt(0).toUpperCase() + equb.incomeLevel.slice(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded mb-4"
            >
              {error}
            </motion.div>
          )}

          <motion.button
            onClick={() => {
              setError('');
              if (!selectedEqub) {
                setError('Please select an Equb group to continue');
                onError?.('No Selection', 'Please choose a profession-based Equb group', 3000);
                return;
              }
              setStep('phone');
              onSuccess?.('Equb Selected', `You selected ${selectedEqub.name}`, 3000);
            }}
            disabled={!selectedEqub}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-full py-3 bg-gradient-to-r from-[#0d7e4d] to-[#d4af37] text-white font-black rounded-full hover:shadow-lg transition-all duration-300 disabled:opacity-50"
          >
            ✓ Continue with Selected Equb
          </motion.button>
        </motion.div>
      )}

      {/* Step 1: Phone Number */}
      {step === 'phone' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h3 className="text-2xl font-black text-[#0d7e4d] mb-6 text-center">
            ✍️ Sign Up
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-[#0d7e4d] mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                placeholder="+251911223344"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-4 py-3 border-2 border-[#d4af37] rounded-lg focus:outline-none focus:border-[#0d7e4d] font-bold text-lg"
              />
              <p className="text-xs text-[#5a5a5a] mt-1">
                Include country code (e.g., +251 for Ethiopia)
              </p>
            </div>

            {error && (
              <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded">
                {error}
              </div>
            )}

            <motion.button
              onClick={handleSendOTP}
              disabled={loading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-full py-3 bg-gradient-to-r from-[#0d7e4d] to-[#d4af37] text-white font-black rounded-full hover:shadow-lg transition-all duration-300 disabled:opacity-50"
            >
              {loading ? '⏳ Sending OTP...' : '✓ Send OTP Code'}
            </motion.button>

            <button
              onClick={() => {
                setStep('equb');
                setError('');
              }}
              className="w-full py-2 text-[#0d7e4d] font-bold hover:underline mt-2"
            >
              ← Change Equb Group
            </button>
          </div>
        </motion.div>
      )}

      {/* Step 2: OTP Verification */}
      {step === 'otp' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h3 className="text-2xl font-black text-[#0d7e4d] mb-6 text-center">
            🔐 Enter OTP Code
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-[#0d7e4d] mb-2">
                6-Digit OTP Code
              </label>
              <input
                type="text"
                placeholder="000000"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 border-2 border-[#d4af37] rounded-lg focus:outline-none focus:border-[#0d7e4d] font-bold text-3xl text-center tracking-widest"
              />
              <p className="text-xs text-[#5a5a5a] mt-1 text-center">
                Check your SMS for the code (usually arrives in seconds)
              </p>
            </div>

            {error && (
              <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded">
                {error}
              </div>
            )}

            <motion.button
              onClick={handleVerifyOTP}
              disabled={loading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-full py-3 bg-gradient-to-r from-[#0d7e4d] to-[#d4af37] text-white font-black rounded-full hover:shadow-lg transition-all duration-300 disabled:opacity-50"
            >
              {loading ? '⏳ Verifying...' : '✓ Verify OTP'}
            </motion.button>

            <button
              onClick={() => {
                setStep('phone');
                setError('');
              }}
              className="w-full py-2 text-[#0d7e4d] font-bold hover:underline"
            >
              ← Back
            </button>
          </div>
        </motion.div>
      )}

      {/* Step 3: User Details */}
      {step === 'details' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h3 className="text-2xl font-black text-[#0d7e4d] mb-6 text-center">
            ✍️ Complete Your Profile
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-[#0d7e4d] mb-2">
                Full Name (as per ID)
              </label>
              <input
                type="text"
                placeholder="Aisha Mohammed"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 border-2 border-[#d4af37] rounded-lg focus:outline-none focus:border-[#0d7e4d] font-bold"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-[#0d7e4d] mb-2">
                4-Digit Security PIN
              </label>
              <input
                type="password"
                placeholder="••••"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 border-2 border-[#d4af37] rounded-lg focus:outline-none focus:border-[#0d7e4d] font-bold text-2xl text-center tracking-widest"
              />
              <p className="text-xs text-[#5a5a5a] mt-1">
                Remember this PIN - you'll use it to login
              </p>
            </div>

            <div>
              <label className="block text-sm font-bold text-[#0d7e4d] mb-2">
                Fayda Number (Kebele ID)
              </label>
              <input
                type="text"
                placeholder="12345678"
                value={faydaNumber}
                onChange={(e) => setFaydaNumber(e.target.value)}
                className="w-full px-4 py-3 border-2 border-[#d4af37] rounded-lg focus:outline-none focus:border-[#0d7e4d] font-bold"
              />
              <p className="text-xs text-[#5a5a5a] mt-1">
                Your Kebele ID for verification
              </p>
            </div>

            {error && (
              <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded">
                {error}
              </div>
            )}

            <motion.button
              onClick={handleCompleteRegistration}
              disabled={loading}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-full py-3 bg-gradient-to-r from-[#ce1126] to-[#d4af37] text-white font-black rounded-full hover:shadow-lg transition-all duration-300 disabled:opacity-50"
            >
              {loading ? '⏳ Creating Account...' : '🎉 Complete Registration'}
            </motion.button>

            <button
              onClick={() => {
                setStep('otp');
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
      {step === 'success' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="text-6xl mb-6 animate-bounce">🎉</div>
          <h3 className="text-2xl font-black text-[#0d7e4d] mb-4">
            Registration Successful!
          </h3>
          <p className="text-gray-600 mb-6">
            Welcome to QalNet, {fullName}! Your account has been created successfully.
          </p>

          <div className="bg-[#d4af37]/20 border-2 border-[#d4af37] rounded-lg p-4 mb-6 text-left">
            <p className="text-sm font-bold text-[#0d7e4d] mb-2">✓ Account Details:</p>
            <p className="text-xs text-gray-600">
              📱 Phone: {phoneNumber}
            </p>
            <p className="text-xs text-gray-600">
              👤 Name: {fullName}
            </p>
            <p className="text-xs text-gray-600">
              🎫 Fayda: {faydaNumber}
            </p>
            {selectedEqub && (
              <>
                <p className="text-xs text-gray-600 mt-2 pt-2 border-t border-[#d4af37]">
                  🏢 Equb: {selectedEqub.name}
                </p>
                <p className="text-xs text-gray-600">
                  💵 Monthly: ETB {selectedEqub.monthlyPayment}
                </p>
              </>
            )}
          </div>

          <motion.button
            onClick={() => window.location.href = '/'}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-full py-3 bg-gradient-to-r from-[#0d7e4d] to-[#d4af37] text-white font-black rounded-full hover:shadow-lg transition-all duration-300"
          >
            🏠 Go to Home
          </motion.button>
        </motion.div>
      )}
    </motion.div>
  );
}

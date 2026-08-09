'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Language, defaultLanguage } from '@/i18n/config';
import { translations } from '@/i18n/translations';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import FormInput from '@/app/components/forms/FormInput';
import FormButton from '@/app/components/forms/FormButton';
import FormError from '@/app/components/forms/FormError';

export default function CompleteProfilePage() {
  const router = useRouter();
  const [lang, setLang] = useState<Language>(defaultLanguage);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    profession: '',
    fayda: '',
    guarantor: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const t = translations[lang];

  const professions = [
    'Diaspora & Overseas Community',
    'Teachers & Academic Staff',
    'Taxi & Minibus Drivers',
    'Civil Servants & Government Workers',
    'Market Vendors & Retailers',
    'Wholesale Merchants & Importers',
    'Tech & Digital Freelancers',
  ];

  const handleFieldChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) newErrors.firstName = 'First name required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name required';
    if (!formData.phoneNumber.trim()) newErrors.phoneNumber = 'Phone required';
    if (!formData.profession) newErrors.profession = 'Profession required';
    if (!formData.fayda.trim()) newErrors.fayda = 'Fayda ID required';
    if (!formData.guarantor.trim()) newErrors.guarantor = 'Guarantor required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      // Simulate API call to save profile
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      // Redirect to dashboard after profile completion
      router.push('/dashboard');
    } catch (error) {
      console.error('Profile completion failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex flex-col">
      <Header
        lang={lang}
        onLanguageChange={setLang}
        isAuthenticated={true}
      />

      <div className="flex-grow py-12 px-4">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-lg p-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            {lang === 'en' ? 'Complete Your Profile' : lang === 'am' ? 'የእርስዎን መገለጫ ያጠናቅቁ' : 'Madaallii Kee Guuti'}
          </h1>
          <p className="text-gray-600 mb-6">
            {lang === 'en'
              ? 'Please fill in your information to continue'
              : lang === 'am'
              ? 'ይህን ቅጥ ለማካሄድ እንዲሁም መረጃዎን ይሙሉ'
              : 'Odeeffannoo kee guutiif barreessaa'}
          </p>

          <form className="space-y-4">
            {/* First Name */}
            <FormInput
              label={lang === 'en' ? 'First Name' : lang === 'am' ? 'መጀመሪያ ስም' : 'Maqaa Jalqabaa'}
              type="text"
              value={formData.firstName}
              onChange={(value) => handleFieldChange('firstName', value)}
              placeholder="John"
              error={errors.firstName}
            />

            {/* Last Name */}
            <FormInput
              label={lang === 'en' ? 'Last Name' : lang === 'am' ? 'ስም' : 'Maqaa Dhumaa'}
              type="text"
              value={formData.lastName}
              onChange={(value) => handleFieldChange('lastName', value)}
              placeholder="Doe"
              error={errors.lastName}
            />

            {/* Phone Number */}
            <FormInput
              label={lang === 'en' ? 'Phone Number' : lang === 'am' ? 'ስልክ ቁጥር' : 'Lakkoofsa Bilbilaa'}
              type="tel"
              value={formData.phoneNumber}
              onChange={(value) => handleFieldChange('phoneNumber', value)}
              placeholder="+251 9XX XXX XXXX"
              error={errors.phoneNumber}
            />

            {/* Profession */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                {lang === 'en'
                  ? 'Select Profession / Income Category *'
                  : lang === 'am'
                  ? 'ሙያ / ገቢ ምድብ ይምረጡ *'
                  : 'Hojii / Gadaan Filadhu *'}
              </label>
              <select
                value={formData.profession}
                onChange={(e) => handleFieldChange('profession', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0d7e4d]"
              >
                <option value="">
                  {lang === 'en' ? '-- Choose a category --' : '-- Filadhu --'}
                </option>
                {professions.map((prof) => (
                  <option key={prof} value={prof}>
                    {prof}
                  </option>
                ))}
              </select>
              {errors.profession && <FormError message={errors.profession} />}
            </div>

            {/* Fayda ID */}
            <FormInput
              label={lang === 'en' ? 'Fayda ID' : 'Fayda ID'}
              type="text"
              value={formData.fayda}
              onChange={(value) => handleFieldChange('fayda', value)}
              placeholder="XXXX-XXXX-XXXX"
              error={errors.fayda}
            />

            {/* Guarantor Name */}
            <FormInput
              label={lang === 'en' ? 'Guarantor Name' : lang === 'am' ? 'አምነ-ውሉ ስም' : 'Maqaa Hordofa'}
              type="text"
              value={formData.guarantor}
              onChange={(value) => handleFieldChange('guarantor', value)}
              placeholder="Full name"
              error={errors.guarantor}
            />

            {/* Submit Button */}
            <FormButton
              onClick={handleSubmit}
              loading={isLoading}
              disabled={isLoading}
              variant="primary"
            >
              {isLoading
                ? '⏳ Saving...'
                : lang === 'en'
                ? 'Complete Profile'
                : lang === 'am'
                ? 'መገለጫ ያጠናቅቁ'
                : 'Madaallii Guuti'}
            </FormButton>
          </form>
        </div>
      </div>

      <Footer lang={lang} />
    </main>
  );
}

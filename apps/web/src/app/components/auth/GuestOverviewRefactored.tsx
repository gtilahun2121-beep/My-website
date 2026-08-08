'use client';

import { motion } from 'framer-motion';
import { Language } from '@/i18n/config';
import { translations } from '@/i18n/translations';
import { equbCategories, getEqubByIncomeLevel, getTotalMembers, EqubCategory } from '@/app/data/equbCategories';
import { useState } from 'react';
import EqubCategoryCard from './components/EqubCategoryCard';
import EqubDetailModal from './components/EqubDetailModal';
import GuestFeatureGrid from './components/GuestFeatureGrid';
import IncomeFilterButtons from './components/IncomeFilterButtons';
import GuestStatsSection from './components/GuestStatsSection';

interface GuestOverviewRefactoredProps {
  lang?: Language;
  onJoinClick?: () => void;
  onSignInClick?: () => void;
}

type IncomeLevel = 'all' | 'low' | 'medium' | 'high';

/**
 * Refactored Guest Overview Component
 * Professional information architecture with proper component composition
 */
export default function GuestOverviewRefactored({ lang = 'en', onJoinClick, onSignInClick }: GuestOverviewRefactoredProps) {
  const t = translations[lang];
  const [selectedIncome, setSelectedIncome] = useState<IncomeLevel>('all');
  const [selectedEqub, setSelectedEqub] = useState<EqubCategory | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Filter equbs by income level
  const displayedEqubs = selectedIncome === 'all' 
    ? equbCategories 
    : getEqubByIncomeLevel(selectedIncome as 'low' | 'medium' | 'high');

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, staggerChildren: 0.1 },
    },
  };

  const handleViewEqub = (equb: EqubCategory) => {
    setSelectedEqub(equb);
    setShowModal(true);
  };

  const handleJoinEqub = (equb: EqubCategory) => {
    localStorage.setItem('selectedEqubId', equb.id);
    onJoinClick?.();
    setShowModal(false);
  };

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Hero Section */}
      <motion.div
        variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
        className="bg-gradient-to-r from-[#0d7e4d] to-[#d4af37] rounded-2xl p-6 text-white"
      >
        <h2 className="text-2xl font-black mb-3">👋 Welcome to QalNet!</h2>
        <p className="text-sm leading-relaxed">
          Discover profession-based Equb groups designed for your income level. Save together, grow together.
        </p>
      </motion.div>

      {/* Features Grid */}
      <GuestFeatureGrid />

      {/* Filter Section */}
      <IncomeFilterButtons 
        selectedIncome={selectedIncome} 
        onSelect={setSelectedIncome} 
      />

      {/* Equb Categories Section */}
      <motion.div
        variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
        className="space-y-3"
      >
        <h3 className="font-black text-[#0d7e4d] text-lg">
          🏢 Available Equb Groups ({displayedEqubs.length})
        </h3>
        <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto">
          {displayedEqubs.map((equb) => (
            <EqubCategoryCard
              key={equb.id}
              equb={equb}
              onView={() => handleViewEqub(equb)}
            />
          ))}
        </div>
      </motion.div>

      {/* Stats Section */}
      <GuestStatsSection />

      {/* CTA */}
      <motion.div
        variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
        className="space-y-3"
      >
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onJoinClick}
          className="w-full py-3 bg-gradient-to-r from-[#0d7e4d] to-[#d4af37] text-white font-black rounded-full hover:shadow-lg transition-all duration-300"
        >
          🚀 Start Your Equb Journey
        </motion.button>
      </motion.div>

      {/* Modal */}
      {showModal && selectedEqub && (
        <EqubDetailModal
          equb={selectedEqub}
          onClose={() => setShowModal(false)}
          onJoin={() => handleJoinEqub(selectedEqub)}
        />
      )}
    </motion.div>
  );
}

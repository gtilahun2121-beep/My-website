'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Language } from '@/i18n/config';
import { translations } from '@/i18n/translations';
import api from '@/app/services/api';

export interface PresetTemplate {
  id: string;
  name: string;
  description: string | null;
  contribution_amount: number;
  total_rounds: number;
  cycle_days: number;
  cycle_type: 'round' | 'daily' | 'weekly';
  winner_selection: 'lottery' | 'fcfs' | 'auction';
  equb_type: 'public' | 'private' | 'corporate';
  is_featured: boolean;
  display_order: number;
}

interface PresetTemplatesProps {
  lang: Language;
  onSelectTemplate?: (template: PresetTemplate) => void;
}

export default function PresetTemplates({ lang, onSelectTemplate }: PresetTemplatesProps) {
  const [templates, setTemplates] = useState<PresetTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const t = translations[lang];

  useEffect(() => {
    fetchPresets();
  }, []);

  const fetchPresets = async () => {
    try {
      setLoading(true);
      const data = await api.equbAPI.getPresets();
      setTemplates(data || []);
    } catch (err) {
      console.error('Failed to fetch presets:', err);
      setError(err instanceof Error ? err.message : 'Failed to load presets');
    } finally {
      setLoading(false);
    }
  };

  const getTypeLabel = (type: string): string => {
    const labels: Record<string, Record<Language, string>> = {
      'daily': { en: 'Daily', am: 'ዋጋ ብዙ', om: 'Guyyaa', ti: 'ራ' },
      'weekly': { en: 'Weekly', am: 'ሳምንታዊ', om: 'Jidhaatti', ti: 'ሳዓት' },
      'round': { en: 'Monthly', am: 'ወርሃዊ', om: 'Jidhaa', ti: 'ወርሒ' },
    };
    return labels[type]?.[lang] || type;
  };

  const getSelectionLabel = (type: string): string => {
    const labels: Record<string, Record<Language, string>> = {
      'lottery': { en: '🎰 Lottery', am: '🎰 ሎተሪ', om: '🎰 Jidhaatti', ti: '🎰 ስልክ' },
      'fcfs': { en: '⏱️ First Come First Serve', am: '⏱️ ቀደምይ ውግድ', om: '⏱️ Jalqaba', ti: '⏱️ መሳሪያ' },
      'auction': { en: '💰 Auction/Bidding', am: '💰 ምርቃት', om: '💰 Dhabaas', ti: '💰 ሸይጢ' },
    };
    return labels[type]?.[lang] || type;
  };

  const getTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      'lottery': 'bg-blue-100 border-blue-300 text-blue-700',
      'fcfs': 'bg-amber-100 border-amber-300 text-amber-700',
      'auction': 'bg-purple-100 border-purple-300 text-purple-700',
    };
    return colors[type] || 'bg-gray-100 border-gray-300 text-gray-700';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-[#0066ff] border-t-transparent rounded-full animate-spin mb-2"></div>
          <p className="text-sm text-gray-600">
            {lang === 'en' ? 'Loading templates...' : 'ቴምፕሌቶች እየተጫኑ...'}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
        {error}
      </div>
    );
  }

  if (templates.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <h3 className="text-lg font-bold text-[#0066ff] mb-4">
        {lang === 'en' ? '⚡ Quick Start - Popular Templates' : '⚡ ፈጣን ጅምር - ታዋቂ ቴምፕሌቶች'}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template, idx) => (
          <motion.div
            key={template.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            onClick={() => onSelectTemplate?.(template)}
            className="cursor-pointer group"
          >
            <div className="bg-white border-2 border-gray-200 rounded-lg p-4 transition-all duration-300 group-hover:border-[#0066ff] group-hover:shadow-lg">
              {/* Header */}
              <div className="mb-3">
                <h4 className="font-bold text-gray-900 mb-1">{template.name}</h4>
                {template.description && (
                  <p className="text-xs text-gray-600 line-clamp-2">{template.description}</p>
                )}
              </div>

              {/* Main Stats */}
              <div className="bg-gradient-to-r from-[#ffffff]/10 to-[#0066ff]/10 rounded-lg p-3 mb-3">
                <div className="text-2xl font-black text-[#0066ff] mb-1">
                  {template.contribution_amount.toLocaleString()} ETB
                </div>
                <div className="text-xs text-gray-600">
                  {lang === 'en' ? 'per contribution' : 'በእያንዳንዱ አስተዋጽኦ'}
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-gray-50 rounded p-2">
                  <div className="text-xs text-gray-600">
                    {lang === 'en' ? 'Rounds' : 'ወተወራ'}
                  </div>
                  <div className="font-bold text-sm text-gray-900">
                    {template.total_rounds}
                  </div>
                </div>
                <div className="bg-gray-50 rounded p-2">
                  <div className="text-xs text-gray-600">
                    {lang === 'en' ? 'Total' : 'ጠቅላላ'}
                  </div>
                  <div className="font-bold text-sm text-gray-900">
                    {(template.contribution_amount * template.total_rounds).toLocaleString()} ETB
                  </div>
                </div>
              </div>

              {/* Type Tags */}
              <div className="space-y-2 text-xs">
                <div className={`border rounded px-2 py-1 text-center font-semibold ${getTypeColor(template.winner_selection)}`}>
                  {getSelectionLabel(template.winner_selection)}
                </div>
                <div className="flex gap-2 text-xs">
                  <span className="bg-[#0066ff]/10 text-[#0066ff] rounded px-2 py-1 font-semibold">
                    {getTypeLabel(template.cycle_type)}
                  </span>
                  <span className="bg-gray-200 text-gray-700 rounded px-2 py-1 font-semibold capitalize">
                    {template.equb_type}
                  </span>
                </div>
              </div>

              {/* CTA */}
              <button className="w-full mt-3 bg-[#0066ff] text-white font-bold py-2 rounded-lg group-hover:shadow-lg transition-all duration-300">
                {lang === 'en' ? 'Use This Template' : 'ይህን ቴምፕሌት ተጠቀም'}
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

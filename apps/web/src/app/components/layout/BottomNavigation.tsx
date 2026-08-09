// ========================================================================
// BOTTOM NAVIGATION COMPONENT
// Primary Action Grid for Mobile-First Access
// ========================================================================

'use client';

import React, { useState } from 'react';
import { translations } from '../../data';

interface BottomNavProps {
  activeTab: 'my_equbs' | 'discover' | 'calendar' | 'wallet' | 'more';
  onTabChange: (tab: string) => void;
  language: 'en' | 'am' | 'om' | 'ti';
  notificationCount?: number;
}

export const BottomNavigation: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  language,
  notificationCount = 0,
}) => {
  const navItems = [
    { id: 'my_equbs', icon: '📊', label: translations.my_equbs[language] },
    { id: 'discover', icon: '🔍', label: translations.discover[language] },
    { id: 'calendar', icon: '📅', label: translations.calendar[language] },
    { id: 'wallet', icon: '💰', label: translations.wallet[language] },
    { id: 'more', icon: '⋯', label: translations.more[language] },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center h-20 md:hidden">
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => onTabChange(item.id)}
          className={`flex flex-col items-center justify-center w-full h-full transition-colors ${
            activeTab === item.id
              ? 'text-emerald-600 bg-emerald-50'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
          aria-label={item.label}
          aria-current={activeTab === item.id ? 'page' : undefined}
        >
          <span className="text-2xl">{item.icon}</span>
          <span className="text-xs mt-1 line-clamp-1">{item.label}</span>
          {item.id === 'more' && notificationCount > 0 && (
            <span className="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {notificationCount}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
};

export default BottomNavigation;

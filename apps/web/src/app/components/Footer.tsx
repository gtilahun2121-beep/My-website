'use client';

import Link from 'next/link';
import { Language } from '@/i18n/config';
import { translations } from '@/i18n/translations';
import { Mail, Phone, MapPin, Code2, Share2, Share, Send } from 'lucide-react';

interface FooterProps {
  lang: Language;
}

export default function Footer({ lang }: FooterProps) {
  const t = translations[lang];

  return (
    <footer className="bg-white text-[#0066ff] border-t border-gray-300 py-2.5">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-2">
          <div className="col-span-2 md:col-span-1 min-w-0">
            <div className="flex items-center gap-1 mb-1">
              <div className="w-4 h-4 bg-gradient-to-br from-[#0066ff] to-brand-500 rounded-md flex items-center justify-center">
                <span className="text-white font-bold text-[8px]">Q</span>
              </div>
              <span className="font-bold text-[10px]">QalNet</span>
            </div>
            <p className="text-gray-500 text-[8px] leading-tight">{t.madeWith}</p>
          </div>

          <div className="min-w-0">
            <h3 className="font-semibold text-[8px] uppercase tracking-[0.08em] mb-1 text-gray-500">{t.documentation}</h3>
            <ul className="space-y-0.5 text-[8px]">
              <li>
                <Link href="/docs" className="block text-gray-600 hover:text-[#0066ff] transition-colors">
                  {t.docs}
                </Link>
              </li>
              <li>
                <Link href="/architecture" className="block text-gray-600 hover:text-[#0066ff] transition-colors">
                  {t.architecture}
                </Link>
              </li>
              <li>
                <Link href="/roadmap" className="block text-gray-600 hover:text-[#0066ff] transition-colors">
                  {t.roadmap}
                </Link>
              </li>
            </ul>
          </div>

          <div className="min-w-0">
            <h3 className="font-semibold text-[8px] uppercase tracking-[0.08em] mb-1 text-gray-500">{t.security}</h3>
            <ul className="space-y-0.5 text-[8px]">
              <li>
                <Link href="/security" className="block text-gray-600 hover:text-[#0066ff] transition-colors">
                  {t.security}
                </Link>
              </li>
              <li>
                <Link href="/accessibility" className="block text-gray-600 hover:text-[#0066ff] transition-colors">
                  {t.accessibility}
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="block text-gray-600 hover:text-[#0066ff] transition-colors">
                  {t.privacyPolicy}
                </Link>
              </li>
            </ul>
          </div>

          <div className="min-w-0">
            <h3 className="font-semibold text-[8px] uppercase tracking-[0.08em] mb-1 text-gray-500">{t.support}</h3>
            <ul className="space-y-0.5 text-[8px]">
              <li>
                <Link href="/faq" className="block text-gray-600 hover:text-[#0066ff] transition-colors">
                  {t.faq}
                </Link>
              </li>
              <li>
                <Link href="/contact" className="block text-gray-600 hover:text-[#0066ff] transition-colors">
                  {t.contactUs}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-2 mb-2">
          <h3 className="font-semibold text-[8px] uppercase tracking-[0.08em] mb-1.5 text-gray-500">{lang === 'en' ? 'Features' : 'ባህሪያት'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <h4 className="font-semibold text-[9px] mb-1 text-[#0066ff]">{lang === 'en' ? 'Connect With Us' : 'ከእኛ ጋር ተገናኙ'}</h4>
              <div className="flex gap-1.5 flex-wrap">
                <a href="https://twitter.com/qalnet" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-600 hover:bg-[#0066ff] hover:text-white transition-all" aria-label="Twitter" title="Twitter Icon - Links to https://twitter.com/qalnet">
                  <Share2 size={11} />
                </a>
                <a href="https://github.com/qalnet" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-600 hover:bg-[#0066ff] hover:text-white transition-all" aria-label="GitHub" title="GitHub Icon - Links to https://github.com/qalnet">
                  <Code2 size={11} />
                </a>
                <a href="https://linkedin.com/company/qalnet" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-600 hover:bg-[#0066ff] hover:text-white transition-all" aria-label="LinkedIn" title="LinkedIn Icon - Links to https://linkedin.com/company/qalnet">
                  <Share size={11} />
                </a>
                <a href="https://telegram.me/qalnet" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-600 hover:bg-[#0066ff] hover:text-white transition-all" aria-label="Telegram" title="Telegram Icon - Links to https://telegram.me/qalnet">
                  <Send size={11} />
                </a>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-[9px] mb-1 text-[#0066ff]">{lang === 'en' ? 'Get in Touch' : 'ዋጋ ይድረሱ'}</h4>
              <div className="space-y-0.5">
                <div className="flex items-center gap-1 text-gray-600 hover:text-[#0066ff] transition-colors">
                  <Mail size={10} className="text-[#0066ff] flex-shrink-0" />
                  <a href="mailto:support@qalnet.com" className="text-[8px]">support@qalnet.com</a>
                </div>
                <div className="flex items-center gap-1 text-gray-600 hover:text-[#0066ff] transition-colors">
                  <Phone size={10} className="text-[#0066ff] flex-shrink-0" />
                  <a href="tel:+251900000000" className="text-[8px]">+251 (0) 900 000 000</a>
                </div>
                <div className="flex items-center gap-1 text-gray-600">
                  <MapPin size={10} className="text-[#0066ff] flex-shrink-0" />
                  <span className="text-[8px]">Addis Ababa, Ethiopia</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-1.5">
          <p className="text-gray-400 text-[7px]">{t.copyright}</p>
        </div>
      </div>
    </footer>
  );
}



'use client';

import Link from 'next/link';
import { Language } from '@/i18n/config';
import { translations } from '@/i18n/translations';

interface FooterProps {
  lang: Language;
}

export default function Footer({ lang }: FooterProps) {
  const t = translations[lang];

  return (
    <footer className="bg-white text-[#00d9ff] border-t border-gray-300 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-brand-900 to-brand-500 rounded-lg flex items-center justify-center">
                <span className="text-[#00d9ff] font-bold text-sm">Q</span>
              </div>
              <span className="font-bold text-lg">QalNet</span>
            </div>
            <p className="text-gray-400 text-sm">{t.madeWith}</p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold mb-4">{t.documentation}</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/docs" className="text-gray-500 hover:text-[#00d9ff] transition-colors">
                  {t.docs}
                </Link>
              </li>
              <li>
                <Link href="/architecture" className="text-gray-500 hover:text-[#00d9ff] transition-colors">
                  {t.architecture}
                </Link>
              </li>
              <li>
                <Link href="/roadmap" className="text-gray-500 hover:text-[#00d9ff] transition-colors">
                  {t.roadmap}
                </Link>
              </li>
            </ul>
          </div>

          {/* Security & Compliance */}
          <div>
            <h3 className="font-semibold mb-4">{t.security}</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/security" className="text-gray-500 hover:text-[#00d9ff] transition-colors">
                  {t.security}
                </Link>
              </li>
              <li>
                <Link href="/accessibility" className="text-gray-500 hover:text-[#00d9ff] transition-colors">
                  {t.accessibility}
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-gray-500 hover:text-[#00d9ff] transition-colors">
                  {t.privacyPolicy}
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-semibold mb-4">{t.support}</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/faq" className="text-gray-500 hover:text-[#00d9ff] transition-colors">
                  {t.faq}
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-gray-500 hover:text-[#00d9ff] transition-colors">
                  {t.contactUs}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-200 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-400 text-sm">{t.copyright}</p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <a href="#" className="text-gray-500 hover:text-[#00d9ff] transition-colors">
              Twitter
            </a>
            <a href="#" className="text-gray-500 hover:text-[#00d9ff] transition-colors">
              GitHub
            </a>
            <a href="#" className="text-gray-500 hover:text-[#00d9ff] transition-colors">
              LinkedIn
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}


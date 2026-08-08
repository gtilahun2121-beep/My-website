'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

interface PromoBannerProps {
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  features: string[];
}

export default function PromoBanner({
  title,
  subtitle,
  ctaText,
  ctaLink,
  features,
}: PromoBannerProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -30 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.6 },
    },
  };

  return (
    <section className="py-20 md:py-32 bg-gradient-to-r from-[#ce1126] via-[#0d7e4d] to-[#d4af37] relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 pattern-eth opacity-20"></div>

      {/* Floating decorative elements */}
      <motion.div
        className="absolute top-10 right-10 text-6xl opacity-20"
        animate={{ y: [0, 20, 0] }}
        transition={{ duration: 4, repeat: Infinity }}
      >
        🇪🇹
      </motion.div>

      <motion.div
        className="absolute bottom-10 left-10 text-6xl opacity-20"
        animate={{ y: [0, -20, 0] }}
        transition={{ duration: 4, repeat: Infinity, delay: 0.5 }}
      >
        💰
      </motion.div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-black text-white mb-6 drop-shadow-lg">
              {title}
            </h2>
            <p className="text-xl text-white/90 mb-8 drop-shadow-md font-semibold">
              {subtitle}
            </p>

            {/* Features List */}
            <motion.div
              className="space-y-4 mb-10"
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              {features.map((feature, idx) => (
                <motion.div
                  key={idx}
                  className="flex items-start gap-4"
                  variants={itemVariants}
                >
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-white/20 border-2 border-white">
                      <span className="text-white font-black">✓</span>
                    </div>
                  </div>
                  <p className="text-lg text-white font-semibold">{feature}</p>
                </motion.div>
              ))}
            </motion.div>

            {/* CTA Button */}
            <motion.div
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link
                href={ctaLink}
                className="inline-block px-10 py-4 bg-white text-[#0d7e4d] font-black rounded-full hover:shadow-2xl transition-all duration-300 text-lg drop-shadow-lg"
              >
                {ctaText} →
              </Link>
            </motion.div>
          </motion.div>

          {/* Right Visual */}
          <motion.div
            className="relative h-96"
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
          >
            {/* Card stack effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-br from-white/20 to-white/5 rounded-3xl border-2 border-white/30 backdrop-blur-sm p-8"
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <div className="text-center h-full flex flex-col items-center justify-center">
                <div className="text-7xl mb-4">💳</div>
                <p className="text-white font-black text-xl mb-2">100% Secure</p>
                <p className="text-white/80 font-semibold">Bank-Level Encryption</p>
              </div>
            </motion.div>

            {/* Floating badges */}
            {[
              { emoji: '🏦', text: 'Verified', top: '5%', left: '10%' },
              { emoji: '✅', text: '99% Uptime', top: '60%', right: '10%' },
              { emoji: '🔒', text: 'Secure', bottom: '10%', left: '5%' },
            ].map((badge, idx) => (
              <motion.div
                key={idx}
                className="absolute bg-white/90 rounded-full px-4 py-2 shadow-lg border-2 border-white flex items-center gap-2 font-black text-[#0d7e4d]"
                style={{
                  top: badge.top,
                  bottom: badge.bottom,
                  left: badge.left,
                  right: badge.right,
                }}
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity, delay: idx * 0.3 }}
              >
                <span className="text-lg">{badge.emoji}</span>
                <span className="text-xs">{badge.text}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

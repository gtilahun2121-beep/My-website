'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

interface HeroAnimationProps {
  heroTitle: string;
  heroSubtitle: string;
  heroDescription: string;
  cta: string;
  ctaSecondary: string;
}

export default function HeroAnimation({
  heroTitle,
  heroSubtitle,
  heroDescription,
  cta,
  ctaSecondary,
}: HeroAnimationProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: [0.34, 1.56, 0.64, 1] as any },
    },
  };

  const buttonVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.6, ease: [0.34, 1.56, 0.64, 1] as any },
    },
    hover: {
      scale: 1.08,
      transition: { duration: 0.3 },
    },
    tap: { scale: 0.95 },
  };

  const pulseVariants = {
    pulse: {
      scale: [1, 1.05, 1],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: [0.25, 0.46, 0.45, 0.94] as any,
      },
    },
  };

  const floatingShapes = [
    { delay: 0, x: -80, y: -60, size: 60 },
    { delay: 0.2, x: 100, y: 80, size: 40 },
    { delay: 0.4, x: -40, y: 120, size: 50 },
  ];

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#0d7e4d] via-[#d4af37] to-[#ce1126] py-20 md:py-32">
      {/* Floating background shapes */}
      <div className="absolute inset-0 overflow-hidden">
        {floatingShapes.map((shape, idx) => (
          <motion.div
            key={idx}
            className="absolute rounded-full opacity-10 bg-white"
            style={{
              width: shape.size,
              height: shape.size,
              left: `${50 + shape.x}%`,
              top: `${50 + shape.y}%`,
            }}
            animate={{
              y: [0, 30, 0],
              x: [0, 20, 0],
            }}
            transition={{
              duration: 6 + shape.delay * 2,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: shape.delay,
            }}
          />
        ))}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          className="text-center max-w-3xl mx-auto"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Ethiopian Flag Emoji */}
          <motion.div
            className="mb-6 inline-block"
            variants={itemVariants}
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <div className="text-7xl drop-shadow-lg">🇪🇹</div>
          </motion.div>

          {/* Main Headline */}
          <motion.h1
            className="text-5xl md:text-7xl font-black text-white mb-6 drop-shadow-lg glow-eth-gold"
            variants={itemVariants}
          >
            {heroTitle}
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            className="text-2xl text-white mb-4 font-bold drop-shadow-md"
            variants={itemVariants}
          >
            {heroSubtitle}
          </motion.p>

          {/* Description */}
          <motion.p
            className="text-lg text-white/90 mb-10 drop-shadow-md"
            variants={itemVariants}
          >
            {heroDescription}
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center"
            variants={itemVariants}
          >
            <motion.div
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
            >
              <Link
                href="/features"
                className="inline-block px-8 py-4 bg-white text-[#0d7e4d] font-bold rounded-full hover:shadow-2xl transition-all duration-300 text-lg"
              >
                {cta} ➜
              </Link>
            </motion.div>

            {/* Pulse button */}
            <motion.div
              variants={pulseVariants}
              animate="pulse"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
            >
              <Link
                href="/architecture"
                className="inline-block px-8 py-4 bg-[#d4af37] text-[#0d7e4d] font-bold rounded-full border-2 border-white hover:shadow-2xl transition-all duration-300 text-lg"
              >
                {ctaSecondary} 🏗️
              </Link>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

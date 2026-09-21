'use client';

import { motion, useInView } from 'framer-motion';
import { useEffect, useRef, useState, type CSSProperties } from 'react';

interface EqubRotationProps {
  title: string;
  description: string;
  memberCount?: number;
}

export default function EqubRotation({
  title,
  description,
  memberCount = 8,
}: EqubRotationProps) {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, margin: '-100px' });

  // Scale the member orbit radius to fit small viewports (circle is min(24rem, 80vw)).
  const [radius, setRadius] = useState(120);

  useEffect(() => {
    const update = () => {
      const box = Math.min(384, window.innerWidth * 0.8);
      setRadius(Math.max(88, Math.min(120, box / 2 - 40)));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Generate circle positions for members
  const members = Array.from({ length: memberCount }, (_, i) => {
    const angle = (i / memberCount) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    return { x, y, angle };
  });

  const rotatingLineVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.6 },
    },
  };

  const memberVariants = {
    hidden: { opacity: 0, scale: 0 },
    visible: (idx: number) => ({
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.5,
        delay: idx * 0.08,
      },
    }),
  };

  const glowVariants = {
    hidden: { opacity: 0 },
    visible: (idx: number) => ({
      opacity: [0, 1, 0],
      transition: {
        duration: 6,
        repeat: Infinity,
        delay: idx * (6 / memberCount),
      },
    }),
  };

  return (
    <section className="py-20 md:py-32 bg-gradient-to-br from-white/40 to-white/35 relative overflow-hidden">
      {/* Animated background pattern */}
      <div className="absolute inset-0 pattern-eth opacity-5"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: -30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-[#0066ff] mb-4 drop-shadow-lg">
            💰 {title}
          </h2>
          <p className="text-lg sm:text-xl text-[#0066ff]/90 drop-shadow-md">{description}</p>
        </motion.div>

        {/* Equb Circle Animation */}
        <motion.div
          ref={containerRef}
          className="flex justify-center items-center min-h-[min(24rem,80vw)] relative"
        >
          {/* Rotating outer circle */}
          <svg
            className="absolute w-[min(24rem,80vw)] h-[min(24rem,80vw)]"
            viewBox="0 0 300 300"
            style={{ filter: 'drop-shadow(0 0 20px rgba(212, 175, 55, 0.3))' }}
          >
            {/* Background circles */}
            <motion.circle
              cx="150"
              cy="150"
              r="140"
              fill="none"
              stroke="rgba(212, 175, 55, 0.2)"
              strokeWidth="2"
              variants={rotatingLineVariants}
              initial="hidden"
              animate={isInView ? 'visible' : 'hidden'}
            />

            {/* Rotating gradient circle */}
            <defs>
              <linearGradient id="rotatingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0066ff" />
                <stop offset="100%" stopColor="#0066ff" />
              </linearGradient>
            </defs>

            <motion.circle
              cx="150"
              cy="150"
              r="140"
              fill="none"
              stroke="url(#rotatingGradient)"
              strokeWidth="3"
              strokeDasharray="880"
              strokeDashoffset="0"
              animate={{
                rotate: isInView ? 360 : 0,
              }}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: 'linear',
              }}
              style={{ transformOrigin: '150px 150px' } as CSSProperties}
              opacity={0.7}
            />

            {/* Static circle for reference */}
            <circle
              cx="150"
              cy="150"
              r="80"
              fill="rgba(49, 79, 160, 0.1)"
              stroke="rgba(212, 175, 55, 0.3)"
              strokeWidth="2"
            />
          </svg>

          {/* Member avatars positioned around circle */}
          <motion.div
            className="absolute w-[min(24rem,80vw)] h-[min(24rem,80vw)] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            {members.map((member, idx) => {
              const isActive = idx === 0; // First member gets money initially
              return (
                <div
                  key={idx}
                  className="absolute"
                  style={{
                    left: `calc(50% + ${member.x}px)`,
                    top: `calc(50% + ${member.y}px)`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  {/* Glow effect */}
                  <motion.div
                    className="absolute inset-0 w-16 h-16 rounded-full bg-[#0066ff] blur-xl"
                    custom={idx}
                    variants={glowVariants}
                    initial="hidden"
                    animate={isInView ? 'visible' : 'hidden'}
                    style={{
                      left: '-50%',
                      top: '-50%',
                      width: '200%',
                      height: '200%',
                    }}
                  />

                  {/* Member avatar */}
                  <motion.div
                    className={`w-16 h-16 rounded-full flex items-center justify-center font-black text-2xl shadow-lg border-4 transition-all ${
                      isActive
                        ? 'border-[#0066ff] bg-[#0066ff] text-white scale-110'
                        : 'border-white bg-[#0066ff] text-white'
                    }`}
                    custom={idx}
                    variants={memberVariants}
                    initial="hidden"
                    animate={isInView ? 'visible' : 'hidden'}
                    whileHover={{ scale: 1.1 }}
                  >
                    👤
                  </motion.div>

                  {/* Member index badge */}
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-[#0066ff] rounded-full text-white flex items-center justify-center text-xs font-black shadow-lg">
                    {idx + 1}
                  </div>
                </div>
              );
            })}

            <motion.div
              className="absolute"
              animate={{
                rotate: isInView ? 360 : 0,
              }}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: 'linear',
              }}
            >
              <div className="text-5xl drop-shadow-lg">💰</div>
            </motion.div>

            {/* Center circle */}
            <div className="absolute w-20 h-20 rounded-full bg-gradient-to-br from-white/40 to-white/35 flex items-center justify-center shadow-2xl border-4 border-white">
              <div className="text-3xl">🏦</div>
            </div>
          </motion.div>
        </motion.div>

        {/* Key Benefits */}
        <motion.div
          className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          viewport={{ once: true }}
        >
          {[
            { icon: '✅', title: 'Fair & Transparent', desc: 'Everyone gets their turn' },
            { icon: '🤝', title: 'Community Trust', desc: 'Rotating savings together' },
            { icon: '⚡', title: 'Quick Payout', desc: 'Instant when your turn comes' },
          ].map((benefit, idx) => (
            <motion.div
              key={idx}
              className="bg-gray-50 rounded-2xl p-6 border border-gray-200 text-center text-[#0066ff]"
              whileHover={{ scale: 1.05, y: -4 }}
            >
              <div className="text-4xl mb-3">{benefit.icon}</div>
              <h4 className="font-black text-lg mb-2">{benefit.title}</h4>
              <p className="text-[#0066ff]/80">{benefit.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}


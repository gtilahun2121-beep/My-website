'use client';

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

interface Step {
  number: number;
  title: string;
  description: string;
  icon: string;
}

interface HowItWorksProps {
  title: string;
  steps: Step[];
}

export default function HowItWorks({ title, steps }: HowItWorksProps) {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, margin: '-100px' });

  const stepVariants = {
    hidden: { opacity: 0, x: -50 },
    visible: (idx: number) => ({
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.6,
        delay: idx * 0.2,
        ease: [0.34, 1.56, 0.64, 1] as any,
      },
    }),
  };

  const connectorVariants = {
    hidden: { scaleX: 0, opacity: 0 },
    visible: (idx: number) => ({
      scaleX: 1,
      opacity: 1,
      transition: {
        duration: 0.8,
        delay: idx * 0.2 + 0.3,
        ease: [0.25, 0.46, 0.45, 0.94] as any,
      },
    }),
  };

  const iconVariants = {
    hidden: { scale: 0, rotate: -180 },
    visible: (idx: number) => ({
      scale: 1,
      rotate: 0,
      transition: {
        duration: 0.6,
        delay: idx * 0.2 + 0.1,
        type: 'spring' as const,
        stiffness: 100,
      },
    }),
  };

  return (
    <section className="py-20 md:py-32 bg-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 0, y: -30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl md:text-5xl font-black text-[#ce1126] mb-4">
            🔄 {title}
          </h2>
          <p className="text-xl text-[#5a5a5a]">
            Simple steps to start saving together
          </p>
        </motion.div>

        {/* Steps Container */}
        <motion.div
          ref={containerRef}
          className="relative"
        >
          {/* Desktop Layout - Horizontal */}
          <div className="hidden md:grid grid-cols-4 gap-6 items-center">
            {steps.map((step, idx) => (
              <div key={idx} className="relative">
                {/* Step Card */}
                <motion.div
                  className="card-eth p-8 rounded-2xl text-center"
                  custom={idx}
                  variants={stepVariants}
                  initial="hidden"
                  animate={isInView ? 'visible' : 'hidden'}
                >
                  {/* Icon */}
                  <motion.div
                    className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-[#0d7e4d] to-[#d4af37] rounded-full flex items-center justify-center shadow-lg"
                    custom={idx}
                    variants={iconVariants}
                    initial="hidden"
                    animate={isInView ? 'visible' : 'hidden'}
                  >
                    <div className="text-4xl">{step.icon}</div>
                  </motion.div>

                  {/* Number Badge */}
                  <div className="absolute -top-4 -right-4 w-10 h-10 bg-[#d4af37] rounded-full flex items-center justify-center font-black text-[#0d7e4d] shadow-lg">
                    {step.number}
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-black text-[#0d7e4d] mb-2">
                    {step.title}
                  </h3>
                  <p className="text-gray-600 text-sm">
                    {step.description}
                  </p>
                </motion.div>

                {/* Animated Connector Arrow */}
                {idx < steps.length - 1 && (
                  <motion.div
                    className="hidden lg:block absolute top-1/4 -right-6 w-12 h-1 bg-gradient-to-r from-[#0d7e4d] to-[#d4af37]"
                    custom={idx}
                    variants={connectorVariants}
                    initial="hidden"
                    animate={isInView ? 'visible' : 'hidden'}
                    style={{ transformOrigin: 'left' }}
                  >
                    {/* Arrow head */}
                    <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-0 h-0 border-l-4 border-t-3 border-b-3 border-l-[#d4af37] border-t-transparent border-b-transparent"></div>
                  </motion.div>
                )}
              </div>
            ))}
          </div>

          {/* Mobile Layout - Vertical */}
          <div className="md:hidden space-y-8">
            {steps.map((step, idx) => (
              <div key={idx} className="relative">
                <motion.div
                  className="card-eth p-8 rounded-2xl"
                  custom={idx}
                  variants={stepVariants}
                  initial="hidden"
                  animate={isInView ? 'visible' : 'hidden'}
                >
                  <div className="flex gap-6">
                    {/* Icon */}
                    <motion.div
                      className="w-16 h-16 flex-shrink-0 bg-gradient-to-br from-[#0d7e4d] to-[#d4af37] rounded-full flex items-center justify-center shadow-lg"
                      custom={idx}
                      variants={iconVariants}
                      initial="hidden"
                      animate={isInView ? 'visible' : 'hidden'}
                    >
                      <div className="text-3xl">{step.icon}</div>
                    </motion.div>

                    {/* Content */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-block w-8 h-8 bg-[#d4af37] rounded-full text-center leading-8 font-black text-[#0d7e4d]">
                          {step.number}
                        </span>
                        <h3 className="text-lg font-black text-[#0d7e4d]">
                          {step.title}
                        </h3>
                      </div>
                      <p className="text-gray-600 text-sm">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </motion.div>

                {/* Vertical Connector */}
                {idx < steps.length - 1 && (
                  <motion.div
                    className="ml-8 h-8 w-1 bg-gradient-to-b from-[#0d7e4d] to-[#d4af37]"
                    custom={idx}
                    variants={connectorVariants}
                    initial="hidden"
                    animate={isInView ? 'visible' : 'hidden'}
                    style={{ transformOrigin: 'top' }}
                  />
                )}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

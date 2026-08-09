'use client';

import { motion } from 'framer-motion';

interface Testimonial {
  name: string;
  role: string;
  image: string;
  quote: string;
  rating: number;
}

interface TestimonialsProps {
  testimonials: Testimonial[];
}

export default function Testimonials({ testimonials }: TestimonialsProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6 },
    },
  };

  return (
    <section className="py-20 md:py-32 bg-gradient-to-br from-[#f5f3f0] to-[#ece8e3]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: -30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl md:text-5xl font-black text-[#0d7e4d] mb-4">
            💬 What Our Members Say
          </h2>
          <p className="text-xl text-[#5a5a5a]">
            Real stories from Ethiopian savers transforming their lives
          </p>
        </motion.div>

        {/* Testimonials Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
        >
          {testimonials.map((testimonial, idx) => (
            <motion.div
              key={idx}
              className="card-eth p-8 rounded-2xl"
              variants={itemVariants}
              whileHover={{ scale: 1.05, y: -8 }}
            >
              {/* Rating */}
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <span key={i} className="text-2xl">⭐</span>
                ))}
              </div>

              {/* Quote */}
              <p className="text-gray-700 mb-6 italic font-semibold">
                "{testimonial.quote}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-4 pt-6 border-t border-[#d4af37]/30">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#0d7e4d] to-[#d4af37] flex items-center justify-center text-white text-xl font-black">
                  {testimonial.image}
                </div>
                <div>
                  <p className="font-black text-[#0d7e4d]">{testimonial.name}</p>
                  <p className="text-sm text-[#5a5a5a]">{testimonial.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

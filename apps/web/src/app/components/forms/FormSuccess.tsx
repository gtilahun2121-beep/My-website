'use client';

import { motion } from 'framer-motion';

interface FormSuccessProps {
  title: string;
  message: string;
  icon?: string;
}

export default function FormSuccess({ 
  title, 
  message, 
  icon = '✅' 
}: FormSuccessProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-green-50 border-2 border-green-200 rounded-lg p-6 text-center"
    >
      <motion.div
        className="text-6xl mb-4"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 0.6 }}
      >
        {icon}
      </motion.div>
      <h3 className="text-2xl font-black text-green-900 mb-2">{title}</h3>
      <p className="text-green-700 text-sm">{message}</p>
    </motion.div>
  );
}


import React, { useState } from 'react';
import { Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface InfoTooltipProps {
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({ content, position = 'top' }) => {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div className="relative inline-flex items-center ml-1.5 group">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="cursor-help text-rain/40 hover:text-lightBlue transition-colors"
      >
        <Info size={12} />
      </div>
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`absolute z-[100] w-64 p-3 bg-obsidian/95 border border-lightBlue/30 rounded shadow-2xl backdrop-blur-xl pointer-events-none ${positionClasses[position]}`}
          >
            <p className="text-[10px] font-medium text-slate-300 leading-relaxed">
              {content}
            </p>
            <div className="mt-2 pt-2 border-t border-white/5 flex justify-between items-center">
              <span className="text-[8px] font-black text-lightBlue uppercase tracking-widest">Data Dictionary Ref</span>
              <span className="text-[8px] font-bold text-rain/40 uppercase">v2.2 Spec</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

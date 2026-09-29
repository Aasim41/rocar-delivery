import { useState, useRef, useEffect } from 'react';
import { motion, useAnimation, useMotionValue, useTransform } from 'framer-motion';
import { ChevronRight, Check, Lock } from 'lucide-react';

interface SwipeToConfirmProps {
  onConfirm: () => void;
  text?: string;
  confirmedText?: string;
  disabled?: boolean;
}

export function SwipeToConfirm({ onConfirm, text = "Slide to confirm", confirmedText = "Confirmed", disabled = false }: SwipeToConfirmProps) {
  const [isConfirmed, setIsConfirmed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  
  const x = useMotionValue(0);
  const controls = useAnimation();

  useEffect(() => {
    if (containerRef.current) {
      setContainerWidth(containerRef.current.offsetWidth);
    }
    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const triggerHaptic = () => {
    try {
      if ('vibrate' in navigator) {
        navigator.vibrate([30, 50, 80]);
      }
    } catch (_) {}
  };

  const handleDragEnd = (_event: any, info: any) => {
    if (disabled) {
      controls.start({ x: 0 });
      return;
    }
    const threshold = containerWidth * 0.65;
    if (info.offset.x >= threshold) {
      setIsConfirmed(true);
      triggerHaptic();
      controls.start({ x: containerWidth - 56 });
      setTimeout(() => {
        onConfirm();
      }, 400);
    } else {
      controls.start({ x: 0 });
    }
  };

  const fillOpacity = useTransform(x, [0, containerWidth * 0.65], [0, 1]);

  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-14 rounded-2xl overflow-hidden flex items-center justify-center transition-colors duration-300 ${
        disabled 
          ? 'bg-zinc-900/50 border border-zinc-800/30' 
          : 'bg-zinc-900 border border-zinc-700/40'
      }`}
    >
      {/* Subtle fill as user drags */}
      <motion.div 
        className="absolute inset-0 bg-white/5 origin-left"
        style={{ scaleX: useTransform(x, [0, containerWidth - 56], [0, 1]), opacity: fillOpacity }}
      />

      {/* Confirmed flash */}
      {isConfirmed && (
        <motion.div
          className="absolute inset-0 bg-zinc-100"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        />
      )}
      
      {/* Text */}
      <span className={`relative z-10 font-semibold text-[13px] uppercase tracking-[0.15em] pointer-events-none transition-all duration-300 ${
        isConfirmed ? 'text-zinc-900' : disabled ? 'text-zinc-700' : 'text-zinc-500'
      }`}>
        {isConfirmed ? confirmedText : disabled ? 'Complete all fields' : text}
      </span>

      {/* Drag handle */}
      <motion.div
        drag={isConfirmed || disabled ? false : "x"}
        dragConstraints={{ left: 0, right: containerWidth - 56 }}
        dragElastic={0.05}
        onDragEnd={handleDragEnd}
        animate={controls}
        style={{ x }}
        className={`absolute left-1 top-1 bottom-1 w-12 rounded-xl flex items-center justify-center z-20 transition-colors duration-300 ${
          disabled 
            ? 'bg-zinc-800 cursor-not-allowed' 
            : isConfirmed 
              ? 'bg-zinc-900 cursor-default'
              : 'bg-white cursor-grab active:cursor-grabbing shadow-lg shadow-white/10'
        }`}
      >
        {isConfirmed ? (
          <motion.div initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', bounce: 0.5 }}>
            <Check className="w-5 h-5 text-white" />
          </motion.div>
        ) : disabled ? (
          <Lock className="w-4 h-4 text-zinc-600" />
        ) : (
          <motion.div animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}>
            <ChevronRight className="w-5 h-5 text-zinc-900" />
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

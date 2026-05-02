import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";

interface PulseSOSProps {
  isAlerting: boolean;
  holdProgress: number;
  holding: boolean;
  onClick: () => void;
  onHoldStart: () => void;
  onHoldEnd: () => void;
}

export const PulseSOS = ({ 
  isAlerting, 
  holdProgress, 
  holding, 
  onClick, 
  onHoldStart, 
  onHoldEnd 
}: PulseSOSProps) => {
  const { t } = useTranslation();

  return (
    <div className="relative w-full aspect-square flex items-center justify-center p-4">
      {/* Outer Glow / Aura */}
      <motion.div
        animate={{
          scale: isAlerting ? [1, 1.2, 1] : 1,
          opacity: isAlerting ? [0.4, 0.8, 0.4] : 0.2,
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className={cn(
          "absolute inset-0 rounded-full blur-[60px] transition-colors duration-700",
          isAlerting ? "bg-red-500" : (holding ? "bg-cyan-500" : "bg-purple-600/30")
        )}
      />

      <motion.div
        onPointerDown={onHoldStart}
        onPointerUp={onHoldEnd}
        onPointerLeave={onHoldEnd}
        onClick={onClick}
        animate={{
          scale: holding ? 0.95 : 1,
        }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.9 }}
        className="relative z-10 w-full h-full max-w-[300px] max-h-[300px] rounded-full cursor-pointer touch-none select-none overflow-hidden group shadow-2xl"
      >
        {/* The Spherical Glass Container */}
        <div className="absolute inset-0 rounded-full border border-white/20 bg-black/40 backdrop-blur-sm overflow-hidden">
          {/* Animated Blobs inside */}
          <div className="absolute inset-0">
            {/* Cyan Blob */}
            <motion.div
              animate={{
                x: [-20, 20, -10],
                y: [10, -20, 10],
                scale: [1, 1.2, 0.9],
                rotate: [0, 90, 180, 0],
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "linear",
              }}
              className="absolute top-1/4 left-1/4 w-3/4 h-3/4 rounded-full bg-cyan-400/60 blur-[40px]"
            />
            
            {/* Magenta Blob */}
            <motion.div
              animate={{
                x: [20, -30, 20],
                y: [-20, 30, -20],
                scale: [0.9, 1.1, 1],
                rotate: [0, -120, 0],
              }}
              transition={{
                duration: 10,
                repeat: Infinity,
                ease: "linear",
              }}
              className="absolute bottom-1/4 right-1/4 w-2/3 h-2/3 rounded-full bg-magenta-500/60 blur-[45px]"
              style={{ backgroundColor: "rgb(255, 0, 255, 0.6)" }}
            />

            {/* Blue/Purple Blob */}
            <motion.div
              animate={{
                x: [0, 40, -40, 0],
                y: [40, -40, 40, 0],
                scale: [1.2, 0.8, 1.2],
              }}
              transition={{
                duration: 12,
                repeat: Infinity,
                ease: "linear",
              }}
              className="absolute inset-0 w-full h-full rounded-full bg-blue-600/50 blur-[50px]"
            />

            {/* Center Dynamic Core */}
            <motion.div
              animate={{
                opacity: isAlerting ? [0.4, 0.9, 0.4] : (holding ? 0.8 : 0.4),
                scale: isAlerting ? [1, 1.4, 1] : (holding ? 1.1 : 1),
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className={cn(
                "absolute inset-0 flex items-center justify-center transition-colors duration-500",
                isAlerting ? "bg-red-500/20" : ""
              )}
            >
              <div className="flex flex-col items-center justify-center text-center">
                <motion.span 
                  className={cn(
                    "text-6xl font-black tracking-tighter transition-all duration-500 block leading-none",
                    isAlerting ? "text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]" : "text-white/90"
                  )}
                >
                  {t('emergency.sos')}
                </motion.span>
                <motion.div className="mt-2 space-y-1">
                  <motion.div
                    animate={isAlerting ? { opacity: [1, 0.4, 1] } : {}}
                    transition={{ duration: 1, repeat: Infinity }}
                    className={cn(
                      "text-[9px] font-black tracking-[0.4em] uppercase text-center",
                      isAlerting ? "text-white" : "text-white/40"
                    )}
                  >
                    {isAlerting ? t('emergency.alert_active') : (holding ? t('emergency.commencing_sync') : t('emergency.hold_tip'))}
                  </motion.div>
                  {isAlerting && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-[7px] font-bold text-white/60 uppercase tracking-widest text-center"
                    >
                      Haptics & Audio Active
                    </motion.div>
                  )}
                </motion.div>
              </div>
            </motion.div>
          </div>

          {/* Specular Highlight / Glass Reflection */}
          <div className="absolute top-0 left-0 w-full h-full rounded-full pointer-events-none">
            <div className="absolute top-[10%] left-[20%] w-[40%] h-[20%] bg-white/20 blur-xl rounded-[100%] rotate-[-25deg]" />
            <div className="absolute bottom-[5%] right-[15%] w-[30%] h-[15%] bg-white/10 blur-lg rounded-[100%] rotate-[15deg]" />
          </div>

          {/* Progress Overlay */}
          {holding && !isAlerting && (
            <div className="absolute inset-0 bg-cyan-500/10 pointer-events-none">
               <svg className="w-full h-full -rotate-90">
                 <circle
                   cx="50%"
                   cy="50%"
                   r="48%"
                   fill="none"
                   stroke="rgba(0, 255, 255, 0.4)"
                   strokeWidth="4"
                   strokeDasharray="100"
                   pathLength="100"
                   strokeDashoffset={100 - holdProgress}
                   strokeLinecap="round"
                   className="transition-all duration-100 ease-linear"
                 />
               </svg>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

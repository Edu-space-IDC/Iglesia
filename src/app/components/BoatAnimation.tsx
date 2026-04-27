import { motion } from 'motion/react';
import type { CSSProperties } from 'react';

export const BOAT_IMAGE_URL = new URL(
  '../../imports/Diseño_sin_título__2_-removebg-preview.png',
  import.meta.url,
).href;

export const boatFloatMotion = {
  animate: {
    y: [-8, 8, -8],
    rotate: [-3, 3, -3],
  },
  transition: {
    duration: 3,
    repeat: Infinity,
    ease: 'easeInOut' as const,
  },
};

interface BoatWavesProps {
  className?: string;
  primaryClassName?: string;
  secondaryClassName?: string;
  style?: CSSProperties;
  primaryDuration?: number;
  secondaryDuration?: number;
  delay?: number;
  isAnimated?: boolean;
}

export function BoatWaves({
  className = 'absolute bottom-0 left-0 right-0 h-16 overflow-hidden',
  primaryClassName = 'fill-cyan-400/40 dark:fill-cyan-500/30',
  secondaryClassName = 'fill-cyan-500/50 dark:fill-cyan-600/40',
  style,
  primaryDuration = 2.5,
  secondaryDuration = 2,
  delay = 0,
  isAnimated = true,
}: BoatWavesProps) {
  return (
    <div className={className} style={style}>
      <svg className="h-full w-full" viewBox="0 0 200 60" preserveAspectRatio="none">
        {isAnimated ? (
          <>
            <motion.path
              d="M0,25 Q25,15 50,25 T100,25 T150,25 T200,25 L200,60 L0,60 Z"
              className={primaryClassName}
              animate={{
                d: [
                  'M0,30 Q25,20 50,30 T100,30 T150,30 T200,30 L200,60 L0,60 Z',
                  'M0,30 Q25,40 50,30 T100,30 T150,30 T200,30 L200,60 L0,60 Z',
                  'M0,30 Q25,20 50,30 T100,30 T150,30 T200,30 L200,60 L0,60 Z',
                ],
              }}
              transition={{
                duration: primaryDuration,
                repeat: Infinity,
                ease: 'easeInOut',
                delay,
              }}
            />
            <motion.path
              d="M0,34 Q30,28 60,34 T120,34 T180,34 T200,34 L200,60 L0,60 Z"
              className={secondaryClassName}
              animate={{
                d: [
                  'M0,34 Q30,28 60,34 T120,34 T180,34 T200,34 L200,60 L0,60 Z',
                  'M0,34 Q30,40 60,34 T120,34 T180,34 T200,34 L200,60 L0,60 Z',
                  'M0,34 Q30,28 60,34 T120,34 T180,34 T200,34 L200,60 L0,60 Z',
                ],
              }}
              transition={{
                duration: secondaryDuration,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: delay + 0.12,
              }}
            />
          </>
        ) : (
          <>
            <path
              d="M0,30 Q25,26 50,30 T100,30 T150,30 T200,30 L200,60 L0,60 Z"
              className={primaryClassName}
            />
            <path
              d="M0,34 Q30,31 60,34 T120,34 T180,34 T200,34 L200,60 L0,60 Z"
              className={secondaryClassName}
            />
          </>
        )}
      </svg>
    </div>
  );
}

export function BoatAnimation() {
  return (
    <div className="relative mx-auto mb-6 h-48 w-50 -translate-y-10 scale-130">
      <motion.div className="relative z-0 translate-y-9" {...boatFloatMotion}>
        <img
          src={BOAT_IMAGE_URL}
          alt="La Barca"
          className="h-48 w-48 object-contain drop-shadow-2xl"
          style={{
            filter: 'drop-shadow(0 10px 20px rgba(0, 0, 0, 0.3))',
          }}
        />
      </motion.div>

      <BoatWaves />

      <motion.div
        className="absolute left-1/4 top-1/2 h-2 w-2 rounded-full bg-white/60 blur-sm"
        animate={{
          opacity: [0.3, 0.7, 0.3],
          scale: [1, 1.5, 1],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute right-1/4 top-1/3 h-3 w-3 rounded-full bg-white/50 blur-sm"
        animate={{
          opacity: [0.4, 0.8, 0.4],
          scale: [1, 1.3, 1],
        }}
        transition={{
          duration: 2.5,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 0.5,
        }}
      />
    </div>
  );
}

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { motion } from 'motion/react';
import { Heart, LifeBuoy, Move, Pause, Play, Timer, Trophy } from 'lucide-react';
import { BOAT_IMAGE_URL, boatFloatMotion, BoatWaves } from './BoatAnimation';

const GAME_DURATION = 40;
const JOYSTICK_MAX_DISTANCE = 46;
const INITIAL_LIVES = 3;
const DAMAGE_COOLDOWN_MS = 1400;
const WHIRLPOOL_LIFETIME_MS = 7200;
const BOMB_COUNTDOWN_MS = 3000;
const BOMB_EXPLOSION_MS = 650;
const BOAT_RESCUE_RADIUS = 5.8;
const SHARK_CONTACT_RADIUS = 6.4;
const DESKTOP_MAX_SAILORS = 9;
const MOBILE_MAX_SAILORS = 6;
const DESKTOP_MAX_WHIRLPOOLS = 2;
const MOBILE_MAX_WHIRLPOOLS = 1;
const DESKTOP_MAX_BOMBS = 3;
const MOBILE_MAX_BOMBS = 2;
const PERFORMANCE_MAX_SAILORS = 5;
const PERFORMANCE_MAX_WHIRLPOOLS = 1;
const PERFORMANCE_MAX_BOMBS = 1;
const DESKTOP_SAILOR_SPAWN_INTERVAL_MS = 1600;
const MOBILE_SAILOR_SPAWN_INTERVAL_MS = 2200;
const PERFORMANCE_SAILOR_SPAWN_INTERVAL_MS = 2500;
const DESKTOP_SAILOR_SPAWN_SKIP_CHANCE = 0.18;
const MOBILE_SAILOR_SPAWN_SKIP_CHANCE = 0.34;
const PERFORMANCE_SAILOR_SPAWN_SKIP_CHANCE = 0.48;
const TSUNAMI_WARNING_MS = 1350;
const DESKTOP_TSUNAMI_SPAWN_INTERVAL_MS = 9000;
const MOBILE_TSUNAMI_SPAWN_INTERVAL_MS = 10200;
const PERFORMANCE_TSUNAMI_SPAWN_INTERVAL_MS = 11600;
const DESKTOP_TSUNAMI_SPAWN_SKIP_CHANCE = 0.5;
const MOBILE_TSUNAMI_SPAWN_SKIP_CHANCE = 0.82;
const PERFORMANCE_TSUNAMI_SPAWN_SKIP_CHANCE = 0.88;
const TSUNAMI_FRONT_WIDTH = 9;
const BOMB_BASE_DRIFT_SPEED = 0.022;
const BOMB_DRIFT_SPEED_VARIANCE = 0.015;
const BOMB_CURRENT_FORCE_X = 0.0032;
const BOMB_CURRENT_FORCE_Y = 0.0022;
const RESCUES_PER_SPEED_STEP = 5;
const SPEED_SCORE_CAP = 18;
const BOAT_BASE_ACCELERATION = 0.082;
const BOAT_ACCELERATION_PER_POINT = 0.0012;
const BOAT_BASE_MAX_SPEED = 0.7;
const BOAT_MAX_SPEED_PER_POINT = 0.006;
const SHARK_SPEED_POINT_ADVANTAGE = 0;
const SHARK_ACCELERATION_ADVANTAGE = -0.054;
const SHARK_MAX_SPEED_ADVANTAGE = -0.072;
const SHARK_DRAG = 0.953;
const TSUNAMI_BOAT_HITBOX_FRONT_WIDTH = 2.9;
const TSUNAMI_BOAT_HITBOX_HORIZONTAL_PADDING = 1.4;
const TSUNAMI_BOAT_HITBOX_VERTICAL_PADDING = 1.6;
const DESKTOP_FRAME_MS = 1000 / 60;
const MOBILE_FRAME_MS = 1000 / 45;
const PERFORMANCE_FRAME_MS = 1000 / 30;
const GAME_START_COUNTDOWN_SECONDS = 3;
const GAME_START_NOW_FLASH_MS = 520;
const SHARK_IMAGE_URL = new URL('../../imports/Diseño sin título (3).png', import.meta.url).href;

type NavigatorWithHints = Navigator & {
  deviceMemory?: number;
};

interface GameSectionProps {
  isVisible: boolean;
  onHide: () => void;
  onGameplayActiveChange?: (isActive: boolean) => void;
}

interface Position {
  x: number;
  y: number;
}

interface BoatPhysics extends Position {
  velocityX: number;
  velocityY: number;
}

interface Sailor extends Position {
  id: number;
  phase: number;
}

interface Shark extends Position {
  id: number;
  velocityX: number;
  velocityY: number;
  phase: number;
}

interface Whirlpool extends Position {
  id: number;
  radius: number;
  coreRadius: number;
  strength: number;
  ttlMs: number;
  phase: number;
}

interface Bomb extends Position {
  id: number;
  countdownMs: number;
  blastRadius: number;
  exploded: boolean;
  explosionElapsedMs: number;
  velocityX: number;
  velocityY: number;
  phase: number;
}

interface Tsunami extends Position {
  id: number;
  direction: 'left' | 'right';
  width: number;
  height: number;
  velocityX: number;
  warningMs: number;
  phase: number;
}

interface DamageBurst extends Position {
  id: number;
  label: string;
  tone: 'danger' | 'warning' | 'water' | 'fire';
}

type EndReason = 'time' | 'lives' | null;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function distanceBetween(a: Position, b: Position) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getDepthScale(y: number) {
  return 0.72 + (y / 100) * 0.52;
}

function getTravelRotation(velocityX: number, velocityY: number) {
  if (Math.abs(velocityX) < 0.01 && Math.abs(velocityY) < 0.01) {
    return 0;
  }

  return (Math.atan2(velocityY, velocityX) * 180) / Math.PI;
}

function getSpeedLevel(score: number, extraPoints = 0) {
  const speedStep = Math.floor(score / RESCUES_PER_SPEED_STEP);
  const maxSpeedStep = Math.floor(SPEED_SCORE_CAP / RESCUES_PER_SPEED_STEP);

  return clamp(speedStep + extraPoints, 0, maxSpeedStep);
}

function getBoatAcceleration(score: number) {
  return BOAT_BASE_ACCELERATION + getSpeedLevel(score) * BOAT_ACCELERATION_PER_POINT;
}

function getBoatMaxSpeed(score: number) {
  return BOAT_BASE_MAX_SPEED + getSpeedLevel(score) * BOAT_MAX_SPEED_PER_POINT;
}

function getSharkAcceleration(score: number) {
  return (
    BOAT_BASE_ACCELERATION +
    SHARK_ACCELERATION_ADVANTAGE +
    getSpeedLevel(score, SHARK_SPEED_POINT_ADVANTAGE) * BOAT_ACCELERATION_PER_POINT
  );
}

function getSharkMaxSpeed(score: number) {
  return (
    BOAT_BASE_MAX_SPEED +
    SHARK_MAX_SPEED_ADVANTAGE +
    getSpeedLevel(score, SHARK_SPEED_POINT_ADVANTAGE) * BOAT_MAX_SPEED_PER_POINT
  );
}

function shouldEnableAutoPerformanceMode(userAgent: string) {
  const navigatorWithHints = navigator as NavigatorWithHints;
  const deviceMemory = navigatorWithHints.deviceMemory ?? 4;
  const hardwareConcurrency = navigator.hardwareConcurrency ?? 4;
  const prefersReducedMotion =
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const androidVersion = /Android\s(\d+)/i.exec(userAgent)?.[1];
  const iosVersion = /OS (\d+)_/i.exec(userAgent)?.[1];
  const isOldAndroid = androidVersion ? Number(androidVersion) <= 11 : false;
  const isOldIPhone =
    /iPhone/i.test(userAgent) &&
    (iosVersion ? Number(iosVersion) <= 15 : hardwareConcurrency <= 4);

  return (
    prefersReducedMotion ||
    deviceMemory <= 4 ||
    hardwareConcurrency <= 4 ||
    isOldAndroid ||
    isOldIPhone
  );
}

function isLikelyMobileDevice(userAgent: string, maxTouchPoints: number) {
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)
  );
}

function createBoat(): BoatPhysics {
  return {
    x: 50,
    y: 50,
    velocityX: 0,
    velocityY: 0,
  };
}

function findSpawnPoint(
  avoid: Position[] = [],
  minDistance = 16,
  horizontalPadding = 10,
  verticalPadding = 11,
): Position {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const point = {
      x: Math.random() * (100 - horizontalPadding * 2) + horizontalPadding,
      y: Math.random() * (100 - verticalPadding * 2) + verticalPadding,
    };

    if (avoid.every((avoidPoint) => distanceBetween(point, avoidPoint) >= minDistance)) {
      return point;
    }
  }

  return {
    x: Math.random() * (100 - horizontalPadding * 2) + horizontalPadding,
    y: Math.random() * (100 - verticalPadding * 2) + verticalPadding,
  };
}

function createSailor(id: number, avoid: Position[] = []): Sailor {
  const point = findSpawnPoint(avoid, 12, 9, 10);

  return {
    id,
    x: point.x,
    y: point.y,
    phase: Math.random() * 1.8,
  };
}

function createShark(id: number): Shark {
  const edge = Math.floor(Math.random() * 4);

  if (edge === 0) {
    return {
      id,
      x: -8,
      y: Math.random() * 76 + 12,
      velocityX: 0.16,
      velocityY: 0,
      phase: Math.random() * 2,
    };
  }

  if (edge === 1) {
    return {
      id,
      x: 108,
      y: Math.random() * 76 + 12,
      velocityX: -0.16,
      velocityY: 0,
      phase: Math.random() * 2,
    };
  }

  if (edge === 2) {
    return {
      id,
      x: Math.random() * 76 + 12,
      y: -8,
      velocityX: 0,
      velocityY: 0.16,
      phase: Math.random() * 2,
    };
  }

  return {
    id,
    x: Math.random() * 76 + 12,
    y: 108,
    velocityX: 0,
    velocityY: -0.16,
    phase: Math.random() * 2,
  };
}

function createWhirlpool(id: number, avoid: Position[] = []): Whirlpool {
  const point = findSpawnPoint(avoid, 22, 16, 16);

  return {
    id,
    x: point.x,
    y: point.y,
    radius: 16 + Math.random() * 3,
    coreRadius: 3.6 + Math.random() * 0.8,
    strength: 0.055 + Math.random() * 0.015,
    ttlMs: WHIRLPOOL_LIFETIME_MS + Math.random() * 1200,
    phase: Math.random() * 2,
  };
}

function createBomb(id: number, avoid: Position[] = []): Bomb {
  const point = findSpawnPoint(avoid, 18, 12, 14);
  const driftDirection = Math.random() < 0.5 ? -1 : 1;
  const driftSpeed = BOMB_BASE_DRIFT_SPEED + Math.random() * BOMB_DRIFT_SPEED_VARIANCE;

  return {
    id,
    x: point.x,
    y: point.y,
    countdownMs: BOMB_COUNTDOWN_MS,
    blastRadius: 11 + Math.random() * 2,
    exploded: false,
    explosionElapsedMs: 0,
    velocityX: driftDirection * driftSpeed,
    velocityY: (Math.random() - 0.5) * driftSpeed * 0.55,
    phase: Math.random() * 2,
  };
}

function createTsunami(id: number): Tsunami {
  const direction = Math.random() < 0.5 ? 'left' : 'right';
  const width = 24 + Math.random() * 5;
  const height = 34 + Math.random() * 10;
  const y = 24 + Math.random() * 50;

  return {
    id,
    direction,
    x: direction === 'right' ? -width * 0.54 : 100 + width * 0.54,
    y,
    width,
    height,
    velocityX: (direction === 'right' ? 0.47 : -0.47) * (0.92 + Math.random() * 0.18),
    warningMs: TSUNAMI_WARNING_MS + Math.random() * 360,
    phase: Math.random() * 2,
  };
}

function isInsideTsunamiFront(
  point: Position,
  tsunami: Tsunami,
  horizontalPadding = 0,
  verticalPadding = 0,
  frontWidth = TSUNAMI_FRONT_WIDTH,
) {
  const halfHeight = tsunami.height / 2 + verticalPadding;
  const withinY = Math.abs(point.y - tsunami.y) <= halfHeight;

  if (!withinY) {
    return false;
  }

  const crestStart =
    tsunami.direction === 'right'
      ? tsunami.x + tsunami.width / 2 - frontWidth - horizontalPadding
      : tsunami.x - tsunami.width / 2 - horizontalPadding;
  const crestEnd =
    tsunami.direction === 'right'
      ? tsunami.x + tsunami.width / 2 + horizontalPadding
      : tsunami.x - tsunami.width / 2 + frontWidth + horizontalPadding;

  return point.x >= crestStart && point.x <= crestEnd;
}

function getTsunamiPushDirection(tsunami: Tsunami, targetY: number): Position {
  return {
    x: tsunami.direction === 'right' ? 1 : -1,
    y: clamp((targetY - tsunami.y) / Math.max(tsunami.height / 2, 1), -0.35, 0.35),
  };
}

function getTsunamiContactPoint(tsunami: Tsunami, targetY: number): Position {
  return {
    x: clamp(
      tsunami.direction === 'right' ? tsunami.x + tsunami.width / 2 : tsunami.x - tsunami.width / 2,
      4,
      96,
    ),
    y: clamp(targetY, 8, 92),
  };
}

function BoatSprite({
  speed,
  depthScale,
  isInvulnerable,
  animationsEnabled,
}: {
  speed: number;
  depthScale: number;
  isInvulnerable: boolean;
  animationsEnabled: boolean;
}) {
  const width = 98 * depthScale;
  const height = 112 * depthScale;
  const speedRatio = Math.min(speed / 0.72, 1);

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2"
      style={{
        width,
        height,
        transform: 'translate(-50%, -60%)',
      }}
    >
      <div
        className="absolute rounded-full"
        style={{
          left: '50%',
          top: '82%',
          width: width * (0.92 + speedRatio * 0.2),
          height: height * (0.24 + speedRatio * 0.18),
          transform: 'translate(-50%, -50%)',
          background: `radial-gradient(circle at 50% 50%, rgba(255,255,255,${
            0.16 + speedRatio * 0.22
          }) 0%, rgba(103,232,249,${0.14 + speedRatio * 0.16}) 38%, rgba(8,47,73,0) 78%)`,
          filter: `blur(${10 * depthScale}px)`,
          opacity: 0.86,
        }}
      />

      <div
        className="absolute rounded-full border border-white/40"
        style={{
          left: '50%',
          top: '84%',
          width: width * (0.76 + speedRatio * 0.22),
          height: height * 0.22,
          transform: 'translate(-50%, -50%)',
          opacity: 0.2 + speedRatio * 0.44,
        }}
      />

      {isInvulnerable && (
        <div
          className="absolute rounded-full border border-rose-300/70"
          style={{
            inset: '8% 12%',
            animation: 'game-hit-ring 0.9s ease-out infinite',
            boxShadow: '0 0 34px rgba(244,63,94,0.25)',
          }}
        />
      )}

      <motion.div
        animate={
          animationsEnabled
            ? isInvulnerable
              ? {
                  ...boatFloatMotion.animate,
                  opacity: [1, 0.4, 1],
                }
              : boatFloatMotion.animate
            : isInvulnerable
              ? { opacity: [1, 0.55, 1] }
              : { opacity: 1, y: 0, rotate: 0 }
        }
        transition={
          animationsEnabled
            ? isInvulnerable
              ? {
                  ...boatFloatMotion.transition,
                  opacity: {
                    duration: 0.22,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  },
                }
              : boatFloatMotion.transition
            : isInvulnerable
              ? {
                  opacity: {
                    duration: 0.32,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  },
                }
              : { duration: 0 }
        }
      >
        <img
          src={BOAT_IMAGE_URL}
          alt="Barca de rescate"
          className="relative z-10 h-full w-full object-contain"
          style={{
            filter: `drop-shadow(0 ${12 * depthScale}px ${18 * depthScale}px ${
              isInvulnerable ? 'rgba(244,63,94,0.36)' : 'rgba(2, 6, 23, 0.42)'
            })`,
          }}
        />
      </motion.div>
    </div>
  );
}

function RescueTarget({
  phase,
  depthScale,
  animationsEnabled,
}: {
  phase: number;
  depthScale: number;
  animationsEnabled: boolean;
}) {
  const width = 62 * depthScale;
  const height = 74 * depthScale;
  const enterDuration = 0.72;
  const floatDelay = enterDuration + phase;
  const pulseDelay = enterDuration + 0.12 + phase;

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2"
      style={{
        width,
        height,
        transform: 'translate(-50%, -60%)',
      }}
    >
      <div
        className="absolute left-1/2 top-[78%] rounded-full"
        style={{
          width: width * 0.88,
          height: height * 0.2,
          transform: 'translate(-50%, -50%)',
          background:
            'radial-gradient(circle at 50% 50%, rgba(224,242,254,0.92), rgba(56,189,248,0.32) 46%, rgba(8,47,73,0) 78%)',
          filter: `blur(${4 * depthScale}px)`,
          animation: animationsEnabled ? 'game-rescue-splash-ring 0.78s ease-out both' : 'none',
        }}
      />

      <div
        className="absolute left-[26%] top-[58%] rounded-full bg-cyan-100/90"
        style={{
          width: width * 0.12,
          height: height * 0.12,
          animation: animationsEnabled ? 'game-rescue-droplet-left 0.7s ease-out both' : 'none',
          filter: `blur(${0.8 * depthScale}px)`,
        }}
      />

      <div
        className="absolute right-[26%] top-[56%] rounded-full bg-cyan-100/90"
        style={{
          width: width * 0.1,
          height: height * 0.1,
          animation: animationsEnabled ? 'game-rescue-droplet-right 0.74s ease-out both' : 'none',
          filter: `blur(${0.8 * depthScale}px)`,
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          animation: animationsEnabled
            ? `game-rescue-enter ${enterDuration}s cubic-bezier(0.18, 0.88, 0.32, 1.18) both, game-rescue-float 2.5s ease-in-out ${floatDelay}s infinite`
            : 'none',
          transformOrigin: '50% 78%',
        }}
      >
        <svg width={width} height={height} viewBox="0 0 100 120" aria-hidden="true">
          <ellipse cx="50" cy="95" rx="30" ry="11" fill="rgba(2,6,23,0.3)" />
          <ellipse cx="50" cy="92" rx="24" ry="8" fill="rgba(224,242,254,0.2)" />

          <circle cx="50" cy="74" r="23" fill="#fb923c" />
          <circle cx="50" cy="74" r="15" fill="#e0f2fe" />
          <path
            d="M35 61 L65 87 M35 87 L65 61"
            stroke="#fff7ed"
            strokeWidth="5"
            strokeLinecap="round"
          />

          <circle cx="50" cy="48" r="13" fill="#f5c8a8" />
          <path
            d="M38 47 C40 34 60 30 66 42 C63 37 57 34 50 34 C44 34 40 38 38 47 Z"
            fill="#1e293b"
          />
          <path
            d="M39 63 C42 56 45 53 50 53 C55 53 58 56 61 63"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="6"
            strokeLinecap="round"
          />
        </svg>
      </div>

      <div
        className="absolute rounded-full border border-cyan-100/60"
        style={{
          inset: '18% 14%',
          animation: animationsEnabled
            ? `game-rescue-pulse-start 0.82s ease-out both, game-rescue-pulse 1.8s ease-out ${pulseDelay}s infinite`
            : 'none',
        }}
      />
    </div>
  );
}

function SharkSprite({
  velocityX,
  velocityY,
  depthScale,
  phase,
  animationsEnabled,
}: {
  velocityX: number;
  velocityY: number;
  depthScale: number;
  phase: number;
  animationsEnabled: boolean;
}) {
  const width = 118 * depthScale;
  const height = 88 * depthScale;
  const rotation = getTravelRotation(velocityX, velocityY);

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2"
      style={{
        width,
        height,
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
      }}
    >
      <div
        className="absolute rounded-full"
        style={{
          left: '50%',
          top: '72%',
          width: width * 0.84,
          height: height * 0.38,
          transform: 'translate(-50%, -50%)',
          background:
            'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.14), rgba(56,189,248,0.07) 42%, rgba(2,6,23,0) 78%)',
          filter: `blur(${10 * depthScale}px)`,
          opacity: 0.82,
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          animation: animationsEnabled ? 'game-shark-glide 1.25s ease-in-out infinite' : 'none',
          animationDelay: animationsEnabled ? `${phase}s` : undefined,
        }}
      >
        <img
          src={SHARK_IMAGE_URL}
          alt="Tiburon"
          className="h-full w-full object-contain scale-125"
          draggable={false}
          style={{
            filter: `drop-shadow(0 ${9 * depthScale}px ${16 * depthScale}px rgba(2,6,23,0.42))`,
          }}
        />
      </div>
    </div>
  );
}

function WhirlpoolSprite({
  radius,
  depthScale,
  ttlMs,
  phase,
  animationsEnabled,
}: {
  radius: number;
  depthScale: number;
  ttlMs: number;
  phase: number;
  animationsEnabled: boolean;
}) {
  const size = radius * 6.8 * depthScale;
  const lifeOpacity = Math.min(1, ttlMs / 650);
  const fadeInOpacity = Math.min(1, (WHIRLPOOL_LIFETIME_MS + 1200 - ttlMs) / 480);
  const opacity = Math.min(lifeOpacity, fadeInOpacity);

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2"
      style={{
        width: size,
        height: size,
        transform: 'translate(-50%, -50%)',
        opacity,
      }}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(2,6,23,0.74) 0%, rgba(3,26,51,0.66) 22%, rgba(8,82,127,0.48) 42%, rgba(34,211,238,0.16) 64%, rgba(34,211,238,0) 76%)',
        }}
      />

      <div
        className="absolute inset-[9%] rounded-full border border-cyan-100/30"
        style={{
          animation: animationsEnabled ? 'game-whirlpool-spin 2.4s linear infinite' : 'none',
          animationDelay: animationsEnabled ? `${phase}s` : undefined,
          boxShadow: 'inset 0 0 20px rgba(125,211,252,0.18)',
        }}
      />

      <div
        className="absolute inset-[20%] rounded-full border border-sky-200/20"
        style={{
          animation: animationsEnabled
            ? 'game-whirlpool-spin 1.8s linear infinite reverse'
            : 'none',
          animationDelay: animationsEnabled ? `${phase * 0.7}s` : undefined,
        }}
      />

      <div
        className="absolute inset-[34%] rounded-full"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(2,6,23,0.9), rgba(6,37,64,0.72) 46%, rgba(12,74,110,0.16) 76%, rgba(12,74,110,0) 100%)',
          boxShadow: '0 0 28px rgba(34,211,238,0.14)',
        }}
      />
    </div>
  );
}

function BombSprite({
  bomb,
  depthScale,
  animationsEnabled,
}: {
  bomb: Bomb;
  depthScale: number;
  animationsEnabled: boolean;
}) {
  const size = 58 * depthScale;
  const countdown = Math.max(1, Math.ceil(bomb.countdownMs / 1000));
  const urgency = 1 - bomb.countdownMs / BOMB_COUNTDOWN_MS;
  const explosionProgress = clamp(bomb.explosionElapsedMs / BOMB_EXPLOSION_MS, 0, 1);

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2"
      style={{
        width: size,
        height: size,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {bomb.exploded ? (
        <>
          <div
            className="absolute inset-0 rounded-full"
            style={{
              transform: `scale(${0.75 + explosionProgress * 1.8})`,
              opacity: 1 - explosionProgress,
              background:
                'radial-gradient(circle at 50% 50%, rgba(255,251,235,0.95) 0%, rgba(251,191,36,0.78) 26%, rgba(249,115,22,0.42) 54%, rgba(249,115,22,0) 78%)',
              filter: `blur(${6 + explosionProgress * 10}px)`,
            }}
          />
          <div
            className="absolute inset-[8%] rounded-full border border-amber-100/70"
            style={{
              transform: `scale(${1 + explosionProgress * 2.1})`,
              opacity: 0.9 - explosionProgress,
            }}
          />
        </>
      ) : (
        <>
          <div
            className="absolute rounded-full"
            style={{
              inset: '8%',
              background: `radial-gradient(circle at 50% 50%, rgba(251,191,36,${
                0.1 + urgency * 0.18
              }), rgba(249,115,22,0) 70%)`,
              filter: `blur(${8 * depthScale}px)`,
              animation: animationsEnabled
                ? `game-bomb-pulse ${Math.max(0.3, 0.92 - urgency * 0.4)}s ease-in-out infinite`
                : 'none',
            }}
          />

          <div
            className="absolute inset-0"
            style={{
              animation: animationsEnabled ? 'game-rescue-float 1.9s ease-in-out infinite' : 'none',
              animationDelay: animationsEnabled ? `${bomb.phase}s` : undefined,
            }}
          >
            <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
              <circle cx="50" cy="50" r="28" fill="#334155" />
              <circle cx="50" cy="50" r="19" fill="#475569" />
              <circle cx="50" cy="50" r="7" fill="#facc15" />
              <circle cx="50" cy="50" r="3.8" fill="#fff7ed" />
              <path d="M50 14 L56 26 L44 26 Z" fill="#94a3b8" />
              <path d="M50 86 L56 74 L44 74 Z" fill="#94a3b8" />
              <path d="M14 50 L26 44 L26 56 Z" fill="#94a3b8" />
              <path d="M86 50 L74 44 L74 56 Z" fill="#94a3b8" />
              <path d="M24 24 L34 30 L30 34 Z" fill="#94a3b8" />
              <path d="M76 24 L70 34 L66 30 Z" fill="#94a3b8" />
              <path d="M24 76 L34 70 L30 66 Z" fill="#94a3b8" />
              <path d="M76 76 L70 66 L66 70 Z" fill="#94a3b8" />
            </svg>
          </div>

          <div
            className="absolute left-1/2 top-1/2 flex h-[46%] w-[46%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-amber-100/30 bg-slate-950/65 text-[0.78rem] font-black text-amber-200"
            style={{
              boxShadow: '0 0 18px rgba(251,191,36,0.18)',
            }}
          >
            {countdown}
          </div>
        </>
      )}
    </div>
  );
}

function TsunamiSprite({
  tsunami,
  animationsEnabled,
}: {
  tsunami: Tsunami;
  animationsEnabled: boolean;
}) {
  const gradientId = `tsunami-gradient-${tsunami.id}`;
  const foamId = `tsunami-foam-${tsunami.id}`;
  const glowOpacity = tsunami.warningMs > 0 ? 0.44 : 0.68;

  return (
    <div
      className="pointer-events-none absolute z-30"
      style={{
        width: '100%',
        height: '100%',
        transform: `translate(-50%, -50%) scaleX(${tsunami.direction === 'right' ? 1 : -1})`,
        opacity: tsunami.warningMs > 0 ? 0.78 : 0.98,
      }}
    >
      <div
        className="absolute inset-[10%] rounded-[50%]"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(186,230,253,0.34), rgba(34,211,238,0.18) 42%, rgba(8,47,73,0) 78%)',
          filter: 'blur(22px)',
          opacity: glowOpacity,
          transform: 'translateY(24%) scale(1.08)',
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          animation: animationsEnabled ? 'game-tsunami-roll 1.7s ease-in-out infinite' : 'none',
          animationDelay: animationsEnabled ? `${tsunami.phase}s` : undefined,
        }}
      >
        <svg className="h-full w-full overflow-visible" viewBox="0 0 360 240" aria-hidden="true">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="55%" x2="100%" y2="20%">
              <stop offset="0%" stopColor="rgba(7,89,133,0.22)" />
              <stop offset="28%" stopColor="rgba(14,165,233,0.56)" />
              <stop offset="60%" stopColor="rgba(186,230,253,0.96)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.92)" />
            </linearGradient>
            <linearGradient id={foamId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.96)" />
              <stop offset="100%" stopColor="rgba(224,242,254,0.2)" />
            </linearGradient>
          </defs>

          <path
            d="M20 188 C64 156 108 152 146 164 C162 98 220 58 286 76 C322 86 340 114 340 178 C312 154 282 146 252 154 C214 164 182 190 150 212 C112 200 72 192 20 188 Z"
            fill="rgba(6,78,118,0.34)"
          />
          <path
            d="M18 182 C52 126 106 88 160 96 C182 44 252 20 308 64 C338 88 346 122 334 166 C304 126 264 120 232 136 C206 148 186 172 170 206 C132 196 84 188 18 182 Z"
            fill={`url(#${gradientId})`}
          />
          <path
            d="M126 86 C168 64 220 58 260 84 C286 100 304 128 310 150 C286 130 262 124 230 132 C198 140 178 160 162 186 C156 152 148 118 126 86 Z"
            fill="rgba(14,116,144,0.32)"
          />
          <path
            d="M162 84 C196 54 248 50 288 80 C314 100 330 130 334 148 C306 128 280 124 246 132 C212 140 190 160 170 192 C174 156 172 118 162 84 Z"
            fill={`url(#${foamId})`}
            style={{
              animation: animationsEnabled ? 'game-tsunami-foam 0.95s ease-in-out infinite' : 'none',
            }}
          />
          <circle cx="284" cy="106" r="11" fill="rgba(255,255,255,0.72)" />
          <circle cx="302" cy="120" r="8" fill="rgba(255,255,255,0.48)" />
          <circle cx="316" cy="136" r="5" fill="rgba(224,242,254,0.38)" />
        </svg>
      </div>
    </div>
  );
}

function DamageBurstLabel({ burst }: { burst: DamageBurst }) {
  const palette =
    burst.tone === 'danger'
      ? {
          background: 'rgba(190,24,93,0.18)',
          border: 'rgba(251,113,133,0.55)',
          text: '#ffe4e6',
          glow: '0 0 28px rgba(251,113,133,0.18)',
        }
      : burst.tone === 'warning'
        ? {
            background: 'rgba(180,83,9,0.18)',
            border: 'rgba(251,191,36,0.55)',
            text: '#fef3c7',
            glow: '0 0 28px rgba(251,191,36,0.18)',
          }
        : burst.tone === 'fire'
          ? {
              background: 'rgba(194,65,12,0.2)',
              border: 'rgba(251,146,60,0.6)',
              text: '#fff7ed',
              glow: '0 0 30px rgba(249,115,22,0.18)',
            }
          : {
              background: 'rgba(8,145,178,0.18)',
              border: 'rgba(125,211,252,0.5)',
              text: '#ecfeff',
              glow: '0 0 28px rgba(103,232,249,0.18)',
            };

  return (
    <div
      className="pointer-events-none absolute z-40"
      style={{
        left: `${burst.x}%`,
        top: `${burst.y}%`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.4, y: 0 }}
        animate={{ opacity: [0, 1, 0], scale: [0.4, 1.12, 1.3], y: -28 }}
        transition={{ duration: 0.85, ease: 'easeOut' }}
        className="rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.18em]"
        style={{
          background: palette.background,
          border: `1px solid ${palette.border}`,
          color: palette.text,
          boxShadow: palette.glow,
          backdropFilter: 'blur(8px)',
        }}
      >
        {burst.label}
      </motion.div>
    </div>
  );
}

function GameOcean({ animationsEnabled }: { animationsEnabled: boolean }) {
  const waveBands = [
    {
      className: 'absolute inset-x-[-18%] top-[1%] h-[14%] overflow-hidden opacity-22',
      primaryClassName: 'fill-cyan-100/8',
      secondaryClassName: 'fill-sky-100/12',
      primaryDuration: 4.4,
      secondaryDuration: 3.7,
      delay: 0.05,
      style: { transform: 'scaleX(1.3)' },
    },
    {
      className: 'absolute inset-x-[-17%] top-[7%] h-[15%] overflow-hidden opacity-26',
      primaryClassName: 'fill-cyan-100/9',
      secondaryClassName: 'fill-sky-200/14',
      primaryDuration: 4,
      secondaryDuration: 3.3,
      delay: 0.24,
      style: { transform: 'scaleX(1.24) translateX(-1%)' },
    },
    {
      className: 'absolute inset-x-[-16%] top-[13%] h-[17%] overflow-hidden opacity-30',
      primaryClassName: 'fill-cyan-100/10',
      secondaryClassName: 'fill-sky-200/16',
      primaryDuration: 3.7,
      secondaryDuration: 3.05,
      delay: 0.12,
      style: { transform: 'scaleX(1.21)' },
    },
    {
      className: 'absolute inset-x-[-15%] top-[20%] h-[18%] overflow-hidden opacity-34',
      primaryClassName: 'fill-cyan-100/11',
      secondaryClassName: 'fill-sky-200/17',
      primaryDuration: 3.35,
      secondaryDuration: 2.8,
      delay: 0.38,
      style: { transform: 'scaleX(1.18) translateX(1%)' },
    },
    {
      className: 'absolute inset-x-[-14%] top-[27%] h-[20%] overflow-hidden opacity-37',
      primaryClassName: 'fill-cyan-100/12',
      secondaryClassName: 'fill-sky-200/18',
      primaryDuration: 3.15,
      secondaryDuration: 2.58,
      delay: 0.18,
      style: { transform: 'scaleX(1.15)' },
    },
    {
      className: 'absolute inset-x-[-13%] top-[35%] h-[21%] overflow-hidden opacity-40',
      primaryClassName: 'fill-cyan-100/13',
      secondaryClassName: 'fill-sky-200/19',
      primaryDuration: 2.95,
      secondaryDuration: 2.42,
      delay: 0.32,
      style: { transform: 'scaleX(1.13) translateX(-1%)' },
    },
    {
      className: 'absolute inset-x-[-12%] top-[44%] h-[23%] overflow-hidden opacity-45',
      primaryClassName: 'fill-cyan-100/15',
      secondaryClassName: 'fill-sky-300/22',
      primaryDuration: 2.72,
      secondaryDuration: 2.2,
      delay: 0.54,
      style: { transform: 'scaleX(1.1)' },
    },
    {
      className: 'absolute inset-x-[-11%] top-[54%] h-[24%] overflow-hidden opacity-49',
      primaryClassName: 'fill-cyan-100/16',
      secondaryClassName: 'fill-sky-300/24',
      primaryDuration: 2.55,
      secondaryDuration: 2.08,
      delay: 0.24,
      style: { transform: 'scaleX(1.08) translateX(1%)' },
    },
    {
      className: 'absolute inset-x-[-10%] top-[64%] h-[26%] overflow-hidden opacity-54',
      primaryClassName: 'fill-cyan-100/18',
      secondaryClassName: 'fill-sky-300/26',
      primaryDuration: 2.42,
      secondaryDuration: 1.96,
      delay: 0.42,
      style: { transform: 'scaleX(1.06)' },
    },
    {
      className: 'absolute inset-x-[-9%] top-[74%] h-[28%] overflow-hidden opacity-60',
      primaryClassName: 'fill-cyan-100/20',
      secondaryClassName: 'fill-sky-300/30',
      primaryDuration: 2.28,
      secondaryDuration: 1.86,
      delay: 0.14,
      style: { transform: 'scaleX(1.04)' },
    },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#0f5f8a_0%,#0b5b8a_18%,#08456d_42%,#063252_68%,#041629_100%)]" />

      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(circle at 50% -10%, rgba(186,230,253,0.34), rgba(186,230,253,0) 35%),
            radial-gradient(circle at 18% 20%, rgba(255,255,255,0.12), rgba(255,255,255,0) 18%),
            radial-gradient(circle at 82% 34%, rgba(255,255,255,0.08), rgba(255,255,255,0) 16%),
            linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0) 26%, rgba(2,6,23,0.22) 100%)
          `,
        }}
      />

      {waveBands.map((band, index) => (
        <BoatWaves
          key={`ocean-wave-${index}`}
          className={band.className}
          primaryClassName={band.primaryClassName}
          secondaryClassName={band.secondaryClassName}
          primaryDuration={band.primaryDuration}
          secondaryDuration={band.secondaryDuration}
          delay={band.delay}
          style={band.style}
          isAnimated={animationsEnabled}
        />
      ))}

      <BoatWaves
        className="absolute inset-x-[-20%] top-[11%] h-[36%] overflow-hidden opacity-16"
        primaryClassName="fill-white/8"
        secondaryClassName="fill-cyan-100/10"
        primaryDuration={5.2}
        secondaryDuration={4.4}
        delay={0.5}
        style={{ transform: 'scaleX(1.34)' }}
        isAnimated={animationsEnabled}
      />

      <BoatWaves
        className="absolute inset-x-[-15%] top-[45%] h-[40%] overflow-hidden opacity-18"
        primaryClassName="fill-white/9"
        secondaryClassName="fill-sky-100/12"
        primaryDuration={4.8}
        secondaryDuration={4}
        delay={0.28}
        style={{ transform: 'scaleX(1.18)' }}
        isAnimated={animationsEnabled}
      />

      <div className="absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0))]" />
      <div className="absolute inset-0 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05),inset_0_-160px_140px_rgba(2,6,23,0.46)]" />
    </div>
  );
}

export function GameSection({ isVisible, onHide, onGameplayActiveChange }: GameSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [startCountdown, setStartCountdown] = useState<number | null>(null);
  const [endReason, setEndReason] = useState<EndReason>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(INITIAL_LIVES);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [boat, setBoat] = useState<BoatPhysics>(createBoat());
  const [sailors, setSailors] = useState<Sailor[]>([]);
  const [sharks, setSharks] = useState<Shark[]>([]);
  const [whirlpools, setWhirlpools] = useState<Whirlpool[]>([]);
  const [bombs, setBombs] = useState<Bomb[]>([]);
  const [tsunami, setTsunami] = useState<Tsunami | null>(null);
  const [damageBursts, setDamageBursts] = useState<DamageBurst[]>([]);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [autoPerformanceMode, setAutoPerformanceMode] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const [isSectionInView, setIsSectionInView] = useState(true);
  const [joystickActive, setJoystickActive] = useState(false);
  const [joystickDirection, setJoystickDirection] = useState<Position>({ x: 0, y: 0 });
  const [boatInvulnerable, setBoatInvulnerable] = useState(false);

  const keysPressed = useRef<Set<string>>(new Set());
  const boatRef = useRef<BoatPhysics>(createBoat());
  const sailorsRef = useRef<Sailor[]>([]);
  const sharksRef = useRef<Shark[]>([]);
  const whirlpoolsRef = useRef<Whirlpool[]>([]);
  const bombsRef = useRef<Bomb[]>([]);
  const tsunamiRef = useRef<Tsunami | null>(null);
  const scoreRef = useRef(0);
  const livesRef = useRef(INITIAL_LIVES);
  const gameLoopRef = useRef<number>();
  const lastFrameTimeRef = useRef<number | null>(null);
  const sailorIdCounter = useRef(0);
  const sharkIdCounter = useRef(0);
  const whirlpoolIdCounter = useRef(0);
  const bombIdCounter = useRef(0);
  const tsunamiIdCounter = useRef(0);
  const burstIdCounter = useRef(0);
  const damageCooldownUntilRef = useRef(0);
  const joystickPointerIdRef = useRef<number | null>(null);
  const joystickActiveRef = useRef(false);
  const joystickDirectionRef = useRef<Position>({ x: 0, y: 0 });
  const gameRunningRef = useRef(false);
  const burstTimeoutsRef = useRef<number[]>([]);
  const damageFlashTimeoutRef = useRef<number>();
  const joystickVisualFrameRef = useRef<number>();

  const showJoystick = isTouchDevice && isMobileDevice;
  const isPerformanceMode = isMobileDevice && autoPerformanceMode;
  const isMobileOptimized = isMobileDevice;
  const maxSailors = isPerformanceMode
    ? PERFORMANCE_MAX_SAILORS
    : isMobileOptimized
      ? MOBILE_MAX_SAILORS
      : DESKTOP_MAX_SAILORS;
  const maxWhirlpools = isPerformanceMode
    ? PERFORMANCE_MAX_WHIRLPOOLS
    : isMobileOptimized
      ? MOBILE_MAX_WHIRLPOOLS
      : DESKTOP_MAX_WHIRLPOOLS;
  const maxBombs = isPerformanceMode
    ? PERFORMANCE_MAX_BOMBS
    : isMobileOptimized
      ? MOBILE_MAX_BOMBS
      : DESKTOP_MAX_BOMBS;
  const mobileOverlayAvoidPoints = showJoystick
    ? [
        { x: 18, y: 84 },
        { x: 87, y: 83 },
      ]
    : [];
  const isPreGameLocked = startCountdown !== null && startCountdown > 0;
  const showStartCountdown = gameStarted && !gameOver && startCountdown !== null;
  const countdownLabel = startCountdown === 0 ? 'AHORA' : startCountdown;
  const animationsEnabled =
    isPageVisible && isSectionInView && !isPerformanceMode && !isPaused && !isPreGameLocked;

  const commitBoat = (nextBoat: BoatPhysics) => {
    boatRef.current = nextBoat;
    setBoat(nextBoat);
  };

  const commitSailors = (nextSailors: Sailor[]) => {
    sailorsRef.current = nextSailors;
    setSailors(nextSailors);
  };

  const commitSharks = (nextSharks: Shark[]) => {
    sharksRef.current = nextSharks;
    setSharks(nextSharks);
  };

  const commitWhirlpools = (nextWhirlpools: Whirlpool[]) => {
    whirlpoolsRef.current = nextWhirlpools;
    setWhirlpools(nextWhirlpools);
  };

  const commitBombs = (nextBombs: Bomb[]) => {
    bombsRef.current = nextBombs;
    setBombs(nextBombs);
  };

  const commitTsunami = (nextTsunami: Tsunami | null) => {
    tsunamiRef.current = nextTsunami;
    setTsunami(nextTsunami);
  };

  const commitScore = (nextScore: number) => {
    scoreRef.current = nextScore;
    setScore(nextScore);
  };

  const commitLives = (nextLives: number) => {
    livesRef.current = nextLives;
    setLives(nextLives);
  };

  const resetControlState = () => {
    joystickPointerIdRef.current = null;
    joystickActiveRef.current = false;
    joystickDirectionRef.current = { x: 0, y: 0 };
    keysPressed.current.clear();

    if (joystickVisualFrameRef.current) {
      cancelAnimationFrame(joystickVisualFrameRef.current);
      joystickVisualFrameRef.current = undefined;
    }

    setJoystickActive(false);
    setJoystickDirection({ x: 0, y: 0 });
  };

  const clearScheduledEffects = () => {
    burstTimeoutsRef.current.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
    burstTimeoutsRef.current = [];

    if (damageFlashTimeoutRef.current) {
      window.clearTimeout(damageFlashTimeoutRef.current);
      damageFlashTimeoutRef.current = undefined;
    }
  };

  const spawnBurst = (x: number, y: number, label: string, tone: DamageBurst['tone']) => {
    const id = burstIdCounter.current;
    burstIdCounter.current += 1;

    setDamageBursts((currentBursts) => [...currentBursts, { id, x, y, label, tone }]);

    const timeoutId = window.setTimeout(() => {
      setDamageBursts((currentBursts) => currentBursts.filter((burst) => burst.id !== id));
    }, 860);

    burstTimeoutsRef.current.push(timeoutId);
  };

  const finishGame = (reason: EndReason) => {
    gameRunningRef.current = false;
    setGameStarted(false);
    setGameOver(true);
    setIsPaused(false);
    setStartCountdown(null);
    setEndReason(reason);
    resetControlState();
    lastFrameTimeRef.current = null;

    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = undefined;
    }
  };

  const applyDamage = (
    source: 'shark' | 'whirlpool' | 'bomb' | 'tsunami',
    contactPoint: Position,
    pushDirection: Position,
  ) => {
    const now = performance.now();
    if (!gameRunningRef.current || now < damageCooldownUntilRef.current) {
      return;
    }

    const previousScore = scoreRef.current;
    const nextScore = Math.max(previousScore - 1, 0);
    const nextLives = Math.max(livesRef.current - 1, 0);
    const pushMagnitude = Math.hypot(pushDirection.x, pushDirection.y) || 1;
    const normalizedPush = {
      x: pushDirection.x / pushMagnitude,
      y: pushDirection.y / pushMagnitude,
    };

    damageCooldownUntilRef.current = now + DAMAGE_COOLDOWN_MS;
    commitScore(nextScore);
    commitLives(nextLives);
    setBoatInvulnerable(true);

    if (damageFlashTimeoutRef.current) {
      window.clearTimeout(damageFlashTimeoutRef.current);
    }

    damageFlashTimeoutRef.current = window.setTimeout(() => {
      setBoatInvulnerable(false);
    }, DAMAGE_COOLDOWN_MS);

    const boatPosition = boatRef.current;
    spawnBurst(clamp(boatPosition.x, 8, 92), clamp(boatPosition.y - 4, 10, 90), '-1 vida', 'danger');

    if (previousScore > 0) {
      spawnBurst(clamp(boatPosition.x, 8, 92), clamp(boatPosition.y - 10, 10, 88), '-1 rescate', 'warning');
    }

    if (source === 'shark') {
      spawnBurst(contactPoint.x, contactPoint.y, 'MORDIDA', 'danger');
    } else if (source === 'whirlpool') {
      spawnBurst(contactPoint.x, contactPoint.y, 'SUCCION', 'water');
    } else if (source === 'tsunami') {
      spawnBurst(contactPoint.x, contactPoint.y, 'TSUNAMI', 'water');
    } else {
      spawnBurst(contactPoint.x, contactPoint.y, 'BOOM', 'fire');
    }

    const recoiledBoat = {
      ...boatPosition,
      x: clamp(boatPosition.x + normalizedPush.x * 4.5, 4, 96),
      y: clamp(boatPosition.y + normalizedPush.y * 4.5, 6, 94),
      velocityX: clamp(boatPosition.velocityX + normalizedPush.x * 0.45, -0.85, 0.85),
      velocityY: clamp(boatPosition.velocityY + normalizedPush.y * 0.45, -0.85, 0.85),
    };

    commitBoat(recoiledBoat);

    if (nextLives <= 0) {
      finishGame('lives');
    }
  };

  const spawnSailor = () => {
    if (!gameRunningRef.current) {
      return;
    }

    const avoid = [
      boatRef.current,
      ...mobileOverlayAvoidPoints,
      ...whirlpoolsRef.current.map(({ x, y }) => ({ x, y })),
      ...bombsRef.current.map(({ x, y }) => ({ x, y })),
    ];

    const newSailor = createSailor(sailorIdCounter.current, avoid);
    sailorIdCounter.current += 1;
    commitSailors([...sailorsRef.current, newSailor]);
  };

  const spawnWhirlpool = () => {
    if (!gameRunningRef.current || whirlpoolsRef.current.length >= maxWhirlpools) {
      return;
    }

    const avoid = [
      boatRef.current,
      ...mobileOverlayAvoidPoints,
      ...whirlpoolsRef.current.map(({ x, y }) => ({ x, y })),
      ...bombsRef.current.map(({ x, y }) => ({ x, y })),
    ];

    const newWhirlpool = createWhirlpool(whirlpoolIdCounter.current, avoid);
    whirlpoolIdCounter.current += 1;
    commitWhirlpools([...whirlpoolsRef.current, newWhirlpool]);
  };

  const spawnBomb = () => {
    if (!gameRunningRef.current || bombsRef.current.length >= maxBombs) {
      return;
    }

    const avoid = [
      boatRef.current,
      ...mobileOverlayAvoidPoints,
      ...whirlpoolsRef.current.map(({ x, y }) => ({ x, y })),
      ...bombsRef.current.filter((bomb) => !bomb.exploded).map(({ x, y }) => ({ x, y })),
    ];

    const newBomb = createBomb(bombIdCounter.current, avoid);
    bombIdCounter.current += 1;
    commitBombs([...bombsRef.current, newBomb]);
  };

  const spawnTsunami = () => {
    if (!gameRunningRef.current || tsunamiRef.current) {
      return;
    }

    const newTsunami = createTsunami(tsunamiIdCounter.current);
    tsunamiIdCounter.current += 1;
    commitTsunami(newTsunami);
    spawnBurst(
      newTsunami.direction === 'right' ? 10 : 90,
      clamp(newTsunami.y, 12, 88),
      'TSUNAMI',
      'water',
    );
  };

  const resetGame = () => {
    gameRunningRef.current = false;
    setGameStarted(false);
    setGameOver(false);
    setIsPaused(false);
    setStartCountdown(null);
    setEndReason(null);
    setTimeLeft(GAME_DURATION);
    commitScore(0);
    commitLives(INITIAL_LIVES);
    commitBoat(createBoat());
    commitSailors([]);
    commitSharks([]);
    commitWhirlpools([]);
    commitBombs([]);
    commitTsunami(null);
    setDamageBursts([]);
    setBoatInvulnerable(false);
    damageCooldownUntilRef.current = 0;
    lastFrameTimeRef.current = null;

    resetControlState();

    sailorIdCounter.current = 0;
    sharkIdCounter.current = 0;
    whirlpoolIdCounter.current = 0;
    bombIdCounter.current = 0;
    tsunamiIdCounter.current = 0;
    burstIdCounter.current = 0;

    clearScheduledEffects();

    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = undefined;
    }
  };

  const startGame = () => {
    clearScheduledEffects();

    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = undefined;
    }

    const initialBoat = createBoat();
    const initialShark = createShark(sharkIdCounter.current);

    gameRunningRef.current = false;
    setGameStarted(true);
    setGameOver(false);
    setIsPaused(false);
    setStartCountdown(GAME_START_COUNTDOWN_SECONDS);
    setEndReason(null);
    setTimeLeft(GAME_DURATION);
    setDamageBursts([]);
    setBoatInvulnerable(false);
    damageCooldownUntilRef.current = 0;
    lastFrameTimeRef.current = null;

    sailorIdCounter.current = 0;
    sharkIdCounter.current = 1;
    whirlpoolIdCounter.current = 0;
    bombIdCounter.current = 0;
    tsunamiIdCounter.current = 0;
    burstIdCounter.current = 0;

    commitScore(0);
    commitLives(INITIAL_LIVES);
    commitBoat(initialBoat);
    commitSailors([]);
    commitSharks([initialShark]);
    commitWhirlpools([]);
    commitBombs([]);
    commitTsunami(null);

    resetControlState();

    const firstSailor = createSailor(sailorIdCounter.current, [
      initialBoat,
      initialShark,
      ...mobileOverlayAvoidPoints,
    ]);
    sailorIdCounter.current += 1;
    commitSailors([firstSailor]);
  };

  const pauseGame = () => {
    if (!gameStarted || gameOver || isPaused || isPreGameLocked) {
      return;
    }

    gameRunningRef.current = false;
    setIsPaused(true);
    lastFrameTimeRef.current = null;
    resetControlState();

    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
      gameLoopRef.current = undefined;
    }
  };

  const resumeGame = () => {
    if (!gameStarted || gameOver || !isPaused || isPreGameLocked) {
      return;
    }

    gameRunningRef.current = true;
    setIsPaused(false);
    lastFrameTimeRef.current = null;
    resetControlState();
  };

  const togglePause = () => {
    if (isPreGameLocked) {
      return;
    }

    if (isPaused) {
      resumeGame();
      return;
    }

    pauseGame();
  };

  useEffect(() => {
    const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    const maxTouchPoints = navigator.maxTouchPoints ?? 0;
    const isTouch = coarsePointer || maxTouchPoints > 0 || 'ontouchstart' in window;
    const userAgent = navigator.userAgent;
    const isMobile = isLikelyMobileDevice(userAgent, maxTouchPoints);

    setIsTouchDevice(isTouch);
    setIsMobileDevice(isMobile);
    setIsAndroid(/Android/i.test(userAgent));
    setAutoPerformanceMode(isMobile && shouldEnableAutoPerformanceMode(userAgent));
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(document.visibilityState !== 'hidden');
    };

    handleVisibilityChange();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const currentSection = sectionRef.current;
    if (!currentSection) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsSectionInView(entry.isIntersecting);
      },
      {
        threshold: 0.12,
      },
    );

    observer.observe(currentSection);

    return () => {
      observer.disconnect();
    };
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) {
      resetGame();
    }
  }, [isVisible]);

  useEffect(() => {
    if (!isAndroid || !joystickActive) {
      return;
    }

    const preventScroll = (event: TouchEvent) => {
      event.preventDefault();
    };

    document.addEventListener('touchmove', preventScroll, { passive: false });

    return () => {
      document.removeEventListener('touchmove', preventScroll);
    };
  }, [isAndroid, joystickActive]);

  useEffect(() => {
    gameRunningRef.current = gameStarted && !gameOver && !isPaused && !isPreGameLocked;

    if (!gameRunningRef.current) {
      lastFrameTimeRef.current = null;
    }
  }, [gameStarted, gameOver, isPaused, isPreGameLocked]);

  useEffect(() => {
    if (startCountdown === null) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setStartCountdown((currentCountdown) => {
        if (currentCountdown === null) {
          return null;
        }

        return currentCountdown <= 0 ? null : currentCountdown - 1;
      });
    }, startCountdown === 0 ? GAME_START_NOW_FLASH_MS : 1000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [startCountdown]);

  useEffect(() => {
    if (!gameStarted || gameOver || isPaused || isPreGameLocked) {
      return;
    }

    const timer = window.setInterval(() => {
      if (!gameRunningRef.current) {
        return;
      }

      setTimeLeft((previousTime) => {
        if (previousTime <= 1) {
          finishGame('time');
          return 0;
        }

        return previousTime - 1;
      });
    }, 1000);

    const sailorSpawner = window.setInterval(() => {
      if (
        sailorsRef.current.length >= maxSailors ||
        Math.random() <=
          (isPerformanceMode
            ? PERFORMANCE_SAILOR_SPAWN_SKIP_CHANCE
            : isMobileOptimized
              ? MOBILE_SAILOR_SPAWN_SKIP_CHANCE
              : DESKTOP_SAILOR_SPAWN_SKIP_CHANCE)
      ) {
        return;
      }

      spawnSailor();
    }, isPerformanceMode
      ? PERFORMANCE_SAILOR_SPAWN_INTERVAL_MS
      : isMobileOptimized
        ? MOBILE_SAILOR_SPAWN_INTERVAL_MS
        : DESKTOP_SAILOR_SPAWN_INTERVAL_MS);

    const whirlpoolSpawner = window.setInterval(() => {
      if (Math.random() <= (isPerformanceMode ? 0.64 : isMobileOptimized ? 0.52 : 0.42)) {
        return;
      }

      spawnWhirlpool();
    }, isPerformanceMode ? 6200 : isMobileOptimized ? 5600 : 4700);

    const bombSpawner = window.setInterval(() => {
      if (Math.random() <= (isPerformanceMode ? 0.56 : isMobileOptimized ? 0.44 : 0.34)) {
        return;
      }

      spawnBomb();
    }, isPerformanceMode ? 4400 : isMobileOptimized ? 3900 : 3200);

    const tsunamiSpawner = window.setInterval(() => {
      if (
        tsunamiRef.current ||
        Math.random() <=
          (isPerformanceMode
            ? PERFORMANCE_TSUNAMI_SPAWN_SKIP_CHANCE
            : isMobileOptimized
              ? MOBILE_TSUNAMI_SPAWN_SKIP_CHANCE
              : DESKTOP_TSUNAMI_SPAWN_SKIP_CHANCE)
      ) {
        return;
      }

      spawnTsunami();
    }, isPerformanceMode
      ? PERFORMANCE_TSUNAMI_SPAWN_INTERVAL_MS
      : isMobileOptimized
        ? MOBILE_TSUNAMI_SPAWN_INTERVAL_MS
        : DESKTOP_TSUNAMI_SPAWN_INTERVAL_MS);

    return () => {
      clearInterval(timer);
      clearInterval(sailorSpawner);
      clearInterval(whirlpoolSpawner);
      clearInterval(bombSpawner);
      clearInterval(tsunamiSpawner);
    };
  }, [gameStarted, gameOver, isPaused, isPreGameLocked, isMobileOptimized, isPerformanceMode, maxSailors]);

  useEffect(() => {
    if (!gameStarted || gameOver) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (event.repeat || isPreGameLocked) {
          return;
        }

        event.preventDefault();
        togglePause();
        return;
      }

      if (isPaused || isPreGameLocked) {
        return;
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
        keysPressed.current.add(event.key);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      keysPressed.current.delete(event.key);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameStarted, gameOver, isPaused, isPreGameLocked]);

  useEffect(() => {
    if (!gameStarted || gameOver || isPaused || isPreGameLocked) {
      return;
    }

    const gameLoop = (timestamp: number) => {
      if (!gameRunningRef.current) {
        return;
      }

      const targetFrameMs = isPerformanceMode
        ? PERFORMANCE_FRAME_MS
        : isMobileOptimized
          ? MOBILE_FRAME_MS
          : DESKTOP_FRAME_MS;
      const previousFrameTimestamp = lastFrameTimeRef.current;

      if (previousFrameTimestamp !== null && timestamp - previousFrameTimestamp < targetFrameMs) {
        gameLoopRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      const previousTimestamp = previousFrameTimestamp ?? timestamp - targetFrameMs;
      const deltaMs = clamp(
        timestamp - previousTimestamp,
        10,
        isPerformanceMode ? 56 : isMobileOptimized ? 50 : 42,
      );
      const deltaFactor = deltaMs / 16.67;
      lastFrameTimeRef.current = timestamp;

      const previousBoat = boatRef.current;
      const currentSailors = sailorsRef.current;
      const currentSharks = sharksRef.current;
      const currentWhirlpools = whirlpoolsRef.current;
      const currentBombs = bombsRef.current;
      const currentTsunami = tsunamiRef.current;
      const currentScore = scoreRef.current;
      const boatAcceleration = getBoatAcceleration(currentScore);
      const boatMaxSpeed = getBoatMaxSpeed(currentScore);
      const sharkAcceleration = getSharkAcceleration(currentScore);
      const sharkMaxSpeed = getSharkMaxSpeed(currentScore);

      let inputX = 0;
      let inputY = 0;

      if (showJoystick && joystickActiveRef.current) {
        inputX = joystickDirectionRef.current.x;
        inputY = joystickDirectionRef.current.y;
      } else {
        if (keysPressed.current.has('ArrowUp')) {
          inputY -= 1;
        }
        if (keysPressed.current.has('ArrowDown')) {
          inputY += 1;
        }
        if (keysPressed.current.has('ArrowLeft')) {
          inputX -= 1;
        }
        if (keysPressed.current.has('ArrowRight')) {
          inputX += 1;
        }
      }

      const nextWhirlpools = currentWhirlpools
        .map((whirlpool) => ({
          ...whirlpool,
          ttlMs: whirlpool.ttlMs - deltaMs,
        }))
        .filter((whirlpool) => whirlpool.ttlMs > 0);

      const nextTsunami =
        currentTsunami === null
          ? null
          : (() => {
              if (currentTsunami.warningMs > 0) {
                return {
                  ...currentTsunami,
                  warningMs: Math.max(currentTsunami.warningMs - deltaMs, 0),
                };
              }

              const nextX = currentTsunami.x + currentTsunami.velocityX * deltaFactor;
              const isOutOfBounds =
                currentTsunami.direction === 'right'
                  ? nextX - currentTsunami.width / 2 > 112
                  : nextX + currentTsunami.width / 2 < -12;

              if (isOutOfBounds) {
                return null;
              }

              return {
                ...currentTsunami,
                x: nextX,
              };
            })();

      const bombExplosions: Bomb[] = [];
      const nextBombs = currentBombs
        .flatMap((bomb) => {
          let nextBombX = bomb.x;
          let nextBombY = bomb.y;
          let nextBombVelocityX = bomb.velocityX;
          let nextBombVelocityY = bomb.velocityY;
          const seaCurrentX =
            Math.sin(timestamp / 1280 + bomb.phase * 3.4) * BOMB_CURRENT_FORCE_X * deltaFactor;
          const seaCurrentY =
            Math.cos(timestamp / 1760 + bomb.phase * 2.2) * BOMB_CURRENT_FORCE_Y * deltaFactor;

          if (!bomb.exploded) {
            nextBombVelocityX = (nextBombVelocityX + seaCurrentX) * Math.pow(0.996, deltaFactor);
            nextBombVelocityY = (nextBombVelocityY + seaCurrentY) * Math.pow(0.996, deltaFactor);
            nextBombX += nextBombVelocityX * deltaFactor;
            nextBombY += nextBombVelocityY * deltaFactor;

            nextWhirlpools.forEach((whirlpool) => {
              const deltaX = whirlpool.x - nextBombX;
              const deltaY = whirlpool.y - nextBombY;
              const distance = Math.hypot(deltaX, deltaY) || 0.001;

              if (distance < whirlpool.radius) {
                const falloff = 1 - distance / whirlpool.radius;
                const suction = whirlpool.strength * 0.72 * falloff * deltaFactor;
                nextBombVelocityX += (deltaX / distance) * suction * 0.28;
                nextBombVelocityY += (deltaY / distance) * suction * 0.28;
                nextBombX += (deltaX / distance) * suction;
                nextBombY += (deltaY / distance) * suction;
              }
            });

            if (nextBombX < 4 || nextBombX > 96) {
              nextBombX = clamp(nextBombX, 4, 96);
              nextBombVelocityX *= -0.78;
            }

            if (nextBombY < 6 || nextBombY > 94) {
              nextBombY = clamp(nextBombY, 6, 94);
              nextBombVelocityY *= -0.72;
            }

            const nextCountdownMs = bomb.countdownMs - deltaMs;
            if (nextCountdownMs <= 0) {
              const explodedBomb = {
                ...bomb,
                x: nextBombX,
                y: nextBombY,
                countdownMs: 0,
                exploded: true,
                explosionElapsedMs: 0,
                velocityX: nextBombVelocityX * 0.55,
                velocityY: nextBombVelocityY * 0.55,
              };

              bombExplosions.push(explodedBomb);
              return [explodedBomb];
            }

            return [
              {
                ...bomb,
                x: nextBombX,
                y: nextBombY,
                countdownMs: nextCountdownMs,
                velocityX: nextBombVelocityX,
                velocityY: nextBombVelocityY,
              },
            ];
          }

          nextBombVelocityX = (nextBombVelocityX + seaCurrentX * 0.55) * Math.pow(0.992, deltaFactor);
          nextBombVelocityY = (nextBombVelocityY + seaCurrentY * 0.55) * Math.pow(0.992, deltaFactor);
          nextBombX += nextBombVelocityX * deltaFactor;
          nextBombY += nextBombVelocityY * deltaFactor;

          if (nextBombX < 4 || nextBombX > 96) {
            nextBombX = clamp(nextBombX, 4, 96);
            nextBombVelocityX *= -0.55;
          }

          if (nextBombY < 6 || nextBombY > 94) {
            nextBombY = clamp(nextBombY, 6, 94);
            nextBombVelocityY *= -0.5;
          }

          const nextExplosionElapsedMs = bomb.explosionElapsedMs + deltaMs;
          if (nextExplosionElapsedMs >= BOMB_EXPLOSION_MS) {
            return [];
          }

          return [
            {
              ...bomb,
              x: nextBombX,
              y: nextBombY,
              velocityX: nextBombVelocityX,
              velocityY: nextBombVelocityY,
              explosionElapsedMs: nextExplosionElapsedMs,
            },
          ];
        })
        .filter(Boolean);

      let nextVelocityX = previousBoat.velocityX + inputX * boatAcceleration * deltaFactor;
      let nextVelocityY = previousBoat.velocityY + inputY * boatAcceleration * deltaFactor;

      nextWhirlpools.forEach((whirlpool) => {
        const deltaX = whirlpool.x - previousBoat.x;
        const deltaY = whirlpool.y - previousBoat.y;
        const distance = Math.hypot(deltaX, deltaY) || 0.001;

        if (distance < whirlpool.radius) {
          const falloff = 1 - distance / whirlpool.radius;
          const suction = whirlpool.strength * 1.45 * falloff * falloff * deltaFactor;
          nextVelocityX += (deltaX / distance) * suction;
          nextVelocityY += (deltaY / distance) * suction;
        }
      });

      nextVelocityX *= Math.pow(0.983, deltaFactor);
      nextVelocityY *= Math.pow(0.983, deltaFactor);

      const speed = Math.hypot(nextVelocityX, nextVelocityY);
      const maxSpeed = boatMaxSpeed;
      if (speed > maxSpeed) {
        const ratio = maxSpeed / speed;
        nextVelocityX *= ratio;
        nextVelocityY *= ratio;
      }

      let nextBoatX = previousBoat.x + nextVelocityX * deltaFactor;
      let nextBoatY = previousBoat.y + nextVelocityY * deltaFactor;

      if (nextBoatX < 0 || nextBoatX > 100) {
        nextBoatX = clamp(nextBoatX, 0, 100);
        nextVelocityX *= -0.45;
      }

      if (nextBoatY < 0 || nextBoatY > 100) {
        nextBoatY = clamp(nextBoatY, 0, 100);
        nextVelocityY *= -0.45;
      }

      const queuedDamage: {
        source: 'shark' | 'whirlpool' | 'bomb' | 'tsunami';
        contactPoint: Position;
        pushDirection: Position;
      } | null = null;

      let pendingDamage = queuedDamage;
      const queueDamage = (
        source: 'shark' | 'whirlpool' | 'bomb' | 'tsunami',
        contactPoint: Position,
        pushDirection: Position,
      ) => {
        if (pendingDamage || timestamp < damageCooldownUntilRef.current) {
          return;
        }

        pendingDamage = {
          source,
          contactPoint,
          pushDirection,
        };
      };

      nextWhirlpools.forEach((whirlpool) => {
        const deltaX = nextBoatX - whirlpool.x;
        const deltaY = nextBoatY - whirlpool.y;
        const distance = Math.hypot(deltaX, deltaY) || 0.001;

        if (distance < whirlpool.coreRadius + 0.8) {
          queueDamage(
            'whirlpool',
            { x: whirlpool.x, y: whirlpool.y },
            { x: deltaX, y: deltaY },
          );
        }
      });

      const nextSharks = currentSharks.map((shark) => {
        const deltaX = nextBoatX - shark.x;
        const deltaY = nextBoatY - shark.y;
        const distance = Math.hypot(deltaX, deltaY) || 1;
        const pursuitX = deltaX / distance;
        const pursuitY = deltaY / distance;
        let nextSharkVelocityX = shark.velocityX + pursuitX * sharkAcceleration * deltaFactor;
        let nextSharkVelocityY = shark.velocityY + pursuitY * sharkAcceleration * deltaFactor;
        nextSharkVelocityX *= Math.pow(SHARK_DRAG, deltaFactor);
        nextSharkVelocityY *= Math.pow(SHARK_DRAG, deltaFactor);

        const sharkSpeed = Math.hypot(nextSharkVelocityX, nextSharkVelocityY);
        if (sharkSpeed > sharkMaxSpeed) {
          const sharkRatio = sharkMaxSpeed / sharkSpeed;
          nextSharkVelocityX *= sharkRatio;
          nextSharkVelocityY *= sharkRatio;
        }

        let nextSharkX = clamp(shark.x + nextSharkVelocityX * deltaFactor, -8, 108);
        let nextSharkY = clamp(shark.y + nextSharkVelocityY * deltaFactor, 4, 96);

        if (nextSharkX === -8 || nextSharkX === 108) {
          nextSharkVelocityX *= -0.35;
        }

        if (nextSharkY === 4 || nextSharkY === 96) {
          nextSharkVelocityY *= -0.35;
        }

        if (distance < SHARK_CONTACT_RADIUS) {
          queueDamage(
            'shark',
            { x: nextSharkX, y: nextSharkY },
            { x: nextBoatX - nextSharkX, y: nextBoatY - nextSharkY },
          );

          nextSharkVelocityX *= 0.82;
          nextSharkVelocityY *= 0.82;
          nextSharkX = clamp(nextSharkX - (deltaX / distance) * 2.2, -8, 108);
          nextSharkY = clamp(nextSharkY - (deltaY / distance) * 2.2, 4, 96);
        }

        return {
          ...shark,
          x: nextSharkX,
          y: nextSharkY,
          velocityX: nextSharkVelocityX,
          velocityY: nextSharkVelocityY,
        };
      });

      let draggedSailors = currentSailors.map((sailor) => {
        let nextSailorX = sailor.x;
        let nextSailorY = sailor.y;

        nextWhirlpools.forEach((whirlpool) => {
          const deltaX = whirlpool.x - nextSailorX;
          const deltaY = whirlpool.y - nextSailorY;
          const distance = Math.hypot(deltaX, deltaY) || 0.001;

          if (distance < whirlpool.radius) {
            const falloff = 1 - distance / whirlpool.radius;
            const suction = whirlpool.strength * 0.9 * falloff * deltaFactor;
            nextSailorX += (deltaX / distance) * suction;
            nextSailorY += (deltaY / distance) * suction;
          }
        });

        return {
          ...sailor,
          x: clamp(nextSailorX, 4, 96),
          y: clamp(nextSailorY, 6, 94),
        };
      });

      draggedSailors = draggedSailors.filter((sailor) => {
        const swallowedByWhirlpool = nextWhirlpools.some(
          (whirlpool) => distanceBetween(sailor, whirlpool) < whirlpool.coreRadius,
        );

        if (swallowedByWhirlpool) {
          spawnBurst(sailor.x, sailor.y, 'PERDIDO', 'water');
          return false;
        }

        const blastedByBomb = bombExplosions.some(
          (bomb) => distanceBetween(sailor, bomb) < bomb.blastRadius,
        );

        if (blastedByBomb) {
          spawnBurst(sailor.x, sailor.y, 'FUERA', 'fire');
          return false;
        }

        return true;
      });

      let remainingWhirlpools = nextWhirlpools;
      let remainingBombs = nextBombs;
      let remainingBombExplosions = bombExplosions;

      if (nextTsunami && nextTsunami.warningMs <= 0) {
        remainingWhirlpools = remainingWhirlpools.filter((whirlpool) => {
          const swallowed = isInsideTsunamiFront(
            whirlpool,
            nextTsunami,
            Math.max(2.2, whirlpool.radius * 0.28),
            Math.max(1.6, whirlpool.radius * 0.18),
          );

          if (swallowed) {
            spawnBurst(whirlpool.x, whirlpool.y, 'ARRASTRE', 'water');
          }

          return !swallowed;
        });

        remainingBombs = remainingBombs.filter((bomb) => {
          const swallowed = isInsideTsunamiFront(bomb, nextTsunami, 3.6, 2.8);

          if (swallowed) {
            spawnBurst(bomb.x, bomb.y, 'HUNDIDA', 'water');
          }

          return !swallowed;
        });

        remainingBombExplosions = remainingBombExplosions.filter((bomb) => {
          const swallowed = isInsideTsunamiFront(bomb, nextTsunami, 4.2, 3.2);

          if (swallowed) {
            spawnBurst(bomb.x, bomb.y, 'ARRASTRE', 'water');
          }

          return !swallowed;
        });

        draggedSailors = draggedSailors.filter((sailor) => {
          const swallowed = isInsideTsunamiFront(sailor, nextTsunami, 2.8, 3.2);

          if (swallowed) {
            spawnBurst(sailor.x, sailor.y, 'TRAGADO', 'water');
          }

          return !swallowed;
        });

        if (
          isInsideTsunamiFront(
            { x: nextBoatX, y: nextBoatY },
            nextTsunami,
            TSUNAMI_BOAT_HITBOX_HORIZONTAL_PADDING,
            TSUNAMI_BOAT_HITBOX_VERTICAL_PADDING,
            TSUNAMI_BOAT_HITBOX_FRONT_WIDTH,
          )
        ) {
          queueDamage(
            'tsunami',
            getTsunamiContactPoint(nextTsunami, nextBoatY),
            getTsunamiPushDirection(nextTsunami, nextBoatY),
          );
        }
      }

      let rescuedCount = 0;
      const remainingSailors = draggedSailors.filter((sailor) => {
        const rescued = Math.hypot(sailor.x - nextBoatX, sailor.y - nextBoatY) < BOAT_RESCUE_RADIUS;

        if (rescued) {
          rescuedCount += 1;
          spawnBurst(sailor.x, sailor.y, '+1 rescate', 'water');
        }

        return !rescued;
      });

      if (rescuedCount > 0) {
        commitScore(scoreRef.current + rescuedCount);
      }

      remainingBombExplosions.forEach((bomb) => {
        if (distanceBetween({ x: nextBoatX, y: nextBoatY }, bomb) < bomb.blastRadius) {
          queueDamage(
            'bomb',
            { x: bomb.x, y: bomb.y },
            { x: nextBoatX - bomb.x, y: nextBoatY - bomb.y },
          );
        }
      });

      remainingBombExplosions.forEach((bomb) => {
        spawnBurst(bomb.x, bomb.y, 'BOOM', 'fire');
      });

      const nextBoat = {
        x: nextBoatX,
        y: nextBoatY,
        velocityX: nextVelocityX,
        velocityY: nextVelocityY,
      };

      commitBoat(nextBoat);
      commitSailors(remainingSailors);
      commitSharks(nextSharks);
      commitWhirlpools(remainingWhirlpools);
      commitBombs(remainingBombs);
      commitTsunami(nextTsunami);

      if (pendingDamage) {
        applyDamage(pendingDamage.source, pendingDamage.contactPoint, pendingDamage.pushDirection);
      }

      if (gameRunningRef.current) {
        gameLoopRef.current = requestAnimationFrame(gameLoop);
      }
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = undefined;
      }
    };
  }, [gameStarted, gameOver, isPaused, isPreGameLocked, isMobileOptimized, isPerformanceMode, showJoystick]);

  const updateJoystickDirection = (clientX: number, clientY: number, bounds: DOMRect) => {
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    const deltaX = clientX - centerX;
    const deltaY = clientY - centerY;
    const distance = Math.hypot(deltaX, deltaY);
    const limitedDistance = Math.min(distance, JOYSTICK_MAX_DISTANCE);
    const normalizedX = distance === 0 ? 0 : deltaX / distance;
    const normalizedY = distance === 0 ? 0 : deltaY / distance;
    const nextDirection = {
      x: (normalizedX * limitedDistance) / JOYSTICK_MAX_DISTANCE,
      y: (normalizedY * limitedDistance) / JOYSTICK_MAX_DISTANCE,
    };

    joystickDirectionRef.current = nextDirection;

    if (joystickVisualFrameRef.current) {
      return;
    }

    joystickVisualFrameRef.current = requestAnimationFrame(() => {
      joystickVisualFrameRef.current = undefined;
      setJoystickDirection(joystickDirectionRef.current);
    });
  };

  const handleJoystickPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();

    joystickPointerIdRef.current = event.pointerId;
    joystickActiveRef.current = true;
    setJoystickActive(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    updateJoystickDirection(
      event.clientX,
      event.clientY,
      event.currentTarget.getBoundingClientRect(),
    );
  };

  const handleJoystickPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!joystickActiveRef.current || joystickPointerIdRef.current !== event.pointerId) {
      return;
    }

    event.preventDefault();
    updateJoystickDirection(
      event.clientX,
      event.clientY,
      event.currentTarget.getBoundingClientRect(),
    );
  };

  const handleJoystickPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (joystickPointerIdRef.current !== null) {
      try {
        event.currentTarget.releasePointerCapture(joystickPointerIdRef.current);
      } catch {
        // Pointer capture may already be released on some devices.
      }
    }

    joystickPointerIdRef.current = null;
    joystickActiveRef.current = false;
    joystickDirectionRef.current = { x: 0, y: 0 };

    if (joystickVisualFrameRef.current) {
      cancelAnimationFrame(joystickVisualFrameRef.current);
      joystickVisualFrameRef.current = undefined;
    }

    setJoystickActive(false);
    setJoystickDirection({ x: 0, y: 0 });
  };

  const handleGameOver = () => {
    setTimeout(() => {
      onHide();
    }, 500);
  };

  useEffect(() => {
    onGameplayActiveChange?.(isVisible && gameStarted && !gameOver);
  }, [gameOver, gameStarted, isVisible, onGameplayActiveChange]);

  if (!isVisible) {
    return null;
  }

  const boatSpeed = Math.hypot(boat.velocityX, boat.velocityY);
  const boatDepthScale = getDepthScale(boat.y);
  const gameOverTitle = endReason === 'lives' ? 'Te quedaste sin vidas' : 'Fin de la mision';
  const isGameplayActive = gameStarted && !gameOver;
  const gameOverCopy =
    endReason === 'lives'
      ? 'El tiburon, los remolinos y las minas te frenaron esta vez. Ajusta la ruta, vuelve al mar y rescata a los perdidos.'
      : '¿Te gusto? ¿Quieres jugar otra vez? Te invitamos a hacerlo ahora pero en la vida real salvando a los perdidos en el mundo. ¡VISITANOS!';

  return (
    <section
      ref={sectionRef}
      id="game"
      className={`bg-[linear-gradient(180deg,#020617_0%,#06172b_48%,#030712_100%)] ${
        isGameplayActive ? 'py-8 md:py-10' : 'py-20'
      }`}
    >
      <div
        className={
          isGameplayActive
            ? 'mx-auto flex min-h-[calc(100vh-6rem)] w-full items-center justify-center px-2 sm:px-4 lg:px-6'
            : 'container mx-auto px-4'
        }
      >
        <div
          className={`overflow-hidden rounded-[32px] border border-cyan-400/15 bg-[#020817] shadow-[0_30px_80px_rgba(2,6,23,0.65)] ${
            isGameplayActive ? 'w-full max-w-[96rem]' : ''
          }`}
        >
          <style>{`
            @keyframes game-rescue-float {
              0%, 100% { transform: translateY(0px); }
              50% { transform: translateY(-5px); }
            }

            @keyframes game-rescue-enter {
              0% { transform: translateY(18px) scale(0.72); opacity: 0; }
              55% { transform: translateY(-7px) scale(1.04); opacity: 1; }
              100% { transform: translateY(0px) scale(1); opacity: 1; }
            }

            @keyframes game-rescue-pulse {
              0% { transform: scale(0.86); opacity: 0.7; }
              100% { transform: scale(1.45); opacity: 0; }
            }

            @keyframes game-rescue-pulse-start {
              0% { transform: scale(0.52); opacity: 0; }
              38% { opacity: 0.82; }
              100% { transform: scale(1.04); opacity: 0.12; }
            }

            @keyframes game-rescue-splash-ring {
              0% { transform: translate(-50%, -50%) scale(0.36); opacity: 0; }
              22% { opacity: 0.95; }
              100% { transform: translate(-50%, -50%) scale(1.55); opacity: 0; }
            }

            @keyframes game-rescue-droplet-left {
              0% { transform: translate(0px, 8px) scale(0.4); opacity: 0; }
              22% { opacity: 1; }
              100% { transform: translate(-18px, -18px) scale(0.9); opacity: 0; }
            }

            @keyframes game-rescue-droplet-right {
              0% { transform: translate(0px, 10px) scale(0.4); opacity: 0; }
              18% { opacity: 1; }
              100% { transform: translate(18px, -16px) scale(0.9); opacity: 0; }
            }

            @keyframes game-shark-glide {
              0%, 100% { transform: translateY(0px) rotate(0deg); }
              50% { transform: translateY(-2px) rotate(-1deg); }
            }

            @keyframes game-whirlpool-spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }

            @keyframes game-bomb-pulse {
              0%, 100% { transform: scale(0.96); opacity: 0.75; }
              50% { transform: scale(1.08); opacity: 1; }
            }

            @keyframes game-hit-ring {
              0% { transform: scale(0.82); opacity: 0.7; }
              100% { transform: scale(1.18); opacity: 0; }
            }

            @keyframes game-tsunami-roll {
              0%, 100% { transform: translateY(0px) rotate(0deg); }
              50% { transform: translateY(-4px) rotate(-1.4deg); }
            }

            @keyframes game-tsunami-foam {
              0%, 100% { transform: translateY(0px) scale(1); opacity: 0.88; }
              50% { transform: translateY(-3px) scale(1.04); opacity: 1; }
            }
          `}</style>

          {!gameStarted && !gameOver && (
            <div className="relative overflow-hidden px-6 py-10 text-center md:px-12 md:py-14">
              <div
                className="absolute inset-0"
                style={{
                  background: `
                    radial-gradient(circle at top, rgba(34,211,238,0.18), transparent 36%),
                    radial-gradient(circle at 80% 16%, rgba(59,130,246,0.16), transparent 28%),
                    linear-gradient(180deg, rgba(7,89,133,0.24), rgba(2,6,23,0))
                  `,
                }}
              />

              <div className="relative mx-auto max-w-3xl text-white">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/8 px-4 py-2 text-sm uppercase tracking-[0.24em] text-cyan-200">
                  Mini juego arcade
                </div>

                <h2 className="mt-6 text-4xl font-semibold md:text-5xl">
                  Rescate en el Mar
                </h2>

                <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-300 md:text-xl">
                  Pilota una barca de rescate, salva a todas las personas que puedas y sobrevive al
                  tiburon, los remolinos, las minas y los tsunamis antes de que se acabe el
                  tiempo.
                </p>


                <button
                  onClick={startGame}
                  className="mt-10 rounded-2xl bg-[linear-gradient(135deg,#22d3ee_0%,#0ea5e9_45%,#2563eb_100%)] px-8 py-4 text-lg font-semibold text-white shadow-[0_18px_50px_rgba(14,165,233,0.35)] transition-transform duration-300 hover:scale-[1.02]"
                >
                  Comenzar aventura
                </button>

                <div className="mt-10 grid gap-4 text-left md:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/6 p-5 backdrop-blur-md">
                    <Move className="h-7 w-7 text-cyan-300" />
                    <h3 className="mt-4 text-lg font-medium text-white">Control</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      Usa las flechas del teclado{showJoystick ? ' o el joystick tactil' : ''} para
                      mover la barca con suavidad. Tambien puedes pausar con Esc o con el boton de
                      pausa.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/6 p-5 backdrop-blur-md">
                    <LifeBuoy className="h-7 w-7 text-cyan-300" />
                    <h3 className="mt-4 text-lg font-medium text-white">Riesgos</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      El tiburon te persigue, los remolinos absorben todo lo cercano y las minas
                      explotan a los 3 segundos. A veces aparece un tsunami que arrasa de izquierda
                      a derecha o al reves.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/6 p-5 backdrop-blur-md">
                    <Heart className="h-7 w-7 text-rose-300" />
                    <h3 className="mt-4 text-lg font-medium text-white">Supervivencia</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      Tienes {INITIAL_LIVES} vidas. Cada golpe te quita una vida y un rescate de tu
                      marcador.
                    </p>
                  </div>
                </div>

                
              </div>
            </div>
          )}

          {gameStarted && (
            <div className="relative">
              <div
                className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 bg-slate-950/80 px-4 py-4 text-white backdrop-blur-xl md:px-5"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-center gap-3 rounded-full border border-cyan-300/18 bg-cyan-300/8 px-4 py-2">
                    <Timer className="h-5 w-5 text-cyan-300" />
                    <span className="text-xl font-semibold">{timeLeft}s</span>
                  </div>

                  <div className="inline-flex items-center gap-3 rounded-full border border-cyan-300/18 bg-cyan-300/8 px-4 py-2">
                    <Trophy className="h-5 w-5 text-amber-300" />
                    <span className="text-xl font-semibold">{score} rescatados</span>
                  </div>

                  <div className="inline-flex items-center gap-3 rounded-full border border-rose-300/18 bg-rose-300/8 px-4 py-2">
                    <Heart className="h-5 w-5 text-rose-300" />
                    <div className="flex items-center gap-2">
                      {Array.from({ length: INITIAL_LIVES }).map((_, index) => (
                        <span
                          key={`life-${index}`}
                          className={`h-3.5 w-3.5 rounded-full border ${
                            index < lives
                              ? 'border-rose-200 bg-rose-400 shadow-[0_0_14px_rgba(251,113,133,0.42)]'
                              : 'border-slate-600 bg-slate-800'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="hidden text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 md:inline">
                    Esc pausa
                  </span>
                  <button
                    onClick={togglePause}
                    disabled={isPreGameLocked}
                    className={`inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-white/8 px-4 py-2 text-sm font-semibold text-white transition-colors ${
                      isPreGameLocked ? 'cursor-not-allowed opacity-60' : 'hover:bg-white/12'
                    }`}
                    aria-label={
                      isPreGameLocked
                        ? 'Cuenta regresiva antes de iniciar'
                        : isPaused
                          ? 'Continuar juego'
                          : 'Pausar juego'
                    }
                    aria-pressed={isPaused}
                  >
                    {isPreGameLocked ? (
                      <Timer className="h-4 w-4 text-cyan-300" />
                    ) : isPaused ? (
                      <Play className="h-4 w-4 text-cyan-300" />
                    ) : (
                      <Pause className="h-4 w-4 text-cyan-300" />
                    )}
                    <span>
                      {isPreGameLocked ? 'Espera' : isPaused ? 'Continuar' : 'Pausar'}
                    </span>
                  </button>
                </div>
              </div>

              <div
                className="relative overflow-hidden bg-[#020b19]"
                style={{
                  height: isMobileDevice
                    ? 'clamp(450px, 72vh, 640px)'
                    : 'clamp(540px, 76vh, 780px)',
                  overscrollBehavior: 'contain',
                  touchAction: showJoystick ? 'none' : 'auto',
                }}
              >
                <GameOcean animationsEnabled={animationsEnabled} />

                {tsunami && (
                  <div className="pointer-events-none absolute inset-x-0 top-4 z-40 flex justify-center px-4">
                    <div className="rounded-full border border-cyan-100/24 bg-slate-950/65 px-4 py-2 text-[11px] font-black uppercase tracking-[0.24em] text-cyan-100 shadow-[0_12px_30px_rgba(8,145,178,0.18)] backdrop-blur-xl md:text-xs">
                      {tsunami.warningMs > 0
                        ? `Tsunami entrando por la ${
                            tsunami.direction === 'right' ? 'izquierda' : 'derecha'
                          }`
                        : `Tsunami arrasando hacia la ${
                            tsunami.direction === 'right' ? 'derecha' : 'izquierda'
                          }`}
                    </div>
                  </div>
                )}

                {whirlpools.map((whirlpool) => (
                  <div
                    key={whirlpool.id}
                    className="absolute"
                    style={{
                      left: `${whirlpool.x}%`,
                      top: `${whirlpool.y}%`,
                    }}
                  >
                    <WhirlpoolSprite
                      radius={whirlpool.radius}
                      depthScale={getDepthScale(whirlpool.y)}
                      ttlMs={whirlpool.ttlMs}
                      phase={whirlpool.phase}
                    />
                  </div>
                ))}

                {bombs.map((bomb) => (
                  <div
                    key={bomb.id}
                    className="absolute"
                    style={{
                      left: `${bomb.x}%`,
                      top: `${bomb.y}%`,
                    }}
                  >
                    <BombSprite
                      bomb={bomb}
                      depthScale={getDepthScale(bomb.y) * 0.92}
                      animationsEnabled={animationsEnabled}
                    />
                  </div>
                ))}

                {sailors.map((sailor) => (
                  <div
                    key={sailor.id}
                    className="absolute"
                    style={{
                      left: `${sailor.x}%`,
                      top: `${sailor.y}%`,
                    }}
                  >
                    <RescueTarget
                      phase={sailor.phase}
                      depthScale={getDepthScale(sailor.y) * 0.92}
                      animationsEnabled={animationsEnabled}
                    />
                  </div>
                ))}

                {sharks.map((shark) => (
                  <div
                    key={shark.id}
                    className="absolute"
                    style={{
                      left: `${shark.x}%`,
                      top: `${shark.y}%`,
                    }}
                  >
                    <SharkSprite
                      velocityX={shark.velocityX}
                      velocityY={shark.velocityY}
                      depthScale={getDepthScale(clamp(shark.y, 0, 100)) * 0.98}
                      phase={shark.phase}
                      animationsEnabled={animationsEnabled}
                    />
                  </div>
                ))}

                {tsunami && (
                  <div
                    className="absolute"
                    style={{
                      left: `${tsunami.x}%`,
                      top: `${tsunami.y}%`,
                      width: `${tsunami.width}%`,
                      height: `${tsunami.height}%`,
                    }}
                  >
                    <TsunamiSprite tsunami={tsunami} animationsEnabled={animationsEnabled} />
                  </div>
                )}

                <div
                  className="absolute"
                  style={{
                    left: `${boat.x}%`,
                    top: `${boat.y}%`,
                  }}
                >
                  <BoatSprite
                    speed={boatSpeed}
                    depthScale={boatDepthScale}
                    isInvulnerable={boatInvulnerable}
                    animationsEnabled={animationsEnabled}
                  />
                </div>

                {damageBursts.map((burst) => (
                  <DamageBurstLabel key={burst.id} burst={burst} />
                ))}

                <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06),inset_0_-140px_120px_rgba(2,6,23,0.54)]" />

                {showStartCountdown && (
                  <div className="pointer-events-none absolute inset-0 z-[60] flex items-center justify-center bg-slate-950/38 px-4 backdrop-blur-[3px]">
                    <div className="w-full max-w-md rounded-[32px] border border-cyan-200/18 bg-slate-950/76 px-8 py-10 text-center text-white shadow-[0_28px_80px_rgba(2,6,23,0.55)] backdrop-blur-xl">
                      <p className="text-[11px] font-black uppercase tracking-[0.42em] text-cyan-200">
                        Preparate
                      </p>
                      <div
                        className={`mt-5 text-6xl font-black tracking-[0.18em] md:text-8xl ${
                          startCountdown === 0 ? 'text-amber-300' : 'text-white'
                        }`}
                      >
                        {countdownLabel}
                      </div>
                      <p className="mt-4 text-sm uppercase tracking-[0.24em] text-slate-300 md:text-base">
                        {startCountdown === 0
                          ? 'Ahora si, a rescatar'
                          : 'La mision arranca en segundos'}
                      </p>
                    </div>
                  </div>
                )}

                {isPaused && (
                  <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-[30px] border border-cyan-300/18 bg-slate-950/78 p-6 text-center text-white shadow-[0_24px_60px_rgba(2,6,23,0.45)] backdrop-blur-xl">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-cyan-300/24 bg-cyan-300/10">
                        <Pause className="h-6 w-6 text-cyan-300" />
                      </div>
                      <h3 className="mt-4 text-3xl font-semibold">Juego en pausa</h3>
                      <p className="mt-3 text-sm leading-6 text-slate-300 md:text-base">
                        {showJoystick
                          ? 'Toca continuar o usa el boton de pausa para volver al mar.'
                          : 'Presiona Esc o toca continuar para seguir rescatando personas.'}
                      </p>
                      <button
                        onClick={resumeGame}
                        className="mt-6 inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#22d3ee_0%,#0ea5e9_45%,#2563eb_100%)] px-6 py-3 text-base font-semibold text-white shadow-[0_18px_50px_rgba(14,165,233,0.28)] transition-transform duration-300 hover:scale-[1.02]"
                      >
                        <Play className="h-4 w-4" />
                        Continuar juego
                      </button>
                    </div>
                  </div>
                )}

                {showJoystick && (
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 px-4 pb-4 md:px-6">
                    <div className="pointer-events-none rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3 text-left text-xs uppercase tracking-[0.18em] text-slate-200 backdrop-blur-xl">
                      <p>Modo movil</p>
                      <p className="mt-1 text-[11px] tracking-[0.12em] text-slate-400">
                        Arrastra el joystick para navegar
                      </p>
                    </div>

                    <div
                      className="relative h-36 w-36 shrink-0 rounded-full border border-white/14 bg-slate-950/50 shadow-[0_18px_45px_rgba(2,6,23,0.5)] backdrop-blur-xl"
                      style={{ touchAction: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
                      onPointerDown={handleJoystickPointerDown}
                      onPointerMove={handleJoystickPointerMove}
                      onPointerUp={handleJoystickPointerEnd}
                      onPointerCancel={handleJoystickPointerEnd}
                      onContextMenu={(event) => event.preventDefault()}
                      aria-label="Joystick tactil"
                    >
                      <div className="absolute inset-3 rounded-full border border-cyan-200/14" />
                      <div
                        className="absolute left-1/2 top-1/2 h-[70px] w-[70px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10"
                        style={{
                          background:
                            'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.14), rgba(15,23,42,0.06) 65%, rgba(15,23,42,0) 100%)',
                        }}
                      />
                      <div
                        className="absolute left-1/2 top-1/2 h-[56px] w-[56px] rounded-full border border-white/30 bg-[linear-gradient(180deg,rgba(186,230,253,0.95),rgba(56,189,248,0.78))] shadow-[0_10px_30px_rgba(34,211,238,0.28)] transition-transform duration-75"
                        style={{
                          transform: `translate(calc(-50% + ${joystickDirection.x * JOYSTICK_MAX_DISTANCE}px), calc(-50% + ${joystickDirection.y * JOYSTICK_MAX_DISTANCE}px))`,
                        }}
                      />
                      <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.12),rgba(34,211,238,0)_70%)]" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {gameOver && (
            <div className="relative overflow-hidden px-6 py-10 text-center md:px-12 md:py-14">
              <div
                className="absolute inset-0"
                style={{
                  background: `
                    radial-gradient(circle at 50% 0%, rgba(34,211,238,0.18), transparent 36%),
                    linear-gradient(180deg, rgba(12,74,110,0.2), rgba(2,6,23,0))
                  `,
                }}
              />

              <div className="relative mx-auto max-w-2xl text-white">
                <h2 className="text-4xl font-semibold md:text-5xl">{gameOverTitle}</h2>

                <div className="mt-8 rounded-[28px] border border-white/10 bg-white/6 p-8 backdrop-blur-xl">
                  <p className="text-lg text-slate-300">Resultado final</p>
                  <p className="mt-3 text-4xl font-semibold text-white">
                    {score} {score === 1 ? 'persona rescatada' : 'personas rescatadas'}
                  </p>
                  <p className="mt-5 text-base leading-7 text-slate-300">
                    {endReason === 'lives' ? (
                      <>
                        El tiburon, los remolinos y las minas te frenaron esta vez. Ajusta la
                        ruta, vuelve al mar y rescata a los{' '}
                        <strong className="text-cyan-600 dark:text-cyan-400">
                          PERDIDOS EN EL MAR
                        </strong>
                        .
                      </>
                    ) : (
                      <>
                        ¿Te gusto? ¿Quieres jugar otra vez? Te invitamos a hacerlo ahora pero en
                        la vida real salvando a los{' '}
                        <strong className="text-cyan-600 dark:text-cyan-400">
                          perdidos en el mundo
                        </strong>
                        . ¡VISITANOS!
                      </>
                    )}
                  </p>
                </div>

                <div className="mt-8 flex flex-wrap justify-center gap-4">
                  <button
                    onClick={startGame}
                    className="rounded-2xl bg-[linear-gradient(135deg,#22d3ee_0%,#0ea5e9_45%,#2563eb_100%)] px-6 py-3 text-lg font-semibold text-white shadow-[0_18px_50px_rgba(14,165,233,0.28)] transition-transform duration-300 hover:scale-[1.02]"
                  >
                    Jugar de nuevo
                  </button>

                  <button
                    onClick={() => {
                      const element = document.getElementById('localizacion');
                      if (element) {
                        handleGameOver();
                        setTimeout(() => {
                          element.scrollIntoView({ behavior: 'smooth' });
                        }, 600);
                      }
                    }}
                    className="rounded-2xl border border-emerald-300/18 bg-[linear-gradient(135deg,rgba(16,185,129,0.22),rgba(5,150,105,0.32))] px-6 py-3 text-lg font-semibold text-white transition-transform duration-300 hover:scale-[1.02]"
                  >
                    Ver ubicacion
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

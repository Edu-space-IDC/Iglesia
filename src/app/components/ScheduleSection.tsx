import { motion } from 'motion/react';
import { Calendar, Clock, Timer, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useInView } from './useInView';

const COLOMBIA_TIME_ZONE = 'America/Bogota';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

interface ScheduleItem {
  dayLabel: string;
  dayName: string;
  dayOfWeek: number;
  time: string;
  service: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  icon: LucideIcon;
}

interface ColombiaClockParts {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hour: number;
  minute: number;
  second: number;
}

interface RemainingParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

interface ScheduleCountdownState {
  isLive: boolean;
  currentService: ScheduleItem | null;
  nextService: ScheduleItem;
  remaining: RemainingParts;
  countdownLabel: string;
  headline: string;
  supportingText: string;
  currentTimeLabel: string;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const COLOMBIA_PARTS_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: COLOMBIA_TIME_ZONE,
  weekday: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const COLOMBIA_NOW_FORMATTER = new Intl.DateTimeFormat('es-CO', {
  timeZone: COLOMBIA_TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
});

const SCHEDULES: ScheduleItem[] = [
  {
    dayLabel: 'Mi\u00e9rcoles',
    dayName: 'mi\u00e9rcoles',
    dayOfWeek: 3,
    time: '7:00 PM - 8:30 PM',
    service: 'Culto y reuni\u00f3n de l\u00edderes',
    startHour: 19,
    startMinute: 0,
    endHour: 20,
    endMinute: 30,
    icon: Calendar,
  },
  {
    dayLabel: 'S\u00e1bado',
    dayName: 's\u00e1bado',
    dayOfWeek: 6,
    time: '7:00 PM - 8:30 PM',
    service: 'Reuni\u00f3n de J\u00f3venes',
    startHour: 19,
    startMinute: 0,
    endHour: 20,
    endMinute: 30,
    icon: Clock,
  },
  {
    dayLabel: 'Domingo',
    dayName: 'domingo',
    dayOfWeek: 0,
    time: '8:30 AM - 10:30 AM',
    service: 'Culto familiar',
    startHour: 8,
    startMinute: 30,
    endHour: 10,
    endMinute: 30,
    icon: Calendar,
  },
];

function readPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPart['type']) {
  return parts.find((part) => part.type === type)?.value ?? '0';
}

function getColombiaClockParts(now: Date): ColombiaClockParts {
  const parts = COLOMBIA_PARTS_FORMATTER.formatToParts(now);
  const weekdayToken = readPart(parts, 'weekday');

  return {
    year: Number(readPart(parts, 'year')),
    month: Number(readPart(parts, 'month')),
    day: Number(readPart(parts, 'day')),
    weekday: WEEKDAY_INDEX[weekdayToken] ?? 0,
    hour: Number(readPart(parts, 'hour')),
    minute: Number(readPart(parts, 'minute')),
    second: Number(readPart(parts, 'second')),
  };
}

function toWallClockMs(clock: ColombiaClockParts) {
  return Date.UTC(clock.year, clock.month - 1, clock.day, clock.hour, clock.minute, clock.second);
}

function formatServiceTime(hour: number, minute: number) {
  const meridiem = hour >= 12 ? 'p. m.' : 'a. m.';
  const twelveHour = hour % 12 === 0 ? 12 : hour % 12;

  return `${twelveHour}:${String(minute).padStart(2, '0')} ${meridiem}`;
}

function getRemainingParts(remainingMs: number): RemainingParts {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds };
}

function capitalizeText(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getScheduleCountdownState(now = new Date()): ScheduleCountdownState {
  const clock = getColombiaClockParts(now);
  const currentWallClockMs = toWallClockMs(clock);
  const currentTimeLabel = capitalizeText(COLOMBIA_NOW_FORMATTER.format(now));

  let currentService: ScheduleItem | null = null;
  let currentServiceEndMs = 0;
  let nextService = SCHEDULES[0];
  let nextServiceStartMs = Number.POSITIVE_INFINITY;

  for (const schedule of SCHEDULES) {
    if (schedule.dayOfWeek === clock.weekday) {
      const todayStartMs = Date.UTC(
        clock.year,
        clock.month - 1,
        clock.day,
        schedule.startHour,
        schedule.startMinute,
        0,
      );
      const todayEndMs = Date.UTC(
        clock.year,
        clock.month - 1,
        clock.day,
        schedule.endHour,
        schedule.endMinute,
        0,
      );

      if (currentWallClockMs >= todayStartMs && currentWallClockMs < todayEndMs) {
        currentService = schedule;
        currentServiceEndMs = todayEndMs;
      }
    }

    const daysUntilService = (schedule.dayOfWeek - clock.weekday + 7) % 7;
    let candidateStartMs = Date.UTC(
      clock.year,
      clock.month - 1,
      clock.day + daysUntilService,
      schedule.startHour,
      schedule.startMinute,
      0,
    );

    if (daysUntilService === 0 && candidateStartMs <= currentWallClockMs) {
      candidateStartMs += WEEK_MS;
    }

    if (candidateStartMs < nextServiceStartMs) {
      nextService = schedule;
      nextServiceStartMs = candidateStartMs;
    }
  }

  if (currentService) {
    const remainingMs = currentServiceEndMs - currentWallClockMs;

    return {
      isLive: true,
      currentService,
      nextService,
      remaining: getRemainingParts(remainingMs),
      countdownLabel: 'Termina en',
      headline: `Estamos en ${currentService.service}`,
      supportingText: `Finaliza a las ${formatServiceTime(
        currentService.endHour,
        currentService.endMinute,
      )}. Despu\u00e9s sigue ${nextService.service} el ${nextService.dayName} a las ${formatServiceTime(
        nextService.startHour,
        nextService.startMinute,
      )}.`,
      currentTimeLabel,
    };
  }

  const remainingMs = nextServiceStartMs - currentWallClockMs;

  return {
    isLive: false,
    currentService: null,
    nextService,
    remaining: getRemainingParts(remainingMs),
    countdownLabel: 'Falta para el pr\u00f3ximo servicio',
    headline: nextService.service,
    supportingText: `Pr\u00f3xima reuni\u00f3n: ${nextService.dayLabel} a las ${formatServiceTime(
      nextService.startHour,
      nextService.startMinute,
    )}`,
    currentTimeLabel,
  };
}

function CountdownCard({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-white/12 bg-white/8 px-4 py-4 text-center shadow-[0_16px_40px_rgba(8,47,73,0.22)] backdrop-blur-md">
      <div className="text-3xl font-semibold text-white md:text-4xl">
        {String(value).padStart(2, '0')}
      </div>
      <div className="mt-2 text-xs uppercase tracking-[0.24em] text-cyan-100/75">{label}</div>
    </div>
  );
}

export function ScheduleSection() {
  const { ref, isInView } = useInView();
  const [countdownState, setCountdownState] = useState<ScheduleCountdownState>(() =>
    getScheduleCountdownState(),
  );

  useEffect(() => {
    const updateCountdown = () => {
      setCountdownState(getScheduleCountdownState());
    };

    updateCountdown();

    const intervalId = window.setInterval(updateCountdown, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <section id="horarios" className="bg-white py-20 dark:bg-gray-800">
      <div className="container mx-auto px-4">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 50 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="mb-6 text-center text-4xl text-gray-900 dark:text-white md:text-5xl">
            Nuestros Horarios
          </h2>

          

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.6, delay: 0.12 }}
            className="mx-auto mb-12 max-w-6xl overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,#082f49_0%,#0f172a_45%,#172554_100%)] p-6 text-white shadow-[0_30px_80px_rgba(8,47,73,0.28)] md:p-8"
          >
            <div className="grid gap-8 lg:grid-cols-[1.15fr_0.95fr] lg:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/18 bg-cyan-300/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
                  <Clock className="h-4 w-4" />
                  Hora de Colombia
                </div>

                <div className="mt-6 flex items-start gap-4">
                  <div
                    className={`rounded-2xl p-3 ${
                      countdownState.isLive
                        ? 'bg-emerald-400/14 text-emerald-200'
                        : 'bg-cyan-300/12 text-cyan-100'
                    }`}
                  >
                    <Timer className="h-7 w-7" />
                  </div>

                  <div>
                    <p className="text-sm uppercase tracking-[0.28em] text-cyan-100/70">
                      {countdownState.isLive ? 'En reuni\u00f3n ahora' : 'Pr\u00f3ximo servicio'}
                    </p>
                    <h3 className="mt-3 text-3xl font-semibold leading-tight md:text-4xl">
                      {countdownState.headline}
                    </h3>
                  </div>
                </div>

                <p className="mt-5 max-w-2xl text-base leading-7 text-cyan-50/85 md:text-lg">
                  {countdownState.supportingText}
                </p>

                <div className="mt-6 inline-flex rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm text-cyan-50/90 backdrop-blur-md">
                  Hora actual en Colombia: {countdownState.currentTimeLabel}
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/8 p-5 backdrop-blur-md">
                <p className="text-center text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100/75">
                  {countdownState.countdownLabel}
                </p>

                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <CountdownCard value={countdownState.remaining.days} label="Dias" />
                  <CountdownCard value={countdownState.remaining.hours} label="Horas" />
                  <CountdownCard value={countdownState.remaining.minutes} label="Minutos" />
                  <CountdownCard value={countdownState.remaining.seconds} label="Segundos" />
                </div>

                <p className="mt-5 text-center text-sm leading-6 text-cyan-50/75">
                  {countdownState.isLive
                    ? `Cuando termine, el contador cambiar\u00e1 solo al siguiente servicio: ${countdownState.nextService.service}.`
                    : `El siguiente servicio ser\u00e1 ${countdownState.nextService.service}.`}
                </p>
              </div>
            </div>
          </motion.div>

          <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
            {SCHEDULES.map((schedule, index) => (
              <motion.div
                key={schedule.service}
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                className="rounded-xl bg-gradient-to-br from-cyan-50 to-blue-50 p-8 text-center shadow-lg transition-shadow hover:shadow-xl dark:from-gray-700 dark:to-gray-600"
              >
                <schedule.icon className="mx-auto mb-4 h-12 w-12 text-cyan-600 dark:text-cyan-400" />
                <h3 className="mb-2 text-2xl text-gray-900 dark:text-white">{schedule.dayLabel}</h3>
                <p className="mb-2 text-lg text-cyan-600 dark:text-cyan-400">{schedule.time}</p>
                <p className="text-gray-600 dark:text-gray-300">{schedule.service}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

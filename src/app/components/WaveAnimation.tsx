export function WaveAnimation({ className = "" }: { className?: string }) {
  return (
    <div className={`absolute inset-x-0 ${className}`}>
      <svg className="w-full h-full" viewBox="0 0 1200 120" preserveAspectRatio="none">
        <path
          d="M0,50 C150,80 350,0 600,50 C850,100 1050,20 1200,50 L1200,120 L0,120 Z"
          className="fill-cyan-500/20 dark:fill-cyan-400/10"
        >
          <animate
            attributeName="d"
            dur="10s"
            repeatCount="indefinite"
            values="
              M0,50 C150,80 350,0 600,50 C850,100 1050,20 1200,50 L1200,120 L0,120 Z;
              M0,30 C150,50 350,70 600,30 C850,0 1050,80 1200,30 L1200,120 L0,120 Z;
              M0,50 C150,80 350,0 600,50 C850,100 1050,20 1200,50 L1200,120 L0,120 Z
            "
          />
        </path>
        <path
          d="M0,70 C200,90 400,50 600,70 C800,90 1000,50 1200,70 L1200,120 L0,120 Z"
          className="fill-cyan-400/30 dark:fill-cyan-500/20"
        >
          <animate
            attributeName="d"
            dur="8s"
            repeatCount="indefinite"
            values="
              M0,70 C200,90 400,50 600,70 C800,90 1000,50 1200,70 L1200,120 L0,120 Z;
              M0,60 C200,40 400,80 600,60 C800,40 1000,80 1200,60 L1200,120 L0,120 Z;
              M0,70 C200,90 400,50 600,70 C800,90 1000,50 1200,70 L1200,120 L0,120 Z
            "
          />
        </path>
        <path
          d="M0,90 C250,100 450,80 600,90 C750,100 950,80 1200,90 L1200,120 L0,120 Z"
          className="fill-cyan-500/40 dark:fill-cyan-600/30"
        >
          <animate
            attributeName="d"
            dur="6s"
            repeatCount="indefinite"
            values="
              M0,90 C250,100 450,80 600,90 C750,100 950,80 1200,90 L1200,120 L0,120 Z;
              M0,80 C250,70 450,100 600,80 C750,70 950,100 1200,80 L1200,120 L0,120 Z;
              M0,90 C250,100 450,80 600,90 C750,100 950,80 1200,90 L1200,120 L0,120 Z
            "
          />
        </path>
      </svg>
    </div>
  );
}

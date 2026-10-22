import { createPortal } from 'react-dom';

const STARS = Array.from({ length: 48 }, (_, index) => {
  const left = ((index * 47) % 100) + (index % 7) * 0.3;
  const top = ((index * 29) % 62) + (index % 5) * 0.4;
  const size = 1.2 + (index % 4) * 0.7;
  const delay = ((index * 0.37) % 4).toFixed(2);
  const duration = (2.4 + (index % 5) * 0.55).toFixed(2);
  return { left: `${left}%`, top: `${top}%`, size, delay, duration };
});

const CLOUDS = [
  { top: '8%', width: 280, duration: 85, delay: 0, opacity: 0.42 },
  { top: '16%', width: 360, duration: 110, delay: -20, opacity: 0.36 },
  { top: '24%', width: 240, duration: 95, delay: -45, opacity: 0.45 },
  { top: '12%', width: 320, duration: 130, delay: -70, opacity: 0.32 },
  { top: '30%', width: 200, duration: 75, delay: -15, opacity: 0.4 },
];

export function ResultsNightScene() {
  return createPortal(
    <div className="results-night-scene" aria-hidden="true">
      <div className="night-sky" />

      <div className="night-stars">
        {STARS.map((star, index) => (
          <span
            key={index}
            className="night-star"
            style={{
              left: star.left,
              top: star.top,
              width: star.size,
              height: star.size,
              animationDelay: `${star.delay}s`,
              animationDuration: `${star.duration}s`,
            }}
          />
        ))}
      </div>

      <div className="night-moon">
        <span className="moon-glow" />
        <span className="moon-disk">
          <span className="moon-crater c1" />
          <span className="moon-crater c2" />
          <span className="moon-crater c3" />
        </span>
      </div>

      <div className="night-clouds">
        {CLOUDS.map((cloud, index) => (
          <span
            key={index}
            className="night-cloud"
            style={{
              top: cloud.top,
              width: cloud.width,
              height: cloud.width * 0.38,
              opacity: cloud.opacity,
              animationDuration: `${cloud.duration}s`,
              animationDelay: `${cloud.delay}s`,
            }}
          />
        ))}
      </div>

      <svg
        className="night-cemetery"
        viewBox="0 0 1440 420"
        preserveAspectRatio="xMidYMax slice"
      >
        <defs>
          <linearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a0a2e" />
            <stop offset="100%" stopColor="#070312" />
          </linearGradient>
          <linearGradient id="mistGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(180,160,220,0)" />
            <stop offset="100%" stopColor="rgba(160,140,200,0.18)" />
          </linearGradient>
          <linearGradient id="pumpkinBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e07a2a" />
            <stop offset="55%" stopColor="#c45a12" />
            <stop offset="100%" stopColor="#8a3408" />
          </linearGradient>
          <radialGradient id="pumpkinEyeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffe566" />
            <stop offset="45%" stopColor="#ffb000" />
            <stop offset="100%" stopColor="#ff6a00" />
          </radialGradient>
        </defs>

        <path
          d="M0 280 C180 240 320 250 480 265 C680 285 820 230 1020 250 C1180 265 1300 245 1440 260 L1440 420 L0 420 Z"
          fill="#12081f"
        />

        <g fill="none" stroke="#0a0414" strokeWidth="3" strokeLinecap="round" opacity="0.9">
          <path d="M120 420 V210 M120 250 L70 180 M120 250 L165 175 M120 290 L80 230 M120 290 L160 235" />
          <path d="M1280 420 V200 M1280 245 L1230 165 M1280 245 L1335 170 M1280 285 L1245 220 M1280 285 L1320 225" />
          <path d="M980 420 V250 M980 285 L945 220 M980 285 L1015 215" />
        </g>

        <g stroke="#1c102e" strokeWidth="4" fill="none">
          <path d="M0 355 H1440" />
          {Array.from({ length: 36 }, (_, i) => {
            const x = 20 + i * 40;
            return (
              <path
                key={x}
                d={`M${x} 355 V310 M${x - 8} 318 Q${x} 300 ${x + 8} 318`}
              />
            );
          })}
        </g>

        <g fill="#151022">
          <path d="M210 360 V290 Q210 265 235 265 Q260 265 260 290 V360 Z" />
          <rect x="225" y="295" width="20" height="6" rx="1" fill="#2a1a40" />
          <path d="M340 365 V305 H390 V365 Z" />
          <path d="M365 305 V275 M350 290 H380" stroke="#151022" strokeWidth="10" />
          <path d="M520 368 V288 Q520 258 550 258 Q580 258 580 288 V368 Z" />
          <rect x="538" y="295" width="24" height="5" rx="1" fill="#2a1a40" />
          <path d="M700 370 V300 H760 V370 Z" />
          <circle cx="730" cy="285" r="22" />
          <path d="M880 365 V295 Q880 270 905 270 Q930 270 930 295 V365 Z" />
          <path d="M1040 368 V310 H1095 V368 Z" />
          <path d="M1067 310 V278 M1052 295 H1082" stroke="#151022" strokeWidth="9" />
          <path d="M1180 360 V285 Q1180 255 1210 255 Q1240 255 1240 285 V360 Z" />
        </g>

        <path
          d="M0 370 C200 350 400 380 650 360 C900 340 1100 375 1440 355 L1440 420 L0 420 Z"
          fill="url(#groundGrad)"
        />
        <rect x="0" y="300" width="1440" height="120" fill="url(#mistGrad)" />

        {/* Pumpkins with glowing eyes — sit on the near ground */}
        <g className="night-pumpkins">
          {/* Left cluster */}
          <g transform="translate(95 348) scale(1.05)">
            <ellipse cx="0" cy="28" rx="34" ry="10" fill="rgba(0,0,0,0.35)" />
            <path d="M-2 0 C-2 -10 2 -14 4 -16 C6 -10 4 -2 2 2 Z" fill="#2f6b28" />
            <ellipse cx="0" cy="22" rx="28" ry="24" fill="url(#pumpkinBody)" />
            <path d="M-18 22 Q-9 8 0 22 Q9 8 18 22" fill="none" stroke="#9a4010" strokeWidth="2" opacity="0.45" />
            <path d="M-12 18 L-4 12 L-12 12 Z" className="pumpkin-eye" fill="url(#pumpkinEyeGlow)" />
            <path d="M12 18 L4 12 L12 12 Z" className="pumpkin-eye" fill="url(#pumpkinEyeGlow)" />
            <path d="M-8 28 Q0 34 8 28 Q0 31 -8 28 Z" fill="#3a1805" />
          </g>
          <g transform="translate(165 358) scale(0.72)">
            <ellipse cx="0" cy="28" rx="34" ry="10" fill="rgba(0,0,0,0.3)" />
            <path d="M-1 0 C-1 -8 2 -12 3 -14 C5 -9 3 -2 1 2 Z" fill="#2f6b28" />
            <ellipse cx="0" cy="22" rx="28" ry="24" fill="url(#pumpkinBody)" />
            <path d="M-12 18 L-4 12 L-12 12 Z" className="pumpkin-eye" fill="url(#pumpkinEyeGlow)" />
            <path d="M12 18 L4 12 L12 12 Z" className="pumpkin-eye" fill="url(#pumpkinEyeGlow)" />
            <path d="M-6 27 Q0 32 6 27" fill="none" stroke="#3a1805" strokeWidth="3" strokeLinecap="round" />
          </g>

          {/* Center-left */}
          <g transform="translate(430 352) scale(0.9)">
            <ellipse cx="0" cy="28" rx="34" ry="10" fill="rgba(0,0,0,0.35)" />
            <path d="M-2 0 C-2 -10 2 -14 4 -16 C6 -10 4 -2 2 2 Z" fill="#2f6b28" />
            <ellipse cx="0" cy="22" rx="28" ry="24" fill="url(#pumpkinBody)" />
            <path d="M-18 22 Q-9 8 0 22 Q9 8 18 22" fill="none" stroke="#9a4010" strokeWidth="2" opacity="0.45" />
            <path d="M-12 17 L-3 10 L-12 11 Z" className="pumpkin-eye" fill="url(#pumpkinEyeGlow)" />
            <path d="M12 17 L3 10 L12 11 Z" className="pumpkin-eye" fill="url(#pumpkinEyeGlow)" />
            <path d="M-10 28 Q0 36 10 28 Q0 32 -10 28 Z" fill="#3a1805" />
          </g>

          {/* Center-right */}
          <g transform="translate(820 350) scale(1.15)">
            <ellipse cx="0" cy="28" rx="34" ry="10" fill="rgba(0,0,0,0.35)" />
            <path d="M-2 0 C-2 -10 2 -14 4 -16 C6 -10 4 -2 2 2 Z" fill="#2f6b28" />
            <ellipse cx="0" cy="22" rx="28" ry="24" fill="url(#pumpkinBody)" />
            <path d="M-18 22 Q-9 8 0 22 Q9 8 18 22" fill="none" stroke="#9a4010" strokeWidth="2" opacity="0.4" />
            <path d="M-13 18 L-4 11 L-13 11 Z" className="pumpkin-eye" fill="url(#pumpkinEyeGlow)" />
            <path d="M13 18 L4 11 L13 11 Z" className="pumpkin-eye" fill="url(#pumpkinEyeGlow)" />
            <path d="M-9 27 Q0 35 9 27 Q0 31 -9 27 Z" fill="#3a1805" />
          </g>
          <g transform="translate(890 360) scale(0.65)">
            <ellipse cx="0" cy="28" rx="34" ry="10" fill="rgba(0,0,0,0.3)" />
            <ellipse cx="0" cy="22" rx="28" ry="24" fill="url(#pumpkinBody)" />
            <path d="M-12 18 L-4 12 L-12 12 Z" className="pumpkin-eye" fill="url(#pumpkinEyeGlow)" />
            <path d="M12 18 L4 12 L12 12 Z" className="pumpkin-eye" fill="url(#pumpkinEyeGlow)" />
            <circle cx="0" cy="28" r="3" fill="#3a1805" />
          </g>

          {/* Right cluster */}
          <g transform="translate(1280 348) scale(1)">
            <ellipse cx="0" cy="28" rx="34" ry="10" fill="rgba(0,0,0,0.35)" />
            <path d="M-2 0 C-2 -10 2 -14 4 -16 C6 -10 4 -2 2 2 Z" fill="#2f6b28" />
            <ellipse cx="0" cy="22" rx="28" ry="24" fill="url(#pumpkinBody)" />
            <path d="M-18 22 Q-9 8 0 22 Q9 8 18 22" fill="none" stroke="#9a4010" strokeWidth="2" opacity="0.45" />
            <path d="M-12 18 L-4 12 L-12 12 Z" className="pumpkin-eye" fill="url(#pumpkinEyeGlow)" />
            <path d="M12 18 L4 12 L12 12 Z" className="pumpkin-eye" fill="url(#pumpkinEyeGlow)" />
            <path d="M-8 28 Q0 34 8 28 Q0 31 -8 28 Z" fill="#3a1805" />
          </g>
          <g transform="translate(1345 356) scale(0.78)">
            <ellipse cx="0" cy="28" rx="34" ry="10" fill="rgba(0,0,0,0.3)" />
            <path d="M-1 0 C-1 -8 2 -12 3 -14 C5 -9 3 -2 1 2 Z" fill="#2f6b28" />
            <ellipse cx="0" cy="22" rx="28" ry="24" fill="url(#pumpkinBody)" />
            <path d="M-12 17 L-3 10 L-12 11 Z" className="pumpkin-eye" fill="url(#pumpkinEyeGlow)" />
            <path d="M12 17 L3 10 L12 11 Z" className="pumpkin-eye" fill="url(#pumpkinEyeGlow)" />
            <path d="M-7 27 Q0 33 7 27" fill="none" stroke="#3a1805" strokeWidth="3" strokeLinecap="round" />
          </g>
        </g>
      </svg>

      <div className="night-fog fog-back" />
      <div className="night-fog fog-mid" />
      <div className="night-fog fog-front" />
      <div className="night-vignette" />
    </div>,
    document.body,
  );
}

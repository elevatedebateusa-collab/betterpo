import React from 'react';

export const BetterPOLogoSvg: React.FC<{
  className?: string;
  theme?: 'dark' | 'light';
}> = ({
  className = "w-full h-auto overflow-visible",
  theme = 'light',
}) => {
  const isLight = theme === 'light';
  const strokeColor = isLight ? '#0f172a' : '#f8fafc';
  const headFill = isLight ? '#ffffff' : '#090a0f';
  const collarFill = isLight ? '#e2e8f0' : '#0f172a';
  const groundStroke = isLight ? '#cbd5e1' : '#64748b';

  return (
    <svg
      className={className}
      viewBox="60 0 480 160"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@600;700;800&family=JetBrains+Mono:wght@700;800&display=swap');

          /*
            Precision Logo Choreography:
            0.0s - 0.40s: Gavel enters floating above at pre-strike angle (-26deg)
            0.40s - 0.60s: Anticipation wind-up (-34deg) then HEAVY SLAM down at x=210, y=105
            0.60s: Heavy impact hits ground baseline (y=105) + audio thud + ripple shockwave
            0.62s - 1.15s: Wordmark "betterpo" QUICKLY SLIDES OUT from behind the gavel head
            1.15s+: Settled presentation ready to glide up into header title
          */

          .bpo-gavel-rig {
            animation: bpoGavelRigMotion 2.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            transform-origin: 210px 105px;
          }

          @keyframes bpoGavelRigMotion {
            0% {
              transform: translate(0px, -45px) rotate(-26deg);
              opacity: 0;
            }
            8% {
              transform: translate(0px, -45px) rotate(-26deg);
              opacity: 1;
            }
            16% {
              /* Wind-up anticipation */
              transform: translate(0px, -52px) rotate(-34deg);
            }
            25% {
              /* HEAVY SLAM IMPACT onto baseline at 0.60s */
              transform: translate(0px, 0px) rotate(0deg);
              opacity: 1;
            }
            28% {
              /* Micro-recoil settling */
              transform: translate(0px, -1px) rotate(0.8deg);
            }
            34%, 100% {
              transform: translate(0px, 0px) rotate(0deg);
              opacity: 1;
            }
          }

          /* Ground baseline where the gavel strikes */
          .bpo-strike-ground {
            animation: bpoGroundReact 2.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }

          @keyframes bpoGroundReact {
            0%, 23% {
              opacity: 0.15;
              stroke: ${groundStroke};
            }
            25% {
              opacity: 0.95;
              stroke: #10b981;
            }
            38% {
              opacity: 0.4;
              stroke: ${groundStroke};
            }
            50% {
              opacity: 0.2;
              stroke: ${groundStroke};
            }
            85%, 100% {
              opacity: 0;
              stroke: ${groundStroke};
            }
          }

          /* Tactile impact shockwave line burst at ground contact */
          .bpo-strike-ripple {
            transform-origin: 210px 105px;
            animation: bpoRipplePulse 2.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }

          @keyframes bpoRipplePulse {
            0%, 23% {
              opacity: 0;
              transform: scale(0.3);
            }
            25% {
              opacity: 0.95;
              transform: scale(1);
            }
            38% {
              opacity: 0;
              transform: scale(1.6);
            }
            100% {
              opacity: 0;
            }
          }

          /* 
            Wordmark quickly slides out from behind the gavel:
            Starts at 26% (0.62s) and smoothly glides out into full view by 48% (1.15s).
            No typing effect, no pause—just a swift, high-end slide-out!
          */
          .bpo-wordmark-group {
            animation: bpoQuickSlideOut 2.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }

          @keyframes bpoQuickSlideOut {
            0%, 25% {
              opacity: 0;
              transform: translateX(-160px);
            }
            27% {
              opacity: 1;
              transform: translateX(-140px);
            }
            50%, 100% {
              opacity: 1;
              transform: translateX(0px);
            }
          }
        `}</style>

        {/* SVG ClipPath boundary starting at the right edge of the gavel head (x=228) */}
        <clipPath id="bpoWordmarkClip">
          <rect
            x="228"
            y="20"
            width="280"
            height="120"
            rx="2"
          />
        </clipPath>
      </defs>

      {/* Ground baseline: Surface where the gavel strikes at x=210, y=105 */}
      <g className="bpo-strike-ground">
        <line
          stroke={groundStroke}
          strokeLinecap="round"
          strokeWidth="2.5"
          x1="160"
          x2="260"
          y1="105"
          y2="105"
        />
      </g>

      {/* Tactile shockwave line burst right at ground contact (x=210, y=105) */}
      <g className="bpo-strike-ripple">
        <line
          stroke="#10b981"
          strokeLinecap="round"
          strokeWidth="2"
          x1="192"
          x2="170"
          y1="105"
          y2="105"
        />
        <line
          stroke="#10b981"
          strokeLinecap="round"
          strokeWidth="2"
          x1="228"
          x2="250"
          y1="105"
          y2="105"
        />
      </g>

      {/* GAVEL RIG: Authoritative strike down at x=210, y=105 */}
      <g className="bpo-gavel-rig">
        {/* Straight Handle: Clean horizontal rod from collar (193, 71) to pommel (114, 71) */}
        <line
          stroke={strokeColor}
          strokeLinecap="round"
          strokeWidth="4.5"
          x1="193"
          x2="114"
          y1="71"
          y2="71"
        />
        {/* Minimalist pommel finial cap on end of handle */}
        <circle cx="112" cy="71" fill={strokeColor} r="4" />

        {/* MALLET HEAD: Symmetrical square/flat block mallet */}
        {/* Top face block */}
        <rect
          fill={headFill}
          height="11"
          rx="2"
          stroke={strokeColor}
          strokeWidth="2.8"
          width="36"
          x="192"
          y="36"
        />
        {/* Upper head rim band */}
        <rect
          fill={headFill}
          height="7"
          rx="2"
          stroke={strokeColor}
          strokeWidth="2.8"
          width="36"
          x="192"
          y="47"
        />
        {/* Head main cylindrical barrel */}
        <rect
          fill={headFill}
          height="40"
          rx="3.5"
          stroke={strokeColor}
          strokeWidth="3"
          width="28"
          x="196"
          y="54"
        />
        {/* Center collar ring band */}
        <rect
          fill={collarFill}
          height="12"
          rx="2"
          stroke={strokeColor}
          strokeWidth="2.5"
          width="34"
          x="193"
          y="65"
        />
        {/* Lower head rim band */}
        <rect
          fill={headFill}
          height="7"
          rx="2"
          stroke={strokeColor}
          strokeWidth="2.8"
          width="36"
          x="192"
          y="87"
        />
        {/* Bottom striking face: flat square block hitting baseline at y=105 */}
        <rect
          fill={headFill}
          height="11"
          rx="2"
          stroke={strokeColor}
          strokeWidth="2.8"
          width="36"
          x="192"
          y="94"
        />
      </g>

      {/* 
        "betterpo" WORDMARK:
        Clipped by #bpoWordmarkClip so it physically slides out from behind the gavel head (x=228)
      */}
      <g clipPath="url(#bpoWordmarkClip)">
        <g className="bpo-wordmark-group">
          <g transform="translate(248, 102)">
            <text
              fill={strokeColor}
              fontFamily="'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
              fontSize="46"
              fontWeight="700"
              letterSpacing="-1.2"
            >
              better
              <tspan
                fill="#10b981"
                fontFamily="'JetBrains Mono', monospace"
                fontWeight="800"
              >
                po
              </tspan>
            </text>
          </g>
        </g>
      </g>
    </svg>
  );
};

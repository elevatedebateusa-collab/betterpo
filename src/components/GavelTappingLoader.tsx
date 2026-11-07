import React from 'react';

interface GavelTappingLoaderProps {
  title?: string;
  subtitle?: string;
  className?: string;
  soundEnabled?: boolean;
}

export const GavelTappingLoader: React.FC<GavelTappingLoaderProps> = ({
  title = "Creating Chamber...",
  subtitle = "INITIALIZING DOCKET, ROSTER & NSDA PARLIAMENTARY RULES",
  className = "",
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center select-none ${className}`}>
      <style>{`
        @keyframes gavelTapLoop {
          0% {
            transform: translate(0px, -36px) rotate(-28deg);
          }
          16% {
            /* Impact slam down on floor baseline (y=105) */
            transform: translate(0px, 0px) rotate(0deg);
          }
          26% {
            /* Firmly planted on floor */
            transform: translate(0px, 0px) rotate(0deg);
          }
          52% {
            /* Smooth lift back up */
            transform: translate(0px, -36px) rotate(-28deg);
          }
          100% {
            transform: translate(0px, -36px) rotate(-28deg);
          }
        }

        @keyframes groundTapLoop {
          0%, 14% {
            opacity: 0.25;
            stroke: #cbd5e1;
          }
          17% {
            opacity: 1;
            stroke: #10b981;
          }
          32% {
            opacity: 0.45;
            stroke: #64748b;
          }
          50%, 100% {
            opacity: 0.25;
            stroke: #cbd5e1;
          }
        }

        @keyframes rippleTapLoop {
          0%, 14% {
            opacity: 0;
            transform: scale(0.2);
          }
          17% {
            opacity: 1;
            transform: scale(0.6);
          }
          34% {
            opacity: 0;
            transform: scale(1.6);
          }
          100% {
            opacity: 0;
            transform: scale(1.6);
          }
        }

        .gavel-tap-motion {
          animation: gavelTapLoop 0.9s cubic-bezier(0.16, 1, 0.3, 1) infinite;
          transform-origin: 380px 105px;
        }

        .ground-tap-motion {
          animation: groundTapLoop 0.9s ease-out infinite;
        }

        .ripple-tap-motion {
          animation: rippleTapLoop 0.9s ease-out infinite;
          transform-origin: 380px 105px;
        }
      `}</style>

      {/* SVG Canvas for Light Mode Gavel Tapping Animation */}
      <div className="w-full max-w-[340px] sm:max-w-[400px] h-auto mx-auto relative">
        <svg
          viewBox="250 15 200 115"
          className="w-full h-auto overflow-visible"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Ground baseline: Surface where the gavel strikes */}
          <line
            className="ground-tap-motion"
            stroke="#cbd5e1"
            strokeLinecap="round"
            strokeWidth="3"
            x1="320"
            x2="440"
            y1="105"
            y2="105"
          />

          {/* Tactile shockwave line burst right at ground contact (y=105) */}
          <g className="ripple-tap-motion">
            <line
              stroke="#10b981"
              strokeLinecap="round"
              strokeWidth="2.5"
              x1="360"
              x2="335"
              y1="105"
              y2="105"
            />
            <line
              stroke="#10b981"
              strokeLinecap="round"
              strokeWidth="2.5"
              x1="400"
              x2="425"
              y1="105"
              y2="105"
            />
          </g>

          {/* Gavel Rig (Pivot at bottom striking face: x=380, y=105) */}
          <g className="gavel-tap-motion">
            {/* Straight Handle: Clean horizontal rod from (363, 71) to pommel (284, 71) */}
            <line
              stroke="#0f172a"
              strokeLinecap="round"
              strokeWidth="4.5"
              x1="363"
              x2="284"
              y1="71"
              y2="71"
            />
            {/* Minimalist pommel finial cap on end of handle */}
            <circle cx="282" cy="71" fill="#0f172a" r="4.2" />

            {/* MALLET HEAD: Light mode crisp white with sharp slate outlines */}
            {/* Top face block */}
            <rect
              fill="#ffffff"
              height="11"
              rx="2"
              stroke="#0f172a"
              strokeWidth="2.8"
              width="36"
              x="362"
              y="36"
            />
            {/* Upper head rim band */}
            <rect
              fill="#ffffff"
              height="7"
              rx="2"
              stroke="#0f172a"
              strokeWidth="2.8"
              width="36"
              x="362"
              y="47"
            />
            {/* Head main cylindrical barrel */}
            <rect
              fill="#ffffff"
              height="40"
              rx="3.5"
              stroke="#0f172a"
              strokeWidth="3"
              width="28"
              x="366"
              y="54"
            />
            {/* Center collar ring band in circuit emerald */}
            <rect
              fill="#10b981"
              height="12"
              rx="2"
              stroke="#0f172a"
              strokeWidth="2.5"
              width="34"
              x="363"
              y="65"
            />
            {/* Lower head rim band */}
            <rect
              fill="#ffffff"
              height="7"
              rx="2"
              stroke="#0f172a"
              strokeWidth="2.8"
              width="36"
              x="362"
              y="87"
            />
            {/* Bottom striking face: flat square block hitting baseline at y=105 */}
            <rect
              fill="#ffffff"
              height="11"
              rx="2"
              stroke="#0f172a"
              strokeWidth="2.8"
              width="36"
              x="362"
              y="94"
            />
          </g>
        </svg>
      </div>

      {/* Title & Telemetry Captions */}
      <div className="mt-4 space-y-1.5">
        <h3 className="font-serif-editorial text-xl sm:text-2xl font-bold uppercase tracking-tight text-[#0A1128]">
          {title}
        </h3>
        <p className="font-mono text-[11px] uppercase tracking-widest text-[#006948] font-bold">
          {subtitle}
        </p>
      </div>
    </div>
  );
};

export default GavelTappingLoader;

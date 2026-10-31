import React from 'react';

export interface MiniGavelIconProps {
  className?: string;
  color?: string;
  collarColor?: string;
  headFill?: string;
  angle?: number;
}

/**
 * Miniature vector reproduction of the signature BetterPO gavel emblem
 * used in the hero animation: symmetrical flat-faced mallet head,
 * stepped collar ring, straight handle rod, and pommel finial.
 */
export const MiniGavelIcon: React.FC<MiniGavelIconProps> = ({
  className = "w-4 h-4",
  color = "#10B981",
  collarColor = "#10B981",
  headFill = "transparent",
  angle = -28,
}) => {
  return (
    <svg
      viewBox="-75 -75 150 150"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: 'visible' }}
    >
      <g transform={`rotate(${angle})`}>
        {/* Handle Shaft */}
        <line
          x1="-54"
          y1="0"
          x2="25"
          y2="0"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
        />

        {/* Pommel Finial Cap */}
        <circle 
          cx="-55" 
          cy="0" 
          r="5.5" 
          fill={color} 
        />

        {/* Symmetrical Mallet Head */}
        {/* Top Face Striking Block */}
        <rect
          x="24"
          y="-35"
          width="36"
          height="11"
          rx="2"
          fill={headFill}
          stroke={color}
          strokeWidth="4.5"
        />

        {/* Upper Rim Band */}
        <rect
          x="24"
          y="-24"
          width="36"
          height="7"
          rx="1.5"
          fill={headFill}
          stroke={color}
          strokeWidth="4.5"
        />

        {/* Main Cylindrical Barrel */}
        <rect
          x="28"
          y="-17"
          width="28"
          height="34"
          rx="3"
          fill={headFill}
          stroke={color}
          strokeWidth="4.5"
        />

        {/* Center Collar Ring Band */}
        <rect
          x="25"
          y="-6"
          width="34"
          height="12"
          rx="2"
          fill={collarColor}
          stroke={color}
          strokeWidth="4"
        />

        {/* Lower Rim Band */}
        <rect
          x="24"
          y="17"
          width="36"
          height="7"
          rx="1.5"
          fill={headFill}
          stroke={color}
          strokeWidth="4.5"
        />

        {/* Bottom Face Striking Block */}
        <rect
          x="24"
          y="24"
          width="36"
          height="11"
          rx="2"
          fill={headFill}
          stroke={color}
          strokeWidth="4.5"
        />
      </g>
    </svg>
  );
};

export default MiniGavelIcon;


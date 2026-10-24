'use client';

import React from 'react';

interface Props {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

export function SurfaceLogo({ size = 'md', showText = false, className = '' }: Props) {
  const sizeMap = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20',
  };

  const textGapMap = {
    sm: 'gap-2',
    md: 'gap-2.5',
    lg: 'gap-3.5',
    xl: 'gap-4',
  };

  const titleSizeMap = {
    sm: 'text-sm font-bold',
    md: 'text-base font-bold',
    lg: 'text-xl font-black',
    xl: 'text-3xl font-black',
  };

  return (
    <div className={`inline-flex items-center ${textGapMap[size]} select-none group ${className}`}>
      {/* 矢量晶体与水面涟漪 Logo 徽章 */}
      <div
        className={`${sizeMap[size]} relative shrink-0 transition-transform duration-300 group-hover:scale-105 filter drop-shadow-sm`}
      >
        <svg
          viewBox="0 0 512 512"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full rounded-[25%] overflow-hidden"
        >
          <defs>
            <linearGradient id="logoBg" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1E3328" />
              <stop offset="50%" stopColor="#2E4A3B" />
              <stop offset="100%" stopColor="#4A6957" />
            </linearGradient>

            <linearGradient id="logoSunlight" x1="200" y1="120" x2="330" y2="280" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#F9D2B5" />
              <stop offset="45%" stopColor="#E88B68" />
              <stop offset="100%" stopColor="#BD5534" />
            </linearGradient>

            <linearGradient id="logoShadow" x1="256" y1="150" x2="360" y2="280" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#DB744E" />
              <stop offset="100%" stopColor="#96391A" />
            </linearGradient>

            <linearGradient id="logoUnder" x1="256" y1="280" x2="256" y2="430" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#78AD96" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#365C4B" stopOpacity="0.2" />
            </linearGradient>

            <clipPath id="logoAbove">
              <rect x="0" y="0" width="512" height="280" />
            </clipPath>
            <clipPath id="logoUnderClip">
              <rect x="0" y="280" width="512" height="232" />
            </clipPath>
          </defs>

          {/* 容器外壳底色 */}
          <rect width="512" height="512" rx="128" fill="url(#logoBg)" />
          <rect
            x="10"
            y="10"
            width="492"
            height="492"
            rx="118"
            stroke="#9BC0AC"
            strokeWidth="3"
            strokeOpacity="0.25"
          />

          {/* 水下暗流光晕 */}
          <circle cx="256" cy="350" r="120" fill="#5E8C75" opacity="0.25" />

          {/* 水下虚线探索结构（折射） */}
          <g clipPath="url(#logoUnderClip)" transform="translate(-4, 0)">
            <polygon points="256,280 180,380 256,430 256,280" fill="url(#logoUnder)" />
            <polygon points="256,280 332,380 256,430 256,280" fill="#4B7764" fillOpacity="0.45" />
            <line
              x1="256"
              y1="280"
              x2="256"
              y2="430"
              stroke="#A8D4BF"
              strokeWidth="2.5"
              strokeDasharray="6 6"
              strokeOpacity="0.65"
            />
            <line
              x1="180"
              y1="380"
              x2="332"
              y2="380"
              stroke="#A8D4BF"
              strokeWidth="2"
              strokeDasharray="6 6"
              strokeOpacity="0.45"
            />
            <ellipse cx="256" cy="350" rx="150" ry="22" stroke="#7BA894" strokeWidth="2" strokeOpacity="0.2" />
          </g>

          {/* 水上破水棱晶（真理呈现） */}
          <g clipPath="url(#logoAbove)">
            <polygon points="256,120 166,280 256,280" fill="url(#logoSunlight)" />
            <polygon points="256,120 346,280 256,280" fill="url(#logoShadow)" />
            <line x1="256" y1="120" x2="256" y2="280" stroke="#FFF2E8" strokeWidth="2.5" strokeOpacity="0.75" />
          </g>

          {/* 水平破水涟漪 */}
          <g>
            <path
              d="M 64 280 C 130 276, 190 284, 256 280 C 320 276, 380 284, 448 280"
              stroke="#98C2AD"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeOpacity="0.4"
            />
            <ellipse cx="256" cy="280" rx="150" ry="22" stroke="#BFE7D3" strokeWidth="3" strokeOpacity="0.6" />
            <ellipse cx="256" cy="280" rx="100" ry="14" stroke="#FFFFFF" strokeWidth="3.5" strokeOpacity="0.9" />
            <ellipse cx="256" cy="280" rx="55" ry="8" stroke="#FFE9D6" strokeWidth="2.5" strokeOpacity="0.85" />
          </g>

          {/* 顶端灵感星芒 */}
          <g transform="translate(256, 105)">
            <path d="M 0 -22 Q 0 0 22 0 Q 0 0 0 22 Q 0 0 -22 0 Q 0 0 0 -22 Z" fill="#FFE5D4" />
            <circle cx="0" cy="0" r="3.5" fill="#FFFFFF" />
          </g>
        </svg>
      </div>

      {/* 伴随品牌文字排版 */}
      {showText && (
        <div className="flex flex-col justify-center">
          <div className="flex items-baseline gap-1.5 leading-none">
            <span className={`${titleSizeMap[size]} text-ink-text tracking-tight font-black font-sans`}>GuessWhat</span>
            <span className="text-[10px] tracking-[0.2em] font-mono text-sage-600 font-semibold uppercase opacity-90">
              ONLINE
            </span>
          </div>
          {size === 'lg' || size === 'xl' ? (
            <span className="text-xs text-ink-muted mt-1 font-medium">双人实时是非推理猜词</span>
          ) : null}
        </div>
      )}
    </div>
  );
}


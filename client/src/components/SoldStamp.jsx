import React from 'react';

/**
 * Authentic Circular Rubber Stamp for SOLD & UNSOLD moments.
 * Compact, clean, readable with double circular rings, arched text,
 * decorative stars, and a tasteful tilted center banner (-9deg).
 * Does not cover player face when positioned in lower corner.
 */
export default function SoldStamp({ type = 'sold', showDetails = false, winningTeam = null, amount = null }) {
  const isSold = type === 'sold';
  const stampColor = '#DC2626'; // Authentic crimson stamp ink

  return (
    <div className="relative flex flex-col items-center justify-center animate-stamp-in select-none pointer-events-none">
      <svg
        viewBox="0 0 320 320"
        className="w-32 h-32 sm:w-36 sm:h-36 md:w-40 md:h-40 stamp-sold-rubber transform"
        style={{
          filter: 'drop-shadow(0 4px 14px rgba(220, 38, 38, 0.45))'
        }}
      >
        <defs>
          {/* Top text arc */}
          <path
            id="stampTopArc"
            d="M 55,160 A 105,105 0 0,1 265,160"
            fill="none"
          />
          {/* Top stars arc */}
          <path
            id="stampTopStars"
            d="M 72,160 A 88,88 0 0,1 248,160"
            fill="none"
          />
          {/* Bottom text arc */}
          <path
            id="stampBottomArc"
            d="M 265,160 A 105,105 0 0,1 55,160"
            fill="none"
          />
          {/* Bottom stars arc */}
          <path
            id="stampBottomStars"
            d="M 248,160 A 88,88 0 0,1 72,160"
            fill="none"
          />
        </defs>

        {/* Outer Heavy Circular Ring */}
        <circle
          cx="160"
          cy="160"
          r="142"
          fill="none"
          stroke={stampColor}
          strokeWidth="7"
        />

        {/* Outer Subtle Accent Ring */}
        <circle
          cx="160"
          cy="160"
          r="133"
          fill="none"
          stroke={stampColor}
          strokeWidth="2"
        />

        {/* Inner Border Ring */}
        <circle
          cx="160"
          cy="160"
          r="98"
          fill="none"
          stroke={stampColor}
          strokeWidth="3.5"
        />

        {/* Top Arc Text */}
        <text
          fill={stampColor}
          fontSize="23"
          fontWeight="900"
          letterSpacing="5"
          fontFamily="'Poppins', sans-serif"
        >
          <textPath href="#stampTopArc" startOffset="50%" textAnchor="middle">
            {isSold ? 'SOLD' : 'UNSOLD'}
          </textPath>
        </text>

        {/* Top Arc Stars */}
        <text
          fill={stampColor}
          fontSize="15"
          letterSpacing="4"
          fontFamily="'Poppins', sans-serif"
        >
          <textPath href="#stampTopStars" startOffset="50%" textAnchor="middle">
            ★ ★ ★
          </textPath>
        </text>

        {/* Bottom Arc Text */}
        <text
          fill={stampColor}
          fontSize="23"
          fontWeight="900"
          letterSpacing="5"
          fontFamily="'Poppins', sans-serif"
        >
          <textPath href="#stampBottomArc" startOffset="50%" textAnchor="middle">
            {isSold ? 'SOLD' : 'UNSOLD'}
          </textPath>
        </text>

        {/* Bottom Arc Stars */}
        <text
          fill={stampColor}
          fontSize="15"
          letterSpacing="4"
          fontFamily="'Poppins', sans-serif"
        >
          <textPath href="#stampBottomStars" startOffset="50%" textAnchor="middle">
            ★ ★ ★
          </textPath>
        </text>

        {/* Tilted Center Banner (-9deg angle: balanced, authentic, readable) */}
        <g transform="rotate(-9 160 160)">
          {/* Banner Background */}
          <rect
            x="12"
            y="124"
            width="296"
            height="72"
            rx="12"
            fill="#ffffff"
            stroke={stampColor}
            strokeWidth="7"
          />

          {/* Banner Inner Border Line */}
          <rect
            x="17"
            y="129"
            width="286"
            height="62"
            rx="8"
            fill="none"
            stroke={stampColor}
            strokeWidth="2"
            strokeDasharray="4 3"
          />

          {/* Bold Center Text */}
          <text
            x="160"
            y="173"
            textAnchor="middle"
            fill={stampColor}
            fontSize={isSold ? "50" : "44"}
            fontWeight="900"
            letterSpacing={isSold ? "8" : "5"}
            fontFamily="'Poppins', sans-serif"
          >
            {isSold ? 'SOLD' : 'UNSOLD'}
          </text>
        </g>
      </svg>

      {/* Optional Winning details pill when explicitly requested */}
      {showDetails && isSold && (winningTeam || amount) && (
        <div className="mt-2 px-4 py-1.5 rounded-full bg-white text-zinc-900 font-semibold text-xs shadow-md flex items-center gap-1.5 border border-zinc-200">
          {winningTeam && (
            <span>
              Won by <strong className="font-bold text-red-600">{winningTeam.name}</strong>
            </span>
          )}
          {amount && (
            <span className="font-extrabold text-zinc-900">
              • ₹{Number(amount).toLocaleString('en-IN')}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

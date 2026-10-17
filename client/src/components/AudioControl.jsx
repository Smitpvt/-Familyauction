import React, { useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { toggleSound, getSoundStatus } from '../utils/soundEffects';

export default function AudioControl({ className = '', light = false }) {
  const [enabled, setEnabled] = useState(getSoundStatus());

  const handleToggle = () => {
    const newState = toggleSound();
    setEnabled(newState);
  };

  return (
    <button
      onClick={handleToggle}
      title={enabled ? 'Mute Auction Audio' : 'Unmute Auction Audio'}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition border ${
        light
          ? enabled
            ? 'bg-[#2879C7]/10 text-[#2879C7] border-[#2879C7]/40 hover:bg-[#2879C7]/20'
            : 'bg-[#ECEEF1] text-[#64748B] border-[#D5D9E0] hover:bg-[#E2E5EA]'
          : enabled
            ? 'bg-[#2879C7]/20 text-[#2879C7] border-[#2879C7]/50 hover:bg-[#2879C7]/30'
            : 'bg-[#1F1F1F] text-[#9E9E9E] border-[#2F2F2F] hover:bg-[#262626]'
      } ${className}`}
    >
      {enabled ? (
        <>
          <Volume2 className="w-3.5 h-3.5 text-[#2879C7]" />
          <span>AUDIO ON</span>
        </>
      ) : (
        <>
          <VolumeX className="w-3.5 h-3.5 text-[#9E9E9E]" />
          <span>MUTED</span>
        </>
      )}
    </button>
  );
}

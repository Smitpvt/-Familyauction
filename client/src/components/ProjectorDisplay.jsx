import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Maximize2,
  Minimize2,
  ArrowRight,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Layers,
  Volume2,
  Gavel,
  Trophy,
  BookOpen,
  Home,
  Play
} from 'lucide-react';
import { getSocket } from '../services/socket';
import { auctionAPI, roundsAPI } from '../services/api';
import {
  playSoldSound,
  playBidSound,
  playUnsoldSound,
  playCountdownTick
} from '../utils/soundEffects';
import AudioControl from './AudioControl';
import SoldStamp from './SoldStamp';
import hfplLogo from '../logo/HFPL logo-Photoroom.png';

import { resolveTeamLogo, resolveImageUrl } from '../utils/media';

// 10 Official HFPL Tournament Rules (5 per page, English + Marathi)
const AUCTION_RULES = [
  // Page 1: Rules 1 to 5
  {
    number: 1,
    title: 'Team Budget',
    titleMarathi: 'संघाचे बजेट',
    english: 'Each team receives a budget of 25,000 points.',
    marathi: 'प्रत्येक संघाला २५,००० पॉइंट्स दिले जातील.'
  },
  {
    number: 2,
    title: 'Base Price',
    titleMarathi: 'बेस प्राईस',
    english: 'The base price of every player is 500 points.',
    marathi: 'प्रत्येक खेळाडूची बेस प्राईस ५०० पॉइंट्स असेल.'
  },
  {
    number: 3,
    title: 'Minimum Raise',
    titleMarathi: 'किमान वाढ',
    english: 'Every new bid must increase by at least 100 points.',
    marathi: 'प्रत्येक पुढील बोलीमध्ये किमान १०० पॉइंट्सची वाढ असणे आवश्यक आहे.'
  },
  {
    number: 4,
    title: 'Minimum Squad Size',
    titleMarathi: 'किमान खेळाडू संख्या',
    english: 'Each team must aim to purchase at least 9–10 players within its 25,000-point budget.',
    marathi: 'प्रत्येक संघाने २५,००० पॉइंट्सच्या बजेटमध्ये किमान ९ ते १० खेळाडू खरेदी करणे आवश्यक आहे.'
  },
  {
    number: 5,
    title: 'Compulsory Players',
    titleMarathi: 'अनिवार्य खेळाडू',
    english: 'Each team must include at least 2 women and 2 girls in its squad.',
    marathi: 'प्रत्येक संघात किमान २ महिला आणि २ मुली असणे अनिवार्य आहे.'
  },
  // Page 2: Rules 6 to 10
  {
    number: 6,
    title: 'Bidding Time',
    titleMarathi: 'बोलीची वेळ',
    english: 'Each player has a maximum bidding time of 2 minutes.',
    marathi: 'प्रत्येक खेळाडूसाठी बोली लावण्याची कमाल वेळ २ मिनिटे असेल.'
  },
  {
    number: 7,
    title: "Captain's Decision",
    titleMarathi: 'कर्णधाराचा निर्णय',
    english: 'Advisors may only guide the captain about the remaining points. The captain makes the final bidding decision.',
    marathi: 'सल्लागार फक्त उर्वरित पॉइंट्सबाबत कर्णधाराला सल्ला देऊ शकतात. बोलीबाबतचा अंतिम निर्णय कर्णधाराचाच असेल.'
  },
  {
    number: 8,
    title: 'Final Bid',
    titleMarathi: 'अंतिम बोली',
    english: "Once a player's auction is completed and the player is assigned to a team, the decision cannot be reversed.",
    marathi: 'एकदा बोली पूर्ण होऊन खेळाडू संघात निवडला गेला की, तो निर्णय मागे घेता येणार नाही.'
  },
  {
    number: 9,
    title: 'Speaking Rights',
    titleMarathi: 'बोलण्याचा अधिकार',
    english: 'Only the captain is allowed to speak during the auction.',
    marathi: 'लिलावादरम्यान फक्त कर्णधारालाच बोलण्याची परवानगी असेल.'
  },
  {
    number: 10,
    title: 'Audience Discipline',
    titleMarathi: 'शिस्त व नियम',
    english: 'A fine of ₹100 will be imposed for shouting or causing disturbances during the auction.',
    marathi: 'लिलावादरम्यान आरडाओरडा करणे किंवा गोंधळ घालणे यासाठी ₹१०० दंड आकारला जाईल.'
  }
];

export default function ProjectorDisplay() {
  const [auctionData, setAuctionData] = useState(null);
  const [roundsList, setRoundsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentView, setCurrentView] = useState('welcome'); // 'welcome' | 'rules' | 'countdown' | 'sets' | 'auction'
  const [rulesPage, setRulesPage] = useState(1); // 1 | 2
  const [countdown, setCountdown] = useState(5);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [bidFlashed, setBidFlashed] = useState(false);
  
  // SOLD Animation States
  const [soldAnimationPlayerId, setSoldAnimationPlayerId] = useState(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showGreenSweep, setShowGreenSweep] = useState(false);

  const containerRef = useRef(null);

  // Currency Formatter
  const formatINR = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  // Fetch auction state & rounds
  const fetchState = async () => {
    try {
      const [stateRes, roundsRes] = await Promise.all([
        auctionAPI.getState(),
        roundsAPI.getAll()
      ]);

      if (stateRes.data.success) {
        setAuctionData(stateRes.data);
      }
      if (roundsRes.data.success) {
        setRoundsList(roundsRes.data.rounds || []);
      }
    } catch (err) {
      console.error('Failed to load auction state:', err);
    } finally {
      setLoading(false);
    }
  };

  // Trigger two-sided confetti burst for SOLD celebration
  const triggerSoldConfetti = () => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    try {
      // Left side celebration cannon
      confetti({
        particleCount: 85,
        angle: 60,
        spread: 65,
        origin: { x: 0, y: 0.75 },
        colors: ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6', '#ffffff']
      });

      // Right side celebration cannon
      confetti({
        particleCount: 85,
        angle: 120,
        spread: 65,
        origin: { x: 1, y: 0.75 },
        colors: ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6', '#ffffff']
      });

      // Secondary subtle burst for fullness
      setTimeout(() => {
        confetti({
          particleCount: 45,
          angle: 90,
          spread: 80,
          origin: { x: 0.5, y: 0.7 },
          colors: ['#22c55e', '#ffffff', '#ef4444']
        });
      }, 180);
    } catch (e) {
      console.warn('Confetti error:', e);
    }
  };

  useEffect(() => {
    fetchState();

    const socket = getSocket();

    // Listen for state updates
    const handleStateUpdate = (data) => {
      setAuctionData(data);
      // Auto-switch to auction view if active live bidding is started by admin
      if (data.state?.status === 'bidding') {
        setCurrentView('auction');
      }
    };

    // Listen for live bid placed
    const handleBidPlaced = () => {
      playBidSound();
      setBidFlashed(true);
      setTimeout(() => setBidFlashed(false), 750);
    };

    // Listen for SOLD event
    const handlePlayerSold = () => {
      playSoldSound();
      triggerSoldConfetti();
      setCurrentView('auction');
      fetchState();
    };

    // Listen for UNSOLD event
    const handlePlayerUnsold = () => {
      playUnsoldSound();
      setCurrentView('auction');
      fetchState();
    };

    // Listen for PLAYER_DELETED event
    const handlePlayerDeleted = () => {
      fetchState();
    };

    socket.on('AUCTION_STATE_UPDATE', handleStateUpdate);
    socket.on('BID_PLACED', handleBidPlaced);
    socket.on('PLAYER_SOLD', handlePlayerSold);
    socket.on('PLAYER_UNSOLD', handlePlayerUnsold);
    socket.on('PLAYER_DELETED', handlePlayerDeleted);

    // Keyboard shortcut 'F' for fullscreen
    const handleKeyDown = (e) => {
      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      socket.off('AUCTION_STATE_UPDATE', handleStateUpdate);
      socket.off('BID_PLACED', handleBidPlaced);
      socket.off('PLAYER_SOLD', handlePlayerSold);
      socket.off('PLAYER_UNSOLD', handlePlayerUnsold);
      socket.off('PLAYER_DELETED', handlePlayerDeleted);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
      }
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Handler: Select a Set
  const handleSelectSet = async (round) => {
    try {
      await auctionAPI.setRound(round._id);
      setCurrentView('auction');
      fetchState();
    } catch (err) {
      console.error('Error selecting set:', err);
      setCurrentView('auction');
    }
  };

  // Handler: Start 5-Second Countdown
  const handleStartAuction = () => {
    if (isCountingDown) return; // Guard against duplicate countdown clicks
    setIsCountingDown(true);
    setCountdown(5);
    setCurrentView('countdown');
    playCountdownTick(false);
  };

  // Handler: Complete Countdown & Transition to Live Auction
  const handleCountdownComplete = async () => {
    setIsCountingDown(false);

    // 1. If auction is already running, reconnect to existing session without starting a new one
    try {
      const res = await auctionAPI.getState();
      if (res.data?.success && res.data.state) {
        setAuctionData(res.data);
        if (res.data.state.currentPlayer) {
          setCurrentView('auction');
          return;
        }
      }
    } catch (e) {
      console.error('Error fetching state upon countdown complete:', e);
    }

    // 2. If no active player selected yet, select set 1 or first round
    const set1 = roundsList.find((r) => r.order === 1 || r.name.toLowerCase().includes('set 1')) || roundsList[0];
    if (set1) {
      try {
        await auctionAPI.setRound(set1._id);
        await fetchState();
      } catch (err) {
        console.error('Error setting round:', err);
      }
    }
    setCurrentView('auction');
  };

  // 5-Second Countdown Timer Lifecycle
  useEffect(() => {
    let timer = null;
    if (currentView === 'countdown' && isCountingDown) {
      if (countdown > 1) {
        timer = setTimeout(() => {
          setCountdown((prev) => prev - 1);
          playCountdownTick(false);
        }, 1000);
      } else if (countdown === 1) {
        timer = setTimeout(() => {
          setCountdown(0);
          playCountdownTick(true);
        }, 1000);
      } else if (countdown === 0) {
        timer = setTimeout(() => {
          handleCountdownComplete();
        }, 400);
      }
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [currentView, isCountingDown, countdown]);

  const state = auctionData?.state;
  const player = state?.currentPlayer;

  // Single Source of Truth for SOLD/UNSOLD status:
  // If player is persisted as sold or unsold in MongoDB, that strictly governs the display!
  const isPlayerSold = player?.status === 'sold' || state?.status === 'sold';
  const isPlayerUnsold = !isPlayerSold && (player?.status === 'unsold' || state?.status === 'unsold');
  const status = isPlayerSold ? 'sold' : (isPlayerUnsold ? 'unsold' : (state?.status || 'idle'));

  // Winning team: if sold, prioritize player.soldToTeam, then state.highestBidder, then lastSoldDetails.team
  const highestBidder = isPlayerSold
    ? (player?.soldToTeam || state?.highestBidder || state?.lastSoldDetails?.team)
    : state?.highestBidder;

  // Final sale price vs active current bid
  const finalSalePrice = isPlayerSold
    ? (player?.soldPrice || state?.lastSoldDetails?.amount || state?.currentBid || player?.basePrice || 0)
    : null;
  const currentBid = isPlayerSold
    ? finalSalePrice
    : (state?.currentBid || (player ? player.basePrice : 0));
  const currentRound = state?.currentRound;

  // Handle SOLD celebration animation cleanly and strictly once per completed sale
  useEffect(() => {
    if (status === 'sold' && player?._id) {
      if (soldAnimationPlayerId !== player._id) {
        // Trigger reveal only once per completed sale
        setSoldAnimationPlayerId(player._id);
        setIsFlipped(false);
        setShowGreenSweep(true);

        playSoldSound();
        triggerSoldConfetti();

        // Smooth 3D flip triggers after brief dramatic pause (300ms)
        const flipTimer = setTimeout(() => {
          setIsFlipped(true);
        }, 300);

        // Green sweep finishes after 1100ms
        const sweepTimer = setTimeout(() => {
          setShowGreenSweep(false);
        }, 1100);

        return () => {
          clearTimeout(flipTimer);
          clearTimeout(sweepTimer);
        };
      } else {
        // Keep final SOLD screen visible until admin advances
        setIsFlipped(true);
      }
    } else if (status !== 'sold') {
      if (soldAnimationPlayerId !== null) {
        setSoldAnimationPlayerId(null);
        setIsFlipped(false);
        setShowGreenSweep(false);
      }
    }
  }, [status, player?._id]);

  if (loading) {
    return (
      <div className="h-screen w-screen bg-[#0c0d0e] flex flex-col items-center justify-center text-white">
        <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin mb-4" />
        <p className="text-sm tracking-widest text-zinc-400 uppercase font-medium">Loading HFPL Auction...</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-screen max-h-screen w-screen bg-[#0c0d0e] text-white flex flex-col justify-between overflow-hidden select-none font-sans relative"
    >
      {/* Green Line Sweep across Projector Screen */}
      {showGreenSweep && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          <div
            className="absolute top-0 bottom-0 w-36 sm:w-52 bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-95 animate-green-sweep"
            style={{
              boxShadow: '0 0 50px 14px rgba(52, 211, 153, 0.7)'
            }}
          />
          <div className="absolute top-1/2 -translate-y-1/2 inset-x-0 h-1.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-85" />
        </div>
      )}
      {/* ============================================================== */}
      {/* 1. PERSISTENT BRANDING: CLEAN FLAG-STYLE HEADER AT TOP         */}
      {/* ============================================================== */}
      <header className="h-16 px-6 lg:px-12 flex items-center justify-between shrink-0 z-30 border-b border-zinc-800/80 bg-[#0c0d0e]">
        {/* Flag-Style Branding Element */}
        <div className="flex items-center gap-3.5">
          <img
            src={hfplLogo}
            alt="HFPL Logo"
            className="h-10 w-auto object-contain drop-shadow-sm"
          />
          <div className="h-5 w-px bg-zinc-800" />
          <div>
            <span className="text-sm font-bold tracking-tight text-white block leading-tight">
              HFPL 2027
            </span>
            <span className="text-[10px] tracking-widest uppercase font-medium text-zinc-400 block leading-tight">
              Family Cricket Auction
            </span>
          </div>
        </div>

        {/* Set Indicator / Switcher & Display Controls */}
        <div className="flex items-center gap-3">
          {currentView === 'auction' && currentRound && (
            <button
              onClick={() => setCurrentView('sets')}
              title="Click to view or switch sets"
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-300 font-medium transition"
            >
              <Layers className="w-3.5 h-3.5 text-zinc-400" />
              <span>{currentRound.name}</span>
            </button>
          )}

          {currentView === 'auction' && (
            <>
              <button
                onClick={() => {
                  setRulesPage(1);
                  setCurrentView('rules');
                }}
                className="text-xs text-zinc-400 hover:text-white px-3 py-1.5 rounded-full hover:bg-zinc-900 transition flex items-center gap-1.5"
              >
                <BookOpen className="w-3.5 h-3.5 text-[#d4af37]" />
                <span className="hidden sm:inline">Rules</span>
              </button>
              <button
                onClick={() => setCurrentView('welcome')}
                className="text-xs text-zinc-400 hover:text-white px-3 py-1.5 rounded-full hover:bg-zinc-900 transition"
              >
                Start Screen
              </button>
            </>
          )}

          {currentView === 'rules' && (
            <>
              <button
                onClick={() => setCurrentView('welcome')}
                className="text-xs text-zinc-400 hover:text-white px-3 py-1.5 rounded-full hover:bg-zinc-900 transition flex items-center gap-1.5"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Start Screen</span>
              </button>
              <button
                onClick={handleStartAuction}
                className="text-xs bg-white text-zinc-950 font-bold px-3.5 py-1.5 rounded-full hover:bg-zinc-200 transition flex items-center gap-1 shadow-sm"
              >
                <span>Begin Auction</span>
                <Play className="w-3 h-3 fill-current" />
              </button>
            </>
          )}

          {currentView === 'welcome' && (
            <>
              {state?.currentPlayer && (
                <button
                  onClick={() => setCurrentView('auction')}
                  className="text-xs text-zinc-400 hover:text-white px-3 py-1.5 rounded-full hover:bg-zinc-900 transition"
                >
                  Live Auction
                </button>
              )}
              <button
                onClick={() => {
                  setRulesPage(1);
                  setCurrentView('rules');
                }}
                className="text-xs text-zinc-300 hover:text-white px-3 py-1.5 rounded-full bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 transition flex items-center gap-1.5"
              >
                <BookOpen className="w-3.5 h-3.5 text-[#d4af37]" />
                <span>Rules</span>
              </button>
            </>
          )}

          <div className="h-4 w-px bg-zinc-800 hidden sm:block" />

          {/* Audio & Fullscreen Buttons */}
          <div className="flex items-center gap-2">
            <AudioControl />
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Enter Fullscreen (F)'}
              className="p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* ============================================================== */}
      {/* 2. MAIN 16:9 PRESENTATION CANVAS                               */}
      {/* ============================================================== */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-6 lg:py-8 flex items-center justify-center overflow-hidden">
        
        {/* ============================================================== */}
        {/* VIEW A: REDESIGNED START / WELCOME SCREEN                      */}
        {/* ============================================================== */}
        {currentView === 'welcome' && (
          <div className="w-full max-w-3xl flex flex-col items-center text-center animate-fade-in my-auto relative z-10 py-4">
            {/* Subtle stadium-inspired pitch perimeter rings */}
            <div className="absolute -top-16 -bottom-16 -left-16 -right-16 rounded-full border border-[#d4af37]/5 pointer-events-none -z-10" />
            <div className="absolute -top-32 -bottom-32 -left-32 -right-32 rounded-full border border-zinc-800/25 pointer-events-none -z-10" />

            {/* Prominent HFPL Logo in center */}
            <div className="mb-6 sm:mb-8 relative">
              <img
                src={hfplLogo}
                alt="HFPL Logo"
                className="w-40 h-40 sm:w-48 sm:h-48 md:w-56 md:h-56 object-contain mx-auto drop-shadow-2xl"
              />
            </div>

            {/* Main Heading: HFPL 2027 */}
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight text-white mb-2 leading-none">
              HFPL 2027
            </h1>

            {/* Subtitle: FAMILY CRICKET AUCTION */}
            <p className="text-sm sm:text-base md:text-lg tracking-[0.25em] sm:tracking-[0.3em] uppercase text-zinc-300 font-bold mb-5">
              FAMILY CRICKET AUCTION
            </p>

            {/* Restrained Gold Accent Separator Line */}
            <div className="flex items-center justify-center gap-3 mb-8 w-full max-w-xs mx-auto">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#d4af37]/60" />
              <span className="w-2 h-2 rounded-full bg-[#d4af37] shadow-[0_0_8px_rgba(212,175,55,0.6)]" />
              <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#d4af37]/60" />
            </div>

            {/* Action Buttons: 1 Prominent + 1 Secondary */}
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-md justify-center">
              {/* Primary: LET'S BEGIN THE AUCTION */}
              <button
                onClick={handleStartAuction}
                className="w-full sm:w-auto px-8 py-4 rounded-full bg-white text-zinc-950 hover:bg-zinc-200 font-extrabold text-base sm:text-lg transition flex items-center justify-center gap-3 shadow-xl hover:scale-[1.02] active:scale-[0.98] tracking-wide"
              >
                <span>LET'S BEGIN THE AUCTION</span>
                <ArrowRight className="w-5 h-5 text-zinc-950" />
              </button>

              {/* Secondary: VIEW AUCTION RULES */}
              <button
                onClick={() => {
                  setRulesPage(1);
                  setCurrentView('rules');
                }}
                className="w-full sm:w-auto px-7 py-4 rounded-full bg-zinc-900/80 border border-zinc-700 hover:border-[#d4af37]/70 hover:bg-zinc-800 text-zinc-300 hover:text-white font-semibold text-sm sm:text-base transition flex items-center justify-center gap-2.5 shadow-md hover:scale-[1.02] active:scale-[0.98]"
              >
                <BookOpen className="w-4 h-4 text-[#d4af37]" />
                <span>VIEW AUCTION RULES</span>
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW B: 5-SECOND COUNTDOWN SCREEN                              */}
        {/* ============================================================== */}
        {currentView === 'countdown' && (
          <div className="w-full max-w-xl flex flex-col items-center justify-center text-center animate-fade-in my-auto py-8">
            {/* Centered stadium circle container with gold accent */}
            <div className="relative mb-8">
              {/* Outer stadium pulse ring */}
              <div className="absolute -inset-6 rounded-full border border-[#d4af37]/25 animate-pulse pointer-events-none" />
              <div className="w-52 h-52 sm:w-64 sm:h-64 rounded-full bg-gradient-to-b from-zinc-900 to-zinc-950 border-2 border-[#d4af37]/50 flex items-center justify-center shadow-2xl relative overflow-hidden">
                <div className="absolute inset-3 rounded-full border border-zinc-800/80 pointer-events-none" />

                {/* Animated Number: 5 -> 4 -> 3 -> 2 -> 1 */}
                <span
                  key={countdown}
                  className="text-8xl sm:text-9xl font-black text-white tracking-tight animate-countdown-pop drop-shadow-2xl"
                >
                  {countdown > 0 ? countdown : '0'}
                </span>
              </div>
            </div>

            {/* Prominent Announcement Message */}
            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold uppercase tracking-[0.2em] sm:tracking-[0.25em] text-[#d4af37] drop-shadow-sm">
                GET READY — AUCTION STARTING
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 font-semibold tracking-widest uppercase">
                HFPL 2027 • Official Session
              </p>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* VIEW C: AUCTION RULES SCREEN (2 Pages, 5 Rules Each)            */}
        {/* ============================================================== */}
        {currentView === 'rules' && (
          <div className="w-full max-w-5xl flex flex-col justify-between animate-fade-in my-auto h-full max-h-[85vh] py-2">
            {/* Rules Top Bar */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 shrink-0">
              <button
                onClick={() => setCurrentView('welcome')}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white hover:border-zinc-700 transition"
              >
                <Home className="w-3.5 h-3.5" />
                <span>BACK TO HOME</span>
              </button>

              <div className="text-center">
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-white uppercase">
                  Auction Rules & Regulations
                </h2>
                <p className="text-[11px] md:text-xs text-[#d4af37] font-semibold tracking-widest uppercase">
                  HFPL 2027 Tournament Code
                </p>
              </div>

              {/* Page Indicator Pill */}
              <div className="px-3 py-1 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/40 text-[#d4af37] text-xs font-bold tracking-wider uppercase">
                PAGE {rulesPage} OF 2
              </div>
            </div>

            {/* 5 Rules for Selected Page */}
            <div className="flex-1 flex flex-col justify-around py-3 sm:py-4 gap-2.5 sm:gap-3 overflow-y-auto">
              {(rulesPage === 1 ? AUCTION_RULES.slice(0, 5) : AUCTION_RULES.slice(5, 10)).map((rule) => (
                <div
                  key={rule.number}
                  className="p-3 sm:p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/80 transition flex items-start gap-3.5 sm:gap-4 shadow-sm"
                >
                  {/* Rule Number Badge */}
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[#d4af37]/15 border border-[#d4af37]/40 text-[#d4af37] font-black text-sm sm:text-base flex items-center justify-center shrink-0 shadow-sm">
                    {rule.number}
                  </div>

                  {/* Rule Content */}
                  <div className="flex-1 min-w-0 space-y-0.5 sm:space-y-1">
                    <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                      {rule.title}
                    </h3>
                    <p className="text-xs sm:text-sm md:text-base text-zinc-100 font-medium leading-relaxed">
                      {rule.english}
                    </p>
                    <p className="text-[11px] sm:text-xs md:text-sm text-zinc-400 font-normal leading-relaxed">
                      {rule.marathi}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Rules Navigation Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-zinc-800/80 shrink-0">
              {/* Previous Button */}
              <button
                onClick={() => setRulesPage(1)}
                disabled={rulesPage === 1}
                className="px-5 py-2 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-200 hover:text-white hover:border-zinc-500 font-semibold text-xs sm:text-sm transition flex items-center gap-2 disabled:opacity-30 disabled:pointer-events-none"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>PREVIOUS</span>
              </button>

              {/* Interactive Page Dots */}
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400">
                <span
                  onClick={() => setRulesPage(1)}
                  className={`cursor-pointer px-3 py-1 rounded-full transition ${
                    rulesPage === 1
                      ? 'bg-[#d4af37] text-black font-extrabold shadow-sm'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  PAGE 1
                </span>
                <span
                  onClick={() => setRulesPage(2)}
                  className={`cursor-pointer px-3 py-1 rounded-full transition ${
                    rulesPage === 2
                      ? 'bg-[#d4af37] text-black font-extrabold shadow-sm'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  PAGE 2
                </span>
              </div>

              {/* Next / Let's Begin Button */}
              {rulesPage === 1 ? (
                <button
                  onClick={() => setRulesPage(2)}
                  className="px-6 py-2 rounded-full bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-white font-semibold text-xs sm:text-sm transition flex items-center gap-2"
                >
                  <span>NEXT</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleStartAuction}
                  className="px-6 py-2 rounded-full bg-white text-zinc-950 hover:bg-zinc-200 font-extrabold text-xs sm:text-sm transition flex items-center gap-2 shadow-md hover:scale-[1.02]"
                >
                  <span>LET'S BEGIN</span>
                  <Play className="w-3.5 h-3.5 fill-current" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* VIEW B: SET SELECTION SCREEN */}
        {currentView === 'sets' && (
          <div className="w-full max-w-3xl flex flex-col items-center text-center animate-fade-in my-auto">
            <div className="flex items-center justify-between w-full mb-8">
              <button
                onClick={() => setCurrentView('welcome')}
                className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Welcome</span>
              </button>
              <span className="text-xs tracking-widest uppercase text-zinc-500 font-semibold">
                Auction Sets
              </span>
            </div>

            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-2">
              Select an Auction Set
            </h2>
            <p className="text-zinc-400 text-sm mb-8">
              Choose the set to display on the main projector.
            </p>

            {/* Set Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 w-full">
              {roundsList.map((round) => {
                const isCurrent = currentRound?._id === round._id;
                return (
                  <div
                    key={round._id}
                    onClick={() => handleSelectSet(round)}
                    className={`p-6 rounded-2xl cursor-pointer text-left transition duration-200 flex flex-col justify-between border ${
                      isCurrent
                        ? 'bg-zinc-900 border-white text-white shadow-xl'
                        : 'bg-[#151618] border-zinc-800 hover:border-zinc-600 text-zinc-200 hover:bg-[#1a1b1f]'
                    }`}
                  >
                    <div>
                      <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-white mb-4">
                        {round.order}
                      </div>
                      <h3 className="text-lg font-bold text-white mb-1.5">
                        {round.name}
                      </h3>
                      {round.description && (
                        <p className="text-xs text-zinc-400 line-clamp-2">
                          {round.description}
                        </p>
                      )}
                    </div>
                    <div className="mt-6 pt-4 border-t border-zinc-800/80 flex items-center justify-between text-xs font-medium text-zinc-400">
                      <span>Start Set</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VIEW C: PROJECTOR PLAYER AUCTION SCREEN */}
        {currentView === 'auction' && (
          !player ? (
            /* No player currently selected / idle placeholder */
            <div className="w-full max-w-xl text-center p-10 rounded-2xl bg-[#151618] border border-zinc-800 animate-fade-in my-auto">
              <img
                src={hfplLogo}
                alt="HFPL Logo"
                className="w-20 h-20 object-contain mx-auto mb-4 opacity-80"
              />
              <h3 className="text-2xl font-bold text-white mb-2">Ready for Next Player</h3>
              <p className="text-zinc-400 text-sm mb-6">
                Waiting for the auctioneer to introduce the next player from the control deck.
              </p>
              <button
                onClick={() => setCurrentView('sets')}
                className="px-6 py-2.5 rounded-full bg-white text-black font-semibold text-sm hover:bg-zinc-200 transition"
              >
                Choose Set
              </button>
            </div>
          ) : (
            /* Centred Player Card (Only 4 Items: Photo, Name, Designation, Base Price) */
            <div className="relative w-full max-w-5xl h-full max-h-[calc(100vh-140px)] flex items-center justify-center">
              
              {/* The Player Card Container */}
              <div
                className={`relative w-full rounded-2xl p-6 sm:p-8 md:p-10 lg:p-12 border bg-[#151618] overflow-hidden flex flex-col md:flex-row items-center gap-8 lg:gap-14 shadow-2xl transition-all duration-300 ${
                  status === 'sold'
                    ? 'border-red-600/60 ring-2 ring-red-500/20'
                    : status === 'bidding'
                    ? 'border-emerald-500/50 ring-2 ring-emerald-500/10'
                    : 'border-zinc-800'
                }`}
              >
                {/* Subtle HFPL Logo Watermark inside player card */}
                {/* Positioned safely in bottom-right corner at low opacity so it never obstructs face or text */}
                <img
                  src={hfplLogo}
                  alt=""
                  aria-hidden="true"
                  className="absolute right-4 bottom-4 w-48 h-48 md:w-64 md:h-64 object-contain opacity-[0.045] pointer-events-none select-none z-0"
                />

                {/* Restrained green accent streaks during active bidding */}
                {status === 'bidding' && (
                  <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />
                )}

                {/* 1. PLAYER PHOTOGRAPH (Main visual element with corner stamp & neat label below) */}
                <div className="flex flex-col items-center shrink-0 z-10">
                  <div className="relative">
                    {/* Photo frame */}
                    <div className="w-64 h-72 sm:w-72 sm:h-80 md:w-80 md:h-96 lg:w-[380px] lg:h-[460px] rounded-xl overflow-hidden border border-zinc-700/60 bg-zinc-900 shadow-md">
                      <img
                        src={resolveImageUrl(player.photo) || 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=600&auto=format&fit=crop&q=80'}
                        alt={player.name}
                        className="w-full h-full object-cover object-top"
                        onError={(e) => {
                          e.target.src = 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=600&auto=format&fit=crop&q=80';
                        }}
                      />
                    </div>

                    {/* SOLD STAMP: Compact, placed near bottom edge overlapping lower-right corner. Face is 100% visible */}
                    {status === 'sold' && (
                      <div className="absolute -bottom-3 -right-3 md:-bottom-4 md:-right-4 z-20 pointer-events-none drop-shadow-xl">
                        <SoldStamp type="sold" />
                      </div>
                    )}

                    {/* UNSOLD STAMP: Compact, placed near bottom edge overlapping lower-right corner */}
                    {status === 'unsold' && (
                      <div className="absolute -bottom-3 -right-3 md:-bottom-4 md:-right-4 z-20 pointer-events-none drop-shadow-xl">
                        <SoldStamp type="unsold" />
                      </div>
                    )}
                  </div>

                  {/* Neat winning team & final sale price label BELOW photograph */}
                  {status === 'sold' && (
                    <div className="mt-3.5 px-4 py-1.5 rounded-full bg-white text-zinc-950 font-semibold text-xs sm:text-sm shadow-md flex items-center gap-1.5 border border-zinc-200 animate-fade-in z-10">
                      <span className="text-zinc-600 font-medium">Won by</span>
                      <span className="text-red-600 font-extrabold">{highestBidder?.name || 'Winning Team'}</span>
                      <span className="text-zinc-400">•</span>
                      <span className="font-extrabold text-zinc-950">{formatINR(currentBid)}</span>
                    </div>
                  )}

                  {status === 'unsold' && (
                    <div className="mt-3.5 px-4 py-1.5 rounded-full bg-zinc-800 text-zinc-300 font-medium text-xs sm:text-sm border border-zinc-700 animate-fade-in z-10">
                      Unsold
                    </div>
                  )}
                </div>

                {/* 2, 3, 4: PLAYER DETAILS (Name, Designation, Base Price, Current Bid) */}
                <div className="flex-1 flex flex-col justify-center text-left space-y-5 lg:space-y-7 z-10 w-full">
                  
                  {/* 3. PLAYER DESIGNATION (Batter, Bowler, All-rounder, Wicketkeeper) */}
                  <div>
                    <div className="inline-flex items-center gap-2.5">
                      {status === 'bidding' ? (
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      ) : status === 'sold' ? (
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-zinc-600 shrink-0" />
                      )}
                      <span className="text-xl sm:text-2xl lg:text-3xl font-medium tracking-wide text-zinc-300">
                        {player.category}
                      </span>
                    </div>
                  </div>

                  {/* 2. PLAYER NAME (Prominent, High-Contrast Typography) */}
                  <div>
                    <h2 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight text-white leading-tight">
                      {player.name}
                    </h2>
                  </div>

                  {/* 4. BASE PRICE & FINAL SALE DETAILS / LIVE BID */}
                  <div className="pt-4 lg:pt-6 border-t border-zinc-800/80 w-full">
                    {status === 'sold' ? (
                      <div className="space-y-4 w-full">
                        {/* Compact Base Price and Status header */}
                        <div className="flex items-center justify-between text-xs sm:text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-zinc-400 font-medium uppercase tracking-wider">Base Price:</span>
                            <span className="font-bold text-zinc-200">{formatINR(player.basePrice)}</span>
                          </div>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-extrabold tracking-widest bg-red-500/20 text-red-400 border border-red-500/40">
                            SOLD
                          </span>
                        </div>

                        {/* Dedicated 3D Flip Card: Winning Team Reveal */}
                        <div className="w-full perspective-1000">
                          <div
                            className={`relative w-full rounded-2xl transition-transform duration-700 ease-out transform-style-3d ${
                              isFlipped ? 'rotate-y-180' : ''
                            }`}
                            style={{ minHeight: '175px' }}
                          >
                            {/* 1. FRONT SIDE (Pre-flip State: Hammer down / Confirming sale) */}
                            <div className="absolute inset-0 backface-hidden rounded-2xl bg-zinc-900/90 border border-red-500/30 p-5 flex flex-col items-center justify-center text-center shadow-xl">
                              <div className="w-12 h-12 rounded-full bg-red-600/20 border border-red-500/40 flex items-center justify-center mb-2 animate-bounce">
                                <Gavel className="w-6 h-6 text-red-400" />
                              </div>
                              <span className="text-[11px] font-bold uppercase tracking-widest text-red-400">
                                Hammer Down
                              </span>
                              <span className="text-sm font-semibold text-zinc-300 mt-0.5">
                                Sold! Revealing Winning Team...
                              </span>
                            </div>

                            {/* 2. BACK SIDE (Flipped: Official Logo, Team Name, Captain, Final Sale Price) */}
                            <div
                              className="backface-hidden rotate-y-180 rounded-2xl bg-gradient-to-br from-zinc-900/95 via-zinc-900 to-zinc-950 border p-5 sm:p-6 shadow-2xl flex flex-col sm:flex-row items-center gap-5 sm:gap-6 border-zinc-700"
                              style={{
                                borderColor: highestBidder?.color ? `${highestBidder.color}80` : '#ef4444',
                                boxShadow: highestBidder?.color ? `0 10px 30px -10px ${highestBidder.color}40` : '0 10px 30px -10px rgba(239, 68, 68, 0.25)'
                              }}
                            >
                              {/* Official Team Logo from client/src/team_logo/ */}
                              <div className="relative shrink-0">
                                <div
                                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl p-2 bg-zinc-950/80 border flex items-center justify-center shadow-inner overflow-hidden"
                                  style={{ borderColor: highestBidder?.color || '#52525b' }}
                                >
                                  {resolveTeamLogo(highestBidder) ? (
                                    <img
                                      src={resolveTeamLogo(highestBidder)}
                                      alt={highestBidder?.name || 'Winning Team'}
                                      className="w-full h-full object-contain filter drop-shadow-md"
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                      }}
                                    />
                                  ) : (
                                    <div
                                      className="w-full h-full rounded-xl flex items-center justify-center font-black text-2xl text-black shadow-sm"
                                      style={{ backgroundColor: highestBidder?.color || '#f59e0b' }}
                                    >
                                      {highestBidder?.code || 'HFPL'}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Team Name, Captain & Prominent Final Price */}
                              <div className="flex-1 text-center sm:text-left space-y-1.5">
                                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/15 text-red-400 border border-red-500/30">
                                  <span>Won By</span>
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                                </div>

                                <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
                                  {highestBidder?.name || 'Winning Team'}
                                </h3>

                                {highestBidder?.captain && (
                                  <p className="text-xs sm:text-sm text-zinc-300 font-medium">
                                    Captain: <span className="text-white font-bold">{highestBidder.captain}</span>
                                  </p>
                                )}

                                <div className="pt-2 border-t border-zinc-800 flex items-baseline justify-center sm:justify-start gap-3">
                                  <span className="text-xs text-zinc-400 uppercase tracking-widest font-semibold">
                                    Final Sale Price:
                                  </span>
                                  <span className="text-3xl sm:text-4xl font-black text-emerald-400 tracking-tight">
                                    {formatINR(finalSalePrice || currentBid)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-8 items-start">
                        {/* BASE PRICE */}
                        <div>
                          <span className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-zinc-400 block mb-1">
                            Base Price
                          </span>
                          <div className="flex items-baseline gap-3">
                            <span className="text-2xl sm:text-3xl lg:text-4xl font-bold text-zinc-300 tracking-tight">
                              {formatINR(player.basePrice)}
                            </span>
                          </div>
                        </div>

                        {/* LIVE BIDDING or UNSOLD */}
                        <div>
                          {status === 'unsold' ? (
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-zinc-400 block">
                                  Status
                                </span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-zinc-700 text-zinc-300 border border-zinc-600">
                                  UNSOLD
                                </span>
                              </div>

                              <div className="flex items-baseline gap-3">
                                <span className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-zinc-400">
                                  No Bids Placed
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs sm:text-sm font-semibold uppercase tracking-widest text-zinc-400 block">
                                  Current Bid
                                </span>
                                {status === 'bidding' && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 animate-pulse">
                                    Live
                                  </span>
                                )}
                              </div>

                              <div className="flex items-baseline gap-3">
                                <span
                                  className={`text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight transition-all duration-300 ${
                                    bidFlashed ? 'text-emerald-400 scale-105' : 'text-white'
                                  }`}
                                >
                                  {highestBidder ? formatINR(currentBid) : formatINR(player.basePrice)}
                                </span>
                              </div>

                              {/* Leading bidder pill */}
                              {highestBidder ? (
                                <div className="mt-2.5 inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs">
                                  {resolveTeamLogo(highestBidder) ? (
                                    <img
                                      src={resolveTeamLogo(highestBidder)}
                                      alt={highestBidder.name}
                                      className="w-4 h-4 object-contain rounded-full bg-white/10"
                                      onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                  ) : (
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                  )}
                                  <span className="text-zinc-400">Leading:</span>
                                  <span className="font-semibold text-white">{highestBidder.name}</span>
                                </div>
                              ) : (
                                <div className="mt-2 text-xs text-zinc-500 font-medium">
                                  Opening bid: {formatINR(player.basePrice)}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                </div>

              </div>
            </div>
          )
        )}
      </main>

      {/* Persistent Minimal Bottom Bar (Clean, no dashboard widgets) */}
      <footer className="h-10 px-8 flex items-center justify-between text-[11px] text-zinc-500 border-t border-zinc-900 bg-[#0c0d0e]">
        <span>HFPL Cricket Auction • Projector View</span>
        <span>Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">F</kbd> for Fullscreen</span>
      </footer>
    </div>
  );
}

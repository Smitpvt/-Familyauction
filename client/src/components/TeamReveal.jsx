import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  RotateCcw,
  ArrowLeft,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  ChevronRight,
  ChevronLeft,
  Trophy,
  Shield,
  Crown,
  User,
  Users,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { teamsAPI, resultsAPI } from '../services/api';
import { resolveTeamLogo, resolveImageUrl } from '../utils/media';
import hfplLogo from '../logo/HFPL logo-Photoroom.png';

// Clean art-directed franchise poster themes (solid colors, 2-3 hues, geometric composition)
const getTeamPosterTheme = (team) => {
  const code = (team?.code || '').toUpperCase();
  const name = (team?.name || '').toLowerCase();

  // 1. Kotawade Knight Riders (Royal Deep Purple & Championship Gold)
  if (code === 'KKR' || name.includes('knight') || name.includes('kotawade')) {
    return {
      bgDark: '#23043b', // Deep royal purple
      accent: '#f3ba2f', // Championship gold
      accentDark: '#c79218', // Layered geometric shadow accent
      textOnAccent: '#23043b', // Deep purple text on gold
      jerseyBoxBg: '#340854', // Dark purple pill
      tagline1: 'PLAY BOLD',
      tagline2: 'RIDE TOGETHER'
    };
  }

  // 2. Ratnagiri Royals (Regal Navy & Vivid Royal Pink)
  if (code === 'RR' || name.includes('royal') || name.includes('ratnagiri')) {
    return {
      bgDark: '#07122b', // Deep regal navy
      accent: '#ec4899', // Vivid royal pink
      accentDark: '#be185d', // Darker pink shadow band
      textOnAccent: '#07122b', // Deep navy text on pink
      jerseyBoxBg: '#0e224e', // Deep navy pill
      tagline1: 'ROYAL HERITAGE',
      tagline2: 'HALLA BOL',
      logoBackdrop: true // White circular contrast roundel for the pink monogram logo against pink background
    };
  }

  // 3. Malgund Maha Giants (Midnight Navy & Blaze Orange)
  if (code === 'MMG' || name.includes('giant') || name.includes('malgund')) {
    return {
      bgDark: '#081626', // Deep midnight navy
      accent: '#ea580c', // Blaze orange
      accentDark: '#c2410c', // Darker orange shadow band
      textOnAccent: '#081626', // Deep navy text on orange
      jerseyBoxBg: '#12253c', // Midnight navy pill
      tagline1: 'UNSTOPPABLE FORCE',
      tagline2: 'RISE AS GIANTS'
    };
  }

  // 4. Sherle Sunrisers (Crimson Black & Solar Gold)
  if (code === 'SS' || name.includes('sunriser') || name.includes('sherle')) {
    return {
      bgDark: '#230608', // Deep crimson black
      accent: '#f59e0b', // Solar gold
      accentDark: '#d97706', // Darker amber shadow band
      textOnAccent: '#230608', // Deep crimson text on gold
      jerseyBoxBg: '#390c10', // Deep crimson pill
      tagline1: 'SUNBURST PRIDE',
      tagline2: 'CONQUER ALL'
    };
  }

  // Dynamic fallback palette
  const pColor = team?.color || '#f59e0b';
  return {
    bgDark: '#12141a',
    accent: pColor,
    accentDark: '#92400e',
    textOnAccent: '#12141a',
    jerseyBoxBg: 'rgba(255, 255, 255, 0.08)',
    tagline1: 'OFFICIAL SQUAD',
    tagline2: 'HFPL 2027'
  };
};

export default function TeamReveal({ teamId, onBack }) {
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Presentation State
  // stage: 'intro' | 'players' | 'captain' | 'poster'
  const [stage, setStage] = useState('intro');
  const [introPhase, setIntroPhase] = useState(0); // 0: coin flip, 1: "AND THE TEAM IS...", 2: Full Name
  const [playerIndex, setPlayerIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef(null);

  // Currency formatter
  const formatINR = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  // Safe navigation back to results
  const handleReturn = () => {
    if (onBack) {
      onBack();
    } else {
      window.history.pushState({}, '', '/results');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  // Fullscreen toggle
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

  // 1. Fetch team data and squad strictly for this team ID
  useEffect(() => {
    let isMounted = true;

    const fetchTeam = async () => {
      setLoading(true);
      setError(null);

      if (!teamId) {
        setError('No team ID specified for reveal.');
        setLoading(false);
        return;
      }

      try {
        let loadedTeam = null;

        // Primary: getTeamById
        try {
          const res = await teamsAPI.getById(teamId);
          if (res.data?.success && res.data.team) {
            loadedTeam = res.data.team;
          }
        } catch (err) {
          console.warn('[TeamReveal] Primary getById lookup failed, falling back:', err);
        }

        // Fallback 1: Results summary team squads
        if (!loadedTeam) {
          try {
            const summaryRes = await resultsAPI.getSummary();
            if (summaryRes.data?.success && summaryRes.data.summary?.teamSquads) {
              const matched = summaryRes.data.summary.teamSquads.find(
                (item) => String(item._id || item.team?._id) === String(teamId)
              );
              if (matched) {
                loadedTeam = {
                  ...(matched.team || matched),
                  squad: matched.players || matched.team?.players || []
                };
              }
            }
          } catch (err) {
            console.warn('[TeamReveal] Results summary fallback lookup failed:', err);
          }
        }

        // Fallback 2: teamsAPI.getAll()
        if (!loadedTeam) {
          try {
            const allTeamsRes = await teamsAPI.getAll();
            if (allTeamsRes.data?.success && allTeamsRes.data.teams) {
              const matched = allTeamsRes.data.teams.find(
                (item) => String(item._id) === String(teamId)
              );
              if (matched) {
                loadedTeam = matched;
              }
            }
          } catch (err) {
            console.warn('[TeamReveal] GetAll fallback lookup failed:', err);
          }
        }

        if (!isMounted) return;

        if (!loadedTeam) {
          setError(`Team with ID "${teamId}" could not be found.`);
          setLoading(false);
          return;
        }

        // Sort squad chronologically in actual purchased order (soldAt or createdAt)
        const squad = [...(loadedTeam.squad || [])].sort((a, b) => {
          const timeA = a.soldAt ? new Date(a.soldAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
          const timeB = b.soldAt ? new Date(b.soldAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
          return timeA - timeB;
        });

        setTeam({
          ...loadedTeam,
          squad
        });
      } catch (err) {
        if (isMounted) setError(err.message || 'Failed to load team reveal details.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchTeam();
    return () => { isMounted = false; };
  }, [teamId]);

  // Reset and restart reveal sequence
  const handleReplay = () => {
    setStage('intro');
    setIntroPhase(0);
    setPlayerIndex(0);
    setIsPaused(false);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'Escape' || e.key === 'Backspace') {
        handleReturn();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPaused((prev) => !prev);
      } else if (e.key === 'ArrowRight') {
        if (stage === 'players' && team?.squad) {
          if (playerIndex < team.squad.length - 1) {
            setPlayerIndex((p) => p + 1);
          } else {
            setStage('captain');
          }
        } else if (stage === 'intro') {
          setStage('players');
        } else if (stage === 'captain') {
          setStage('poster');
        }
      } else if (e.key === 'ArrowLeft') {
        if (stage === 'players' && playerIndex > 0) {
          setPlayerIndex((p) => p - 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stage, playerIndex, team]);

  // Stage 1 Intro sequence timer choreography
  useEffect(() => {
    if (loading || !team || stage !== 'intro' || isPaused) return;

    // Phase 0 -> Phase 1: At 4.8s, show "AND THE TEAM IS..."
    const t1 = setTimeout(() => {
      setIntroPhase(1);
    }, 4800);

    // Phase 1 -> Phase 2: At 5.4s, reveal full team name with strong entrance
    const t2 = setTimeout(() => {
      setIntroPhase(2);
    }, 5400);

    // Phase 2 -> Stage 2 (Players): At 8.2s, transition to Player reveal
    const t3 = setTimeout(() => {
      setStage('players');
      setPlayerIndex(0);
    }, 8200);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [stage, loading, team, isPaused]);

  // Stage 2 Player reveal timer choreography: 2 seconds per player
  useEffect(() => {
    if (loading || !team || stage !== 'players' || isPaused) return;

    const squad = team.squad || [];

    // If team has no players, display graceful zero-player notice for 2s then move to captain
    if (squad.length === 0) {
      const t = setTimeout(() => {
        setStage('captain');
      }, 2000);
      return () => clearTimeout(t);
    }

    // Keep each player visible for 2 seconds before revealing the next player
    const t = setTimeout(() => {
      if (playerIndex < squad.length - 1) {
        setPlayerIndex((prev) => prev + 1);
      } else {
        // All players revealed -> transition to Stage 3 Captain reveal
        setStage('captain');
      }
    }, 2000);

    return () => clearTimeout(t);
  }, [stage, playerIndex, loading, team, isPaused]);

  // Stage 3 Captain reveal -> transitions to Stage 4 Full Poster
  useEffect(() => {
    if (loading || !team || stage !== 'captain') return;

    // Fire celebratory confetti for the grand captain entrance
    const tConfetti = setTimeout(() => {
      confetti({
        particleCount: 75,
        spread: 80,
        origin: { y: 0.6 }
      });
    }, 500);

    // After 3.8s of captain reveal, smoothly transition to the complete team poster
    const tPoster = setTimeout(() => {
      setStage('poster');
    }, 3800);

    return () => {
      clearTimeout(tConfetti);
      clearTimeout(tPoster);
    };
  }, [stage, loading, team]);

  // Stage 4 Poster entrance celebration
  useEffect(() => {
    if (stage === 'poster') {
      confetti({
        particleCount: 110,
        spread: 100,
        origin: { y: 0.45 }
      });
    }
  }, [stage]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#08090a] text-white flex flex-col items-center justify-center font-sans">
        <div className="w-12 h-12 border-3 border-amber-500/30 border-t-amber-400 rounded-full animate-spin mb-4" />
        <p className="text-sm tracking-widest text-zinc-400 uppercase font-semibold">Preparing Cinematic Reveal...</p>
      </div>
    );
  }

  // Error state
  if (error || !team) {
    return (
      <div className="min-h-screen bg-[#08090a] text-white flex flex-col items-center justify-center font-sans p-6">
        <div className="max-w-md w-full bg-[#151618] border border-zinc-800 rounded-2xl p-6 text-center">
          <Shield className="w-12 h-12 text-zinc-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-white mb-2">Team Reveal Unavailable</h2>
          <p className="text-sm text-zinc-400 mb-6">{error || 'Team details could not be retrieved.'}</p>
          <button
            onClick={handleReturn}
            className="px-5 py-2.5 rounded-full bg-white text-black font-semibold text-sm hover:bg-zinc-200 transition inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Results</span>
          </button>
        </div>
      </div>
    );
  }

  const logoSrc = resolveTeamLogo(team);
  const teamColor = team.color || '#f59e0b';
  const squad = team.squad || [];
  const currentPlayer = squad[playerIndex];
  const rawCaptain = team.captain?.trim() || '';
  const captainName = /sheslekar/i.test(rawCaptain) ? 'Shrirang Sherlekar' : (rawCaptain || 'Team Captain');
  const theme = getTeamPosterTheme(team);

  // Divide squad into two balanced columns if roster is large
  const halfSquad = Math.ceil(squad.length / 2);
  const rosterCol1 = squad.length > 5 ? squad.slice(0, halfSquad) : squad;
  const rosterCol2 = squad.length > 5 ? squad.slice(halfSquad) : [];

  // Team name split for two-tone hero headline
  const nameParts = (team?.name || '').trim().split(' ');
  const headlineLine1 = nameParts[0] || team?.name || '';
  const headlineLine2 = nameParts.slice(1).join(' ');

  // Clean roster row renderer for art-directed announcement poster
  const renderPlayerRow = (p, idx) => {
    const jerseyNum = p.jerseyNumber || p.jersey || String(idx + 1).padStart(2, '0');
    return (
      <div
        key={p._id || idx}
        className="flex items-center justify-between py-2 sm:py-2.5 border-b border-white/15"
      >
        <div className="flex items-center min-w-0 pr-3">
          <div
            className="w-8 sm:w-9 h-6 sm:h-7 rounded-[4px] flex items-center justify-center shrink-0 border border-white/10 shadow-sm"
            style={{ backgroundColor: theme.jerseyBoxBg }}
          >
            <span className="font-mono font-black text-xs sm:text-sm tracking-wider text-white">
              {jerseyNum}
            </span>
          </div>
          <span className="font-black uppercase text-white tracking-wide text-xs sm:text-sm lg:text-base truncate ml-3 sm:ml-4">
            {p.name}
          </span>
        </div>
        <div className="px-3 sm:px-3.5 py-0.5 sm:py-1 rounded-full bg-white/10 border border-white/10 shrink-0">
          <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-white/80">
            {p.category || 'ALL-ROUNDER'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className="relative min-h-screen w-full bg-[#08090a] text-white overflow-hidden flex flex-col justify-between font-sans selection:bg-amber-500 selection:text-black"
      style={{
        backgroundImage: `radial-gradient(circle at 50% 40%, ${teamColor}15 0%, #08090a 75%)`
      }}
    >
      {/* Top Floating Control Bar */}
      <header className="absolute top-0 left-0 right-0 z-40 px-4 sm:px-8 py-3.5 flex items-center justify-between pointer-events-none">
        {/* Back Button */}
        <button
          onClick={handleReturn}
          className="pointer-events-auto px-3.5 py-1.5 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/60 backdrop-blur-md transition flex items-center gap-2 text-xs font-semibold shadow-lg hover:text-white"
          title="Return to Results (Esc)"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Results</span>
        </button>

        {/* Center Stage Breadcrumb */}
        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 px-3 py-1 rounded-full bg-zinc-950/70 border border-zinc-800/80 backdrop-blur-md text-[10px] sm:text-xs text-zinc-400 font-medium">
          <span className={`px-2 py-0.5 rounded-full transition ${stage === 'intro' ? 'bg-amber-500/20 text-amber-300 font-bold' : ''}`}>
            Intro
          </span>
          <span>•</span>
          <span className={`px-2 py-0.5 rounded-full transition ${stage === 'players' ? 'bg-amber-500/20 text-amber-300 font-bold' : ''}`}>
            Squad ({squad.length})
          </span>
          <span>•</span>
          <span className={`px-2 py-0.5 rounded-full transition ${stage === 'captain' ? 'bg-amber-500/20 text-amber-300 font-bold' : ''}`}>
            Captain
          </span>
          <span>•</span>
          <span className={`px-2 py-0.5 rounded-full transition ${stage === 'poster' ? 'bg-amber-500/20 text-amber-300 font-bold' : ''}`}>
            Full Poster
          </span>
        </div>

        {/* Action Controls */}
        <div className="pointer-events-auto flex items-center gap-2">
          {stage === 'players' && (
            <button
              onClick={() => setIsPaused((prev) => !prev)}
              className="p-1.5 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/60 backdrop-blur-md transition shadow-lg hover:text-white"
              title={isPaused ? 'Resume reveal (Space)' : 'Pause reveal (Space)'}
            >
              {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5" />}
            </button>
          )}

          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/60 backdrop-blur-md transition shadow-lg hover:text-white"
            title="Toggle Projector Fullscreen (F)"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* MAIN PRESENTATION STAGE */}
      <main className="flex-1 flex items-center justify-center p-3 sm:p-6 lg:p-8 relative z-10 w-full max-w-7xl mx-auto pt-14">
        
        {/* ======================================================== */}
        {/* STAGE 1 — INTRO WITH 3D COIN FLIP & NAME REVEAL          */}
        {/* ======================================================== */}
        {stage === 'intro' && (
          <div className="flex flex-col items-center justify-center text-center w-full max-w-2xl mx-auto space-y-6">
            
            {/* 3D Realistic Coin Container */}
            <div className="relative w-56 h-56 sm:w-72 sm:h-72 flex items-center justify-center perspective-1000">
              
              {/* Radial plinth backlight matching team color */}
              <div
                className="absolute inset-0 rounded-full blur-3xl opacity-35 transition-all duration-1000"
                style={{ backgroundColor: teamColor }}
              />

              {/* The Spinning 3D Coin */}
              <div
                className="w-48 h-48 sm:w-60 sm:h-60 rounded-full bg-gradient-to-br from-zinc-800 via-zinc-900 to-black p-3 sm:p-4 border-4 sm:border-[6px] shadow-2xl flex items-center justify-center animate-coin-flip relative overflow-hidden"
                style={{
                  borderColor: teamColor || '#f59e0b',
                  boxShadow: `0 0 50px ${teamColor}40, inset 0 0 25px rgba(0,0,0,0.8)`
                }}
              >
                {/* Metallic Coin Rim Texture & Specular Glint */}
                <div className="absolute inset-1 rounded-full border border-white/20 pointer-events-none" />
                <div className="absolute -inset-full bg-gradient-to-r from-transparent via-white/10 to-transparent rotate-45 pointer-events-none" />

                {/* Team Logo Centered inside Coin */}
                {logoSrc ? (
                  <img
                    src={logoSrc}
                    alt={team.name}
                    className="w-full h-full object-contain filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  <span className="text-4xl sm:text-5xl font-black tracking-wider text-white">
                    {team.code}
                  </span>
                )}
              </div>
            </div>

            {/* Stage 1 Text Sequence */}
            <div className="min-h-[140px] flex flex-col items-center justify-center space-y-3">
              {introPhase >= 1 && (
                <p className="text-xs sm:text-sm md:text-base font-bold tracking-[0.35em] text-amber-400 uppercase animate-dramatic-entrance">
                  AND THE TEAM IS…
                </p>
              )}

              {introPhase >= 2 && (
                <div className="animate-dramatic-entrance flex flex-col items-center">
                  <h1
                    className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-white uppercase drop-shadow-lg"
                    style={{
                      textShadow: `0 0 35px ${teamColor}80`
                    }}
                  >
                    {team.name}
                  </h1>
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider text-black shadow"
                      style={{ backgroundColor: teamColor }}
                    >
                      {team.code}
                    </span>
                    <span className="text-xs sm:text-sm text-zinc-400 font-medium">
                      HFPL Premier Franchise
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Skip Intro Button */}
            <button
              onClick={() => {
                setStage('players');
                setPlayerIndex(0);
              }}
              className="px-4 py-1.5 rounded-full bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 text-xs font-medium transition"
            >
              Skip to Squad &rarr;
            </button>
          </div>
        )}

        {/* ======================================================== */}
        {/* STAGE 2 — SEQUENTIAL PLAYER REVEAL (LEFT ENTRANCE)       */}
        {/* ======================================================== */}
        {stage === 'players' && (
          <div className="w-full max-w-3xl mx-auto flex flex-col items-center">
            
            {/* Header / Tracker */}
            <div className="w-full flex items-center justify-between mb-4 px-2">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">
                  Squad Reveal
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">
                  {squad.length > 0 ? `${playerIndex + 1} of ${squad.length}` : '0 Players'}
                </span>
              </div>
              <div className="text-xs text-zinc-400 font-medium">
                Purchased Player Order
              </div>
            </div>

            {/* Player Card Slide-in Container */}
            {squad.length === 0 ? (
              // Graceful handling when team has no players
              <div className="w-full bg-[#151618] border border-zinc-800 rounded-3xl p-8 sm:p-12 text-center animate-slide-in-left shadow-2xl">
                <Users className="w-14 h-14 text-zinc-600 mx-auto mb-3" />
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">No Players Acquired Yet</h3>
                <p className="text-sm text-zinc-400 mb-4">This team did not purchase any players during the auction.</p>
                <p className="text-xs text-amber-400 uppercase tracking-widest font-semibold animate-pulse">
                  Proceeding to Captain Reveal...
                </p>
              </div>
            ) : currentPlayer ? (
              // Active Player Card Entering from Left
              <div
                key={currentPlayer._id || playerIndex}
                className="w-full bg-gradient-to-br from-[#16171a] via-[#121316] to-[#0c0d0e] border border-zinc-700/80 rounded-3xl p-5 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.85)] animate-slide-in-left relative overflow-hidden"
              >
                {/* Ambient glow matching team color */}
                <div
                  className="absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none"
                  style={{ backgroundColor: teamColor }}
                />

                <div className="flex flex-col sm:flex-row items-center sm:items-stretch gap-6 sm:gap-8">
                  
                  {/* Player Photo Frame */}
                  <div className="relative w-44 h-44 sm:w-56 sm:h-56 rounded-2xl bg-zinc-900 border-2 border-zinc-700/80 p-2 shrink-0 flex items-center justify-center overflow-hidden shadow-inner">
                    {currentPlayer.photo ? (
                      <img
                        src={resolveImageUrl(currentPlayer.photo)}
                        alt={currentPlayer.name}
                        className="w-full h-full object-cover rounded-xl"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full rounded-xl bg-zinc-800 flex flex-col items-center justify-center text-zinc-500">
                        <User className="w-16 h-16 sm:w-20 sm:h-20 stroke-1 mb-1" />
                        <span className="text-[10px] tracking-wider uppercase font-semibold">HFPL Player</span>
                      </div>
                    )}

                    {/* Pick sequence badge */}
                    <div className="absolute top-3 left-3 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md border border-white/20 text-[10px] font-bold text-amber-400 uppercase">
                      Pick #{playerIndex + 1}
                    </div>
                  </div>

                  {/* Player Details */}
                  <div className="flex-1 flex flex-col justify-between text-center sm:text-left min-w-0 w-full">
                    <div>
                      {/* Category & Badge */}
                      <div className="flex items-center justify-center sm:justify-start gap-2 mb-2 flex-wrap">
                        <span className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider">
                          {currentPlayer.category || 'All-rounder'}
                        </span>
                        {currentPlayer.battingStyle && (
                          <span className="px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 text-[11px] font-medium">
                            {currentPlayer.battingStyle}
                          </span>
                        )}
                        {currentPlayer.bowlingStyle && (
                          <span className="px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[11px] font-medium hidden md:inline">
                            {currentPlayer.bowlingStyle}
                          </span>
                        )}
                      </div>

                      {/* Player Full Name */}
                      <h2 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight text-white leading-tight mb-2 truncate">
                        {currentPlayer.name}
                      </h2>

                      {/* Team Association pill */}
                      <div className="flex items-center justify-center sm:justify-start gap-2 text-xs text-zinc-400">
                        <span>Sold to:</span>
                        <span className="text-white font-bold">{team.name}</span>
                        <span>({team.code})</span>
                      </div>
                    </div>

                    {/* Final Sold Price Box */}
                    <div className="mt-6 pt-4 border-t border-zinc-800/80 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] sm:text-xs uppercase tracking-widest text-zinc-400 font-semibold block">
                          Final Purchase Price
                        </span>
                        <span className="text-2xl sm:text-4xl font-black text-emerald-400 tracking-tight">
                          {formatINR(currentPlayer.soldPrice)}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] sm:text-xs uppercase tracking-widest text-zinc-500 block">
                          Base Price
                        </span>
                        <span className="text-sm sm:text-base font-semibold text-zinc-300">
                          {formatINR(currentPlayer.basePrice || 200)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2-Second Timer Progress Bar Indicator */}
                {!isPaused && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-800">
                    <div
                      key={`timer-${playerIndex}`}
                      className="h-full bg-amber-400 transition-all duration-[2000ms] ease-linear w-full origin-left animate-[progress_2s_linear]"
                    />
                  </div>
                )}
              </div>
            ) : null}

            {/* Manual Stage 2 Controls */}
            {squad.length > 0 && (
              <div className="flex items-center justify-between w-full mt-4 px-2">
                <button
                  onClick={() => playerIndex > 0 && setPlayerIndex((p) => p - 1)}
                  disabled={playerIndex === 0}
                  className="px-3 py-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 text-xs font-semibold disabled:opacity-30 disabled:pointer-events-none transition flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                <button
                  onClick={() => {
                    if (playerIndex < squad.length - 1) {
                      setPlayerIndex((p) => p + 1);
                    } else {
                      setStage('captain');
                    }
                  }}
                  className="px-4 py-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold transition flex items-center gap-1 shadow"
                >
                  <span>{playerIndex < squad.length - 1 ? 'Next Player' : 'Reveal Captain'}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* STAGE 3 — DEDICATED CAPTAIN REVEAL                       */}
        {/* ======================================================== */}
        {stage === 'captain' && (
          <div className="w-full max-w-3xl mx-auto flex flex-col items-center">
            
            {/* Captain Card entering from left */}
            <div
              className="w-full bg-gradient-to-br from-[#1a1714] via-[#141315] to-[#0c0d0e] border-2 border-amber-500/60 rounded-3xl p-6 sm:p-10 shadow-[0_25px_70px_rgba(245,158,11,0.25)] animate-slide-in-left relative overflow-hidden text-center sm:text-left"
            >
              {/* Golden Ambient backlight */}
              <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-amber-500 blur-3xl opacity-20 pointer-events-none" />

              <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
                
                {/* Captain Badge & Team Icon Frame */}
                <div className="relative w-44 h-44 sm:w-56 sm:h-56 rounded-2xl bg-gradient-to-br from-amber-500/20 via-zinc-900 to-black border-2 border-amber-400/80 p-3 shrink-0 flex flex-col items-center justify-center overflow-hidden shadow-2xl">
                  {logoSrc ? (
                    <img
                      src={logoSrc}
                      alt={team.name}
                      className="w-28 h-28 sm:w-36 sm:h-36 object-contain filter drop-shadow-md"
                    />
                  ) : (
                    <Shield className="w-24 h-24 text-amber-400" />
                  )}
                  <div className="mt-2 px-3 py-0.5 rounded-full bg-amber-400 text-black text-[11px] font-black uppercase tracking-wider">
                    {team.code}
                  </div>
                </div>

                {/* Captain Details */}
                <div className="flex-1 flex flex-col justify-between w-full">
                  <div>
                    {/* Official Badge */}
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/60 text-amber-300 text-xs sm:text-sm font-black uppercase tracking-widest mb-3">
                      <Crown className="w-4 h-4 fill-amber-400 text-amber-400" />
                      <span>TEAM CAPTAIN</span>
                    </div>

                    {/* Captain Name Prominent */}
                    <h2 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-white leading-tight mb-2">
                      {captainName}
                    </h2>

                    <p className="text-sm sm:text-base text-zinc-300 font-medium">
                      Official Tournament Captain & Strategic Leader
                    </p>
                    <p className="text-xs text-zinc-400 mt-1">
                      {team.name}
                    </p>
                  </div>

                  {/* Team Stats Summary */}
                  <div className="mt-6 pt-4 border-t border-zinc-800 flex items-center justify-between text-xs sm:text-sm">
                    <div>
                      <span className="text-zinc-500 uppercase tracking-widest text-[10px] block">Total Squad</span>
                      <span className="font-bold text-white text-base sm:text-lg">{squad.length} Players</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 uppercase tracking-widest text-[10px] block">Purse Spent</span>
                      <span className="font-bold text-emerald-400 text-base sm:text-lg">{formatINR(team.totalSpent)}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 uppercase tracking-widest text-[10px] block">Remaining</span>
                      <span className="font-bold text-white text-base sm:text-lg">{formatINR(team.remainingPurse)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end w-full">
              <button
                onClick={() => setStage('poster')}
                className="px-4 py-1.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold transition flex items-center gap-1 shadow"
              >
                <span>View Full Team Poster</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STAGE 4 — FINAL FULL-SQUAD CRICKET POSTER                */}
        {/* ======================================================== */}
        {stage === 'poster' && (
          <div className="w-full max-w-6xl mx-auto animate-dramatic-entrance flex flex-col items-center">
            
            {/* The Master Poster 16:9 Canvas */}
            <div
              className="relative w-full rounded-2xl sm:rounded-3xl border border-white/10 shadow-[0_30px_90px_rgba(0,0,0,0.9)] overflow-hidden select-none min-h-[560px] sm:min-h-[600px] lg:aspect-[16/9]"
              style={{
                backgroundColor: theme.bgDark
              }}
            >
              {/* Layered Geometric Angular Accents */}
              {/* 1. Underlying Accent Dark Depth Band */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundColor: theme.accentDark,
                  clipPath: 'polygon(73% 0%, 100% 0%, 100% 100%, 48% 100%)'
                }}
              />
              {/* 2. Primary Vibrant Accent Geometric Polygon */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundColor: theme.accent,
                  clipPath: 'polygon(77% 0%, 100% 0%, 100% 100%, 52% 100%)'
                }}
              />
              {/* 3. Subtle Warm Angular Gradient in Bottom-Right Corner */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'linear-gradient(135deg, transparent 65%, rgba(0, 0, 0, 0.15) 100%)',
                  clipPath: 'polygon(77% 0%, 100% 0%, 100% 100%, 52% 100%)'
                }}
              />

              {/* POSTER FOREGROUND CONTENT */}
              <div className="relative z-10 w-full h-full p-6 sm:p-8 lg:p-10 flex flex-col justify-between">
                
                {/* 1. TOP HEADER: HFPL BRANDING (LEFT) & TEAM CODE / SEASON (RIGHT) */}
                <div className="flex items-start justify-between gap-4">
                  {/* Left: Tournament Identity */}
                  <div className="flex items-center gap-3">
                    <img
                      src={hfplLogo}
                      alt="HFPL"
                      className="h-10 sm:h-12 w-auto object-contain filter drop-shadow-sm shrink-0"
                    />
                    <div>
                      <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-[0.22em] text-white block leading-tight">
                        HAPPY FAMILY PREMIER LEAGUE 2027
                      </span>
                      <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.28em] text-white/70 block leading-tight mt-0.5">
                        OFFICIAL TEAM SQUAD
                      </span>
                    </div>
                  </div>

                  {/* Right: Team Code & Season (Positioned over accent geometry) */}
                  <div className="text-right">
                    <span
                      className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-wider block leading-none"
                      style={{ color: theme.textOnAccent }}
                    >
                      {team.code}
                    </span>
                    <span
                      className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.3em] block mt-1"
                      style={{ color: theme.textOnAccent, opacity: 0.85 }}
                    >
                      SEASON 2027
                    </span>
                  </div>
                </div>

                {/* 2. MAIN BODY: LEFT CONTENT (HEADLINE + ROSTER + CAPTAIN) & RIGHT LOGO */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center flex-1 my-3 lg:my-5">
                  
                  {/* LEFT COLUMN: HERO TEAM HEADLINE, ROSTER, AND CAPTAIN */}
                  <div className="lg:col-span-7 xl:col-span-8 flex flex-col justify-between h-full min-w-0 pr-0 lg:pr-6">
                    
                    {/* Team Name Hero Headline */}
                    <div className="pt-1">
                      <h1 className="font-black uppercase tracking-tight leading-[0.92] text-3xl sm:text-5xl lg:text-6xl xl:text-7xl">
                        <span className="block text-white">{headlineLine1}</span>
                        {headlineLine2 && (
                          <span className="block" style={{ color: theme.accent }}>
                            {headlineLine2}
                          </span>
                        )}
                      </h1>
                    </div>

                    {/* Player Roster Section */}
                    <div className="my-auto py-3">
                      {squad.length === 0 ? (
                        <div className="py-6 text-center text-white/50 text-xs font-semibold tracking-widest uppercase border-y border-white/15">
                          No Squad Players Acquired
                        </div>
                      ) : squad.length > 5 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 border-t border-white/15">
                          <div>
                            {rosterCol1.map((p, idx) => renderPlayerRow(p, idx))}
                          </div>
                          <div>
                            {rosterCol2.map((p, idx) => renderPlayerRow(p, halfSquad + idx))}
                          </div>
                        </div>
                      ) : (
                        <div className="border-t border-white/15">
                          {squad.map((p, idx) => renderPlayerRow(p, idx))}
                        </div>
                      )}
                    </div>

                    {/* Captain Section */}
                    <div className="pt-2 flex items-center">
                      {/* Geometric Crown Silhouette matching reference design */}
                      <svg
                        className="w-9 h-9 sm:w-11 sm:h-11 shrink-0"
                        viewBox="0 0 48 48"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        style={{ color: theme.accent }}
                      >
                        <path d="M6 14L13 32H35L42 14L31 22L24 8L17 22L6 14Z" fill="currentColor" />
                        <rect x="13" y="35" width="22" height="4" rx="1" fill="currentColor" />
                      </svg>

                      <div className="ml-3 sm:ml-4 min-w-0">
                        <span
                          className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.3em] block leading-tight"
                          style={{ color: theme.accent }}
                        >
                          CAPTAIN
                        </span>
                        <h2 className="text-xl sm:text-3xl lg:text-4xl font-black text-white uppercase tracking-tight leading-none mt-1 truncate">
                          {captainName}
                        </h2>
                      </div>
                    </div>

                  </div>

                  {/* RIGHT COLUMN: OFFICIAL TEAM LOGO */}
                  <div className="hidden lg:flex lg:col-span-5 xl:col-span-4 flex-col items-center justify-center relative h-full">
                    <div className="w-full flex items-center justify-center py-4">
                      {logoSrc ? (
                        theme.logoBackdrop ? (
                          <div className="w-56 h-56 sm:w-64 sm:h-64 lg:w-72 lg:h-72 rounded-full bg-white shadow-[0_15px_35px_rgba(0,0,0,0.25)] border-2 border-white/80 flex items-center justify-center p-6 sm:p-7 transition-transform duration-500 hover:scale-105">
                            <img
                              src={logoSrc}
                              alt={team.name}
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          </div>
                        ) : (
                          <img
                            src={logoSrc}
                            alt={team.name}
                            className="max-w-[240px] xl:max-w-[320px] max-h-[240px] xl:max-h-[320px] object-contain filter drop-shadow-[0_15px_30px_rgba(0,0,0,0.35)] transition-transform duration-500 hover:scale-105"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        )
                      ) : (
                        <div
                          className="text-6xl xl:text-7xl font-black uppercase tracking-wider select-none"
                          style={{ color: theme.textOnAccent }}
                        >
                          {team.code}
                        </div>
                      )}
                    </div>
                  </div>

                </div>

                {/* Mobile Team Logo (fallback for narrow screens) */}
                <div className="flex lg:hidden items-center justify-center py-3">
                  {logoSrc && (
                    theme.logoBackdrop ? (
                      <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-full bg-white p-3 sm:p-4 shadow-xl border border-white/80 flex items-center justify-center">
                        <img
                          src={logoSrc}
                          alt={team.name}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <img
                        src={logoSrc}
                        alt={team.name}
                        className="max-w-[150px] sm:max-w-[180px] max-h-[150px] sm:max-h-[180px] object-contain filter drop-shadow-md"
                      />
                    )
                  )}
                </div>

                {/* 3. BOTTOM RIGHT TEAM TAGLINE */}
                <div className="absolute bottom-6 sm:bottom-8 right-6 sm:right-10 text-right pointer-events-none select-none">
                  <span
                    className="text-[9px] sm:text-[10px] lg:text-[11px] font-extrabold uppercase tracking-[0.35em] block leading-tight"
                    style={{ color: theme.textOnAccent, opacity: 0.85 }}
                  >
                    {theme.tagline1}
                  </span>
                  <span
                    className="text-[9px] sm:text-[10px] lg:text-[11px] font-extrabold uppercase tracking-[0.35em] block leading-tight mt-0.5"
                    style={{ color: theme.textOnAccent, opacity: 0.85 }}
                  >
                    {theme.tagline2}
                  </span>
                </div>

              </div>
            </div>

            {/* Poster Actions: Replay & Return to Results */}
            <div className="flex items-center justify-center gap-3 sm:gap-4 mt-5">
              <button
                onClick={handleReplay}
                className="px-5 py-2.5 rounded-full bg-zinc-900/90 hover:bg-zinc-800 text-white font-semibold text-xs border border-zinc-700/80 transition flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Replay Reveal</span>
              </button>

              <button
                onClick={handleReturn}
                className="px-6 py-2.5 rounded-full bg-white hover:bg-zinc-200 text-black font-bold text-xs transition flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Results</span>
              </button>
            </div>

          </div>
        )}

      </main>

      {/* Footer Branding */}
      <footer className="w-full py-2.5 px-6 text-center text-[11px] text-zinc-600 border-t border-zinc-900/80 relative z-20 flex items-center justify-between">
        <span>HFPL Premier Cricket Auction 2027</span>
        <span className="font-medium text-zinc-500">Projector Mode &bull; {team.name}</span>
      </footer>
    </div>
  );
}

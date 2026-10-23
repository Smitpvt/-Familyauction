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
  Sparkles,
  Volume2,
  VolumeX
} from 'lucide-react';
import { teamsAPI, resultsAPI } from '../services/api';
import { resolveTeamLogo, resolveImageUrl } from '../utils/media';
import hfplLogo from '../logo/HFPL logo-Photoroom.png';

// Background IPL anthem audio asset from client/src/iplsong
import iplSongUrl from 'virtual:ipl-song';

// Clean art-directed franchise poster themes (solid colors, 2-3 hues, geometric composition)
const getTeamPosterTheme = (team) => {
  const code = (team?.code || '').toUpperCase();
  const name = (team?.name || '').toLowerCase();

  // 1. Kotawade Knight Riders (Royal Deep Purple & Championship Gold)
  // Vertical shield logo (1009 x 1559) — scaled up by ~24%
  if (code === 'KKR' || name.includes('knight') || name.includes('kotawade')) {
    return {
      bgDark: '#23043b', // Deep royal purple
      accent: '#f3ba2f', // Championship gold
      accentDark: '#c79218', // Layered geometric shadow accent
      textOnAccent: '#23043b', // Deep purple text on gold
      jerseyBoxBg: '#340854', // Dark purple pill
      tagline1: 'PLAY BOLD',
      tagline2: 'RIDE TOGETHER',
      logoClasses: 'max-w-[150px] sm:max-w-[200px] lg:max-w-[250px] xl:max-w-[285px] max-h-[150px] sm:max-h-[200px] lg:max-h-[250px] xl:max-h-[285px]'
    };
  }

  // 2. Ratnagiri Royals (Regal Navy & Vivid Royal Pink)
  // Vertical crest (1069 x 1472) inside contrast circular roundel — roundel scaled up by ~23%
  if (code === 'RR' || name.includes('royal') || name.includes('ratnagiri')) {
    return {
      bgDark: '#07122b', // Deep regal navy
      accent: '#ec4899', // Vivid royal pink
      accentDark: '#be185d', // Darker pink shadow band
      textOnAccent: '#07122b', // Deep navy text on pink
      jerseyBoxBg: '#0e224e', // Deep navy pill
      tagline1: 'ROYAL HERITAGE',
      tagline2: 'HALLA BOL',
      logoBackdrop: true, // White circular contrast roundel for the pink monogram logo against pink background
      backdropClasses: 'w-[136px] h-[136px] sm:w-[176px] sm:h-[176px] lg:w-[220px] lg:h-[220px] xl:w-[256px] xl:h-[256px]'
    };
  }

  // 3. Malgund Maha Giants (Midnight Navy & Blaze Orange)
  // Square emblem logo (1254 x 1254) — scaled up by ~22%
  if (code === 'MMG' || name.includes('giant') || name.includes('malgund')) {
    return {
      bgDark: '#081626', // Deep midnight navy
      accent: '#ea580c', // Blaze orange
      accentDark: '#c2410c', // Darker orange shadow band
      textOnAccent: '#081626', // Deep navy text on orange
      jerseyBoxBg: '#12253c', // Midnight navy pill
      tagline1: 'UNSTOPPABLE FORCE',
      tagline2: 'RISE AS GIANTS',
      logoClasses: 'max-w-[145px] sm:max-w-[195px] lg:max-w-[245px] xl:max-w-[280px] max-h-[145px] sm:max-h-[195px] lg:max-h-[245px] xl:max-h-[280px]'
    };
  }

  // 4. Sherle Sunrisers (Crimson Black & Solar Gold)
  // Horizontal emblem logo (1536 x 1024) — scaled up by ~26%
  if (code === 'SS' || name.includes('sunriser') || name.includes('sherle')) {
    return {
      bgDark: '#230608', // Deep crimson black
      accent: '#f59e0b', // Solar gold
      accentDark: '#d97706', // Darker amber shadow band
      textOnAccent: '#230608', // Deep crimson text on gold
      jerseyBoxBg: '#390c10', // Deep crimson pill
      tagline1: 'SUNBURST PRIDE',
      tagline2: 'CONQUER ALL',
      logoClasses: 'max-w-[150px] sm:max-w-[200px] lg:max-w-[250px] xl:max-w-[290px] max-h-[140px] sm:max-h-[185px] lg:max-h-[230px] xl:max-h-[265px]'
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
    tagline2: 'HFPL 2027',
    logoClasses: 'max-w-[150px] sm:max-w-[200px] lg:max-w-[250px] xl:max-w-[285px] max-h-[150px] sm:max-h-[200px] lg:max-h-[250px] xl:max-h-[285px]'
  };
};

export default function TeamReveal({ teamId, onBack }) {
  const [currentTeamId, setCurrentTeamId] = useState(teamId);
  const [team, setTeam] = useState(null);
  const [allTeams, setAllTeams] = useState([]);
  const [revealedTeamIds, setRevealedTeamIds] = useState(() => (teamId ? [String(teamId)] : []));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Presentation State
  // stage: 'intro' | 'players' | 'captain' | 'poster'
  const [stage, setStage] = useState('intro');
  const [introPhase, setIntroPhase] = useState(0); // 0: coin flip, 1: "AND THE TEAM IS...", 2: Full Name
  const [playerIndex, setPlayerIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Animation & Audio State
  const [coinFlipped, setCoinFlipped] = useState(false);
  const [revealKey, setRevealKey] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef(null);
  const containerRef = useRef(null);

  // Sync external teamId prop if changed
  useEffect(() => {
    if (teamId && String(teamId) !== String(currentTeamId)) {
      setCurrentTeamId(teamId);
      setRevealedTeamIds((prev) => (prev.includes(String(teamId)) ? prev : [...prev, String(teamId)]));
    }
  }, [teamId]);

  // Background IPL Anthem Audio Controller
  useEffect(() => {
    if (!iplSongUrl) return;

    // Single persistent audio instance across the entire reveal experience
    const audio = new Audio(iplSongUrl);
    audio.loop = true;
    audio.volume = 0.75;
    audioRef.current = audio;

    // Start playing as soon as reveal begins
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.log('[TeamReveal] Background music autoplay blocked by browser policy; awaiting user interaction:', err);
      });
    }

    // Interaction fallback: Start playback on first click, keypress, or touch
    const handleGesture = () => {
      if (audioRef.current && audioRef.current.paused && !isMuted) {
        audioRef.current.play().catch(() => {});
      }
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('keydown', handleGesture);
      window.removeEventListener('touchstart', handleGesture);
    };

    window.addEventListener('click', handleGesture);
    window.addEventListener('keydown', handleGesture);
    window.addEventListener('touchstart', handleGesture);

    return () => {
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('keydown', handleGesture);
      window.removeEventListener('touchstart', handleGesture);
      audio.pause();
      audio.currentTime = 0;
      audioRef.current = null;
    };
  }, []);

  // Audio mute/unmute control
  const toggleMute = () => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.muted = false;
        audioRef.current.play().catch(() => {});
        setIsMuted(false);
      } else {
        audioRef.current.muted = true;
        setIsMuted(true);
      }
    } else {
      setIsMuted((prev) => !prev);
    }
  };

  // Currency formatter
  const formatINR = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  // Safe navigation back to results (stops music and cleans up)
  const handleReturn = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
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

  // 1. Fetch team data, squad for currentTeamId, and full list of teams
  useEffect(() => {
    let isMounted = true;

    const fetchTeam = async () => {
      setLoading(true);
      setError(null);

      const targetId = currentTeamId || teamId;
      if (!targetId) {
        setError('No team ID specified for reveal.');
        setLoading(false);
        return;
      }

      try {
        let loadedTeam = null;
        let loadedAllTeams = [];

        // Primary: Results summary contains all teams and their sold squads
        try {
          const summaryRes = await resultsAPI.getSummary();
          if (summaryRes.data?.success && summaryRes.data.summary?.teamSquads) {
            loadedAllTeams = summaryRes.data.summary.teamSquads;
            const matched = loadedAllTeams.find(
              (item) => String(item._id || item.team?._id) === String(targetId)
            );
            if (matched) {
              loadedTeam = {
                ...(matched.team || matched),
                squad: matched.players || matched.team?.players || []
              };
            }
          }
        } catch (err) {
          console.warn('[TeamReveal] Primary results summary lookup failed:', err);
        }

        // Secondary fallback 1: teamsAPI.getById
        if (!loadedTeam) {
          try {
            const res = await teamsAPI.getById(targetId);
            if (res.data?.success && res.data.team) {
              loadedTeam = res.data.team;
            }
          } catch (err) {
            console.warn('[TeamReveal] Primary getById lookup failed, falling back:', err);
          }
        }

        // Secondary fallback 2: teamsAPI.getAll()
        if (loadedAllTeams.length === 0 || !loadedTeam) {
          try {
            const allTeamsRes = await teamsAPI.getAll();
            if (allTeamsRes.data?.success && allTeamsRes.data.teams) {
              if (loadedAllTeams.length === 0) {
                loadedAllTeams = allTeamsRes.data.teams;
              }
              if (!loadedTeam) {
                const matched = allTeamsRes.data.teams.find(
                  (item) => String(item._id) === String(targetId)
                );
                if (matched) {
                  loadedTeam = matched;
                }
              }
            }
          } catch (err) {
            console.warn('[TeamReveal] GetAll fallback lookup failed:', err);
          }
        }

        if (!isMounted) return;

        if (loadedAllTeams.length > 0) {
          setAllTeams(loadedAllTeams);
        }

        if (!loadedTeam) {
          setError(`Team with ID "${targetId}" could not be found.`);
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
  }, [currentTeamId, teamId]);

  // Determine next unrevealed team in sequential order
  const getNextUnrevealedTeam = () => {
    if (!allTeams || allTeams.length === 0) return null;
    const targetId = String(currentTeamId || teamId);
    const currentIndex = allTeams.findIndex(
      (item) => String(item._id || item.team?._id) === targetId
    );

    // Search cyclically starting from the team right after the current one
    const startIndex = currentIndex >= 0 ? currentIndex : 0;
    for (let i = 1; i <= allTeams.length; i++) {
      const candidateIndex = (startIndex + i) % allTeams.length;
      const candidate = allTeams[candidateIndex];
      const candId = String(candidate._id || candidate.team?._id);
      if (!revealedTeamIds.includes(candId) && candId !== targetId) {
        return candidate;
      }
    }
    return null;
  };

  const nextTeam = getNextUnrevealedTeam();
  const isAllTeamsRevealed = allTeams.length > 0 && (!nextTeam || revealedTeamIds.length >= allTeams.length);

  // Reveal next team flow
  const handleRevealNextTeam = () => {
    const candidate = getNextUnrevealedTeam();
    if (!candidate) return;

    const nextId = String(candidate._id || candidate.team?._id);
    setRevealedTeamIds((prev) => (prev.includes(nextId) ? prev : [...prev, nextId]));
    setCurrentTeamId(nextId);

    // Update browser URL without triggering full page reload
    window.history.replaceState({}, '', `/reveal/${nextId}`);

    // Restart presentation sequence for the next team
    setCoinFlipped(false);
    setRevealKey((k) => k + 1);
    setStage('intro');
    setIntroPhase(0);
    setPlayerIndex(0);
    setIsPaused(false);
  };

  // Reset and restart reveal sequence for current team
  const handleReplay = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      if (!isMuted) {
        audioRef.current.play().catch(() => {});
      }
    }
    setCoinFlipped(false);
    setRevealKey((k) => k + 1);
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

    // Coin flip completes at 4.6s (animation duration is 4.5s)
    const tCoin = setTimeout(() => {
      setCoinFlipped(true);
    }, 4600);

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
      clearTimeout(tCoin);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [stage, loading, team, isPaused]);

  // Stage 2 Player reveal timer choreography: Approximately 3 seconds per player
  useEffect(() => {
    if (loading || !team || stage !== 'players' || isPaused) return;

    const squad = team.squad || [];

    // If team has no players, display graceful zero-player notice for 3s then move to captain
    if (squad.length === 0) {
      const t = setTimeout(() => {
        setStage('captain');
      }, 3000);
      return () => clearTimeout(t);
    }

    // Keep each player visible for 3 seconds before smoothly transitioning to next player
    const t = setTimeout(() => {
      if (playerIndex < squad.length - 1) {
        setPlayerIndex((prev) => prev + 1);
      } else {
        // All players revealed -> transition to Stage 3 Captain reveal
        setStage('captain');
      }
    }, 3000);

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

  // Dynamic column layout for poster based on squad size (balanced columns inside reserved area)
  const squadSize = squad.length;
  const numPosterCols = squadSize > 5 ? 2 : 1;
  const playersPerCol = Math.ceil(squadSize / numPosterCols);
  const rosterColumns = [];
  for (let i = 0; i < numPosterCols; i++) {
    rosterColumns.push(squad.slice(i * playersPerCol, (i + 1) * playersPerCol));
  }

  // Team name split for two-tone hero headline
  const nameParts = (team?.name || '').trim().split(' ');
  const headlineLine1 = nameParts[0] || team?.name || '';
  const headlineLine2 = nameParts.slice(1).join(' ');

  // Clean, high-contrast roster row renderer — player full name only for projector screen
  const renderPlayerRow = (p, globalIdx) => (
    <div
      key={p._id || p.id || globalIdx}
      className="py-1 sm:py-1.5 lg:py-2 border-b border-white/15 min-w-0"
    >
      <span className="font-black uppercase text-white tracking-wide text-xs sm:text-sm lg:text-[15px] xl:text-[17px] block truncate">
        {p.name}
      </span>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className={`relative w-full bg-[#08090a] text-white overflow-hidden flex flex-col justify-between font-sans selection:bg-amber-500 selection:text-black ${
        stage === 'poster' ? 'h-screen max-h-screen' : 'min-h-screen'
      }`}
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
          {/* Audio Mute/Unmute Toggle */}
          <button
            onClick={toggleMute}
            className="p-1.5 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/60 backdrop-blur-md transition shadow-lg hover:text-white"
            title={isMuted ? 'Unmute IPL Anthem' : 'Mute IPL Anthem'}
          >
            {isMuted ? (
              <VolumeX className="w-3.5 h-3.5 text-zinc-500" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-amber-400" />
            )}
          </button>

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
      <main className={`flex-1 flex items-center justify-center relative z-10 w-full max-w-7xl mx-auto ${
        stage === 'poster'
          ? 'pt-12 sm:pt-14 pb-1 px-2 sm:px-4 overflow-hidden min-h-0'
          : 'p-3 sm:p-6 lg:p-8 pt-14'
      }`}>
        
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

              {/* The Spinning 3D Coin - Plays EXACTLY ONCE per team reveal */}
              <div
                key={`coin-${currentTeamId || team._id}-${revealKey}`}
                onAnimationEnd={() => setCoinFlipped(true)}
                className={`w-48 h-48 sm:w-60 sm:h-60 rounded-full bg-gradient-to-br from-zinc-800 via-zinc-900 to-black p-3 sm:p-4 border-4 sm:border-[6px] shadow-2xl flex items-center justify-center relative overflow-hidden ${
                  !coinFlipped ? 'animate-coin-flip' : ''
                }`}
                style={{
                  borderColor: teamColor || '#f59e0b',
                  boxShadow: `0 0 50px ${teamColor}40, inset 0 0 25px rgba(0,0,0,0.8)`,
                  transform: coinFlipped ? 'perspective(1400px) rotateY(1800deg) scale(1)' : undefined
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

                  {/* Player Details - Focused entirely on the player (No prices or financial info) */}
                  <div className="flex-1 flex flex-col justify-between text-center sm:text-left min-w-0 w-full py-1">
                    <div>
                      {/* Category & Designation Badges */}
                      <div className="flex items-center justify-center sm:justify-start gap-2 mb-2.5 flex-wrap">
                        <span className="px-3.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider">
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

                      {/* Player Full Name (Bold & Heroic) */}
                      <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white leading-tight mb-2.5 truncate">
                        {currentPlayer.name}
                      </h2>

                      {/* Team Association pill */}
                      <div className="flex items-center justify-center sm:justify-start gap-2 text-xs sm:text-sm text-zinc-400">
                        <span>Squad Member &bull;</span>
                        <span className="text-white font-bold">{team.name}</span>
                        <span className="font-semibold" style={{ color: teamColor }}>({team.code})</span>
                      </div>
                    </div>

                    {/* Official Squad Player Designation Bar (No price / financial info) */}
                    <div className="mt-6 pt-4 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
                      <span className="text-[11px] uppercase tracking-widest text-zinc-500 font-semibold">
                        HFPL 2027 Squad Roster
                      </span>
                      <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white font-semibold text-[11px] uppercase tracking-wider">
                        {currentPlayer.category || 'Official Player'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3-Second Timer Progress Bar Indicator */}
                {!isPaused && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-800">
                    <div
                      key={`timer-${playerIndex}`}
                      className="h-full bg-amber-400 animate-progress-3s"
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

                  {/* Team Squad Summary (No purse or auction financials) */}
                  <div className="mt-6 pt-4 border-t border-zinc-800 flex items-center justify-between text-xs sm:text-sm">
                    <div>
                      <span className="text-zinc-500 uppercase tracking-widest text-[10px] block">Total Squad</span>
                      <span className="font-bold text-white text-base sm:text-lg">{squad.length} Players</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 uppercase tracking-widest text-[10px] block">Franchise</span>
                      <span className="font-bold text-white text-base sm:text-lg">{team.code}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 uppercase tracking-widest text-[10px] block">Tournament</span>
                      <span className="font-bold text-amber-400 text-base sm:text-lg">HFPL 2027</span>
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
          <div className="w-full max-w-6xl mx-auto animate-dramatic-entrance flex flex-col items-center justify-center h-full max-h-full">
            
            {/* The Master Poster 16:9 Canvas */}
            <div
              className="relative w-full rounded-2xl sm:rounded-3xl border border-white/15 shadow-[0_25px_80px_rgba(0,0,0,0.9)] overflow-hidden select-none aspect-[16/9] max-h-[calc(100vh-130px)] sm:max-h-[calc(100vh-140px)] flex flex-col justify-between"
              style={{
                backgroundColor: theme.bgDark
              }}
            >
              {/* Layered Geometric Angular Accents (Preserved Franchise Art Direction) */}
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
              <div className="relative z-10 w-full h-full p-4 sm:p-5 lg:p-7 flex flex-col justify-between overflow-hidden">
                
                {/* 1. TOP HEADER: HFPL TOURNAMENT IDENTITY & TEAM CODE / SEASON (RIGHT) */}
                <div className="flex items-center justify-between gap-3 sm:gap-4 pb-2 sm:pb-2.5 border-b border-white/15 shrink-0">
                  <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                    <img
                      src={hfplLogo}
                      alt="HFPL"
                      className="h-8 sm:h-9 lg:h-11 w-auto object-contain filter drop-shadow-sm shrink-0"
                    />
                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                      <span className="text-[9px] sm:text-[10px] lg:text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/80 block leading-tight truncate">
                        HAPPY FAMILY PREMIER LEAGUE 2027
                      </span>
                      <span className="text-[8px] text-white/40 hidden sm:inline">&bull;</span>
                      <span className="text-[8px] sm:text-[9px] lg:text-[10px] font-bold uppercase tracking-[0.22em] text-amber-400/90 hidden sm:inline">
                        OFFICIAL SQUAD
                      </span>
                    </div>
                  </div>

                  {/* Right: Team Code & Season Badge */}
                  <div className="text-right shrink-0">
                    <span
                      className="text-xl sm:text-2xl lg:text-3xl font-black uppercase tracking-wider block leading-none"
                      style={{ color: theme.textOnAccent }}
                    >
                      {team.code}
                    </span>
                    <span
                      className="text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.25em] block mt-0.5 sm:mt-1"
                      style={{ color: theme.textOnAccent, opacity: 0.85 }}
                    >
                      SEASON 2027
                    </span>
                  </div>
                </div>

                {/* 2. MAIN BODY: LEFT/CENTER (TEAM NAME + SQUAD ROSTER) + RIGHT (OFFICIAL LOGO) */}
                <div className="grid grid-cols-12 gap-4 lg:gap-6 items-center flex-1 my-auto min-h-0 py-1 sm:py-2">
                  
                  {/* LEFT/CENTER: RESERVED ROSTER AREA (STAYS CLEAR OF LOGO & GOLD DIAGONAL) */}
                  <div className="col-span-7 lg:col-span-7 xl:col-span-7 flex flex-col justify-center h-full min-w-0 pr-1 sm:pr-4">
                    
                    {/* PROMINENT TEAM NAME HEADING NEAR TOP OF ROSTER AREA */}
                    <div className="shrink-0 mb-1.5 sm:mb-2 lg:mb-2.5">
                      <h1 className="font-black uppercase tracking-tight leading-none text-2xl sm:text-3xl lg:text-4xl xl:text-[42px] truncate">
                        <span className="text-white">{headlineLine1}</span>{' '}
                        {headlineLine2 && (
                          <span style={{ color: theme.accent }}>{headlineLine2}</span>
                        )}
                      </h1>
                    </div>

                    {/* COMPLETE SQUAD ROSTER DIRECTLY BELOW TEAM NAME */}
                    <div className="min-h-0">
                      {squad.length === 0 ? (
                        <div className="py-6 text-center text-white/50 text-xs font-semibold tracking-widest uppercase border-y border-white/15">
                          No Squad Players Acquired
                        </div>
                      ) : numPosterCols === 1 ? (
                        <div className="border-t border-white/15 max-w-sm">
                          {rosterColumns[0].map((p, idx) => renderPlayerRow(p, idx))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-x-4 sm:gap-x-6 lg:gap-x-8 border-t border-white/15">
                          <div>
                            {rosterColumns[0].map((p, idx) => renderPlayerRow(p, idx))}
                          </div>
                          <div>
                            {rosterColumns[1].map((p, idx) => renderPlayerRow(p, playersPerCol + idx))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* RIGHT: OFFICIAL TEAM LOGO */}
                  <div className="col-span-5 lg:col-span-5 xl:col-span-5 flex flex-col items-center justify-center h-full relative">
                    <div className="w-full flex items-center justify-center p-2">
                      {logoSrc ? (
                        theme.logoBackdrop ? (
                          <div
                            className={`${
                              theme.backdropClasses || 'w-[136px] h-[136px] sm:w-[176px] sm:h-[176px] lg:w-[220px] lg:h-[220px] xl:w-[256px] xl:h-[256px]'
                            } rounded-full bg-white shadow-[0_12px_30px_rgba(0,0,0,0.25)] border-2 border-white/80 flex items-center justify-center p-4 sm:p-5 transition-transform duration-500 hover:scale-105`}
                          >
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
                            className={`${
                              theme.logoClasses || 'max-w-[150px] sm:max-w-[200px] lg:max-w-[250px] xl:max-w-[285px] max-h-[150px] sm:max-h-[200px] lg:max-h-[250px] xl:max-h-[285px]'
                            } object-contain filter drop-shadow-[0_12px_25px_rgba(0,0,0,0.35)] transition-transform duration-500 hover:scale-105`}
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        )
                      ) : (
                        <div
                          className="text-4xl sm:text-5xl lg:text-6xl font-black uppercase tracking-wider select-none"
                          style={{ color: theme.textOnAccent }}
                        >
                          {team.code}
                        </div>
                      )}
                    </div>
                  </div>

                </div>

                {/* 3. BOTTOM SECTION: CAPTAIN (LEFT) & FRANCHISE TAGLINES (RIGHT) — Moved slightly upward */}
                <div className="flex items-center justify-between pt-2.5 sm:pt-3.5 pb-2 sm:pb-2.5 border-t border-white/15 shrink-0 gap-4 mb-0.5 sm:mb-1">
                  {/* Left: Captain Prominent */}
                  <div className="flex items-center min-w-0">
                    {/* Geometric Crown Silhouette */}
                    <svg
                      className="w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 shrink-0"
                      viewBox="0 0 48 48"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      style={{ color: theme.accent }}
                    >
                      <path d="M6 14L13 32H35L42 14L31 22L24 8L17 22L6 14Z" fill="currentColor" />
                      <rect x="13" y="35" width="22" height="4" rx="1" fill="currentColor" />
                    </svg>

                    <div className="ml-2.5 sm:ml-3 min-w-0">
                      <span
                        className="text-[9px] sm:text-[10px] lg:text-[11px] font-black uppercase tracking-[0.25em] block leading-tight"
                        style={{ color: theme.accent }}
                      >
                        CAPTAIN
                      </span>
                      <h2 className="text-base sm:text-xl lg:text-2xl xl:text-3xl font-black text-white uppercase tracking-tight leading-none mt-0.5 truncate">
                        {captainName}
                      </h2>
                    </div>
                  </div>

                  {/* Right: Franchise Taglines */}
                  <div className="text-right pointer-events-none select-none shrink-0">
                    <span
                      className="text-[8px] sm:text-[9px] lg:text-[10px] font-extrabold uppercase tracking-[0.3em] block leading-tight"
                      style={{ color: theme.textOnAccent, opacity: 0.85 }}
                    >
                      {theme.tagline1}
                    </span>
                    <span
                      className="text-[8px] sm:text-[9px] lg:text-[10px] font-extrabold uppercase tracking-[0.3em] block leading-tight mt-0.5"
                      style={{ color: theme.textOnAccent, opacity: 0.85 }}
                    >
                      {theme.tagline2}
                    </span>
                  </div>
                </div>

              </div>
            </div>

            {/* Poster Actions: Next Team, Replay & Return to Results */}
            <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3.5 mt-2.5 sm:mt-3 shrink-0">
              {nextTeam ? (
                <button
                  onClick={handleRevealNextTeam}
                  className="px-5 sm:px-6 py-2 rounded-full bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-black text-xs sm:text-sm tracking-wide transition flex items-center gap-2 shadow-[0_4px_20px_rgba(245,158,11,0.4)] hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <span>Reveal Next Team</span>
                  <ChevronRight className="w-4 h-4 stroke-[3]" />
                </button>
              ) : isAllTeamsRevealed ? (
                <div className="px-4 py-2 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-semibold text-xs flex items-center gap-1.5 shadow">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>All Teams Revealed</span>
                </div>
              ) : null}

              <button
                onClick={handleReplay}
                className="px-4 sm:px-5 py-2 rounded-full bg-zinc-900/90 hover:bg-zinc-800 text-white font-semibold text-xs border border-zinc-700/80 transition flex items-center gap-1.5 shadow-lg hover:scale-105 active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Replay Reveal</span>
              </button>

              <button
                onClick={handleReturn}
                className="px-5 sm:px-6 py-2 rounded-full bg-white hover:bg-zinc-200 text-black font-bold text-xs transition flex items-center gap-1.5 shadow-lg hover:scale-105 active:scale-95"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Results</span>
              </button>
            </div>

          </div>
        )}

      </main>

      {/* Footer Branding */}
      <footer className={`w-full py-1.5 sm:py-2 px-6 text-center text-[10px] sm:text-[11px] text-zinc-600 border-t border-zinc-900/80 relative z-20 flex items-center justify-between shrink-0 ${
        stage === 'poster' ? 'hidden sm:flex' : ''
      }`}>
        <span>HFPL Premier Cricket Auction 2027</span>
        <span className="font-medium text-zinc-500">Projector Mode &bull; {team.name}</span>
      </footer>
    </div>
  );
}

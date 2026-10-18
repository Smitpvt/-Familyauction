import React, { useState, useEffect } from 'react';
import { Trophy, Download, Users, ArrowLeft, ExternalLink } from 'lucide-react';
import { resultsAPI } from '../services/api';
import hfplLogo from '../logo/HFPL logo-Photoroom.png';
import { resolveTeamLogo } from '../utils/media';

export default function ResultsView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const res = await resultsAPI.getSummary();
        if (res.data.success) {
          setData(res.data.summary);
        }
      } catch (err) {
        console.error('Failed to load results:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, []);

  const formatINR = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c0d0e] flex flex-col items-center justify-center text-white font-sans">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mb-4" />
        <p className="text-sm tracking-widest text-zinc-400 uppercase font-medium">Calculating Tournament Results...</p>
      </div>
    );
  }

  const teamSquads = data?.teamSquads || [];
  const highestPlayer = data?.highestPricedPlayer;

  return (
    <div className="min-h-screen bg-[#0c0d0e] text-white flex flex-col font-sans selection:bg-zinc-800">
      {/* Header */}
      <header className="px-4 sm:px-6 lg:px-12 py-3 sm:py-4 bg-[#0c0d0e] border-b border-zinc-800/80 flex flex-wrap items-center justify-between gap-2.5 sticky top-0 z-30">
        <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
          <a
            href="/auction"
            className="p-1.5 sm:p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition shrink-0"
            title="Go to Live Auction Display"
          >
            <ArrowLeft className="w-4 h-4" />
          </a>
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <img src={hfplLogo} alt="HFPL Logo" className="h-7 sm:h-8 w-auto object-contain shrink-0" />
            <div className="truncate">
              <h1 className="text-sm sm:text-base font-bold tracking-tight text-white leading-tight truncate">HFPL Auction Results</h1>
              <p className="text-[9px] sm:text-[10px] text-zinc-400 uppercase tracking-widest font-medium truncate hidden min-[360px]:block">Tournament Squads & Summary</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <a
            href={resultsAPI.getExportUrl()}
            download="HFPL_Auction_Results.csv"
            className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white hover:bg-zinc-200 text-black font-semibold text-[11px] sm:text-xs transition flex items-center gap-1.5 sm:gap-2 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </a>
          <a
            href="/admin"
            className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-[11px] sm:text-xs font-semibold transition"
          >
            Admin
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-6 sm:space-y-8">
        
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-[#151618] rounded-2xl p-4 sm:p-6 border border-zinc-800">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider block mb-1">Total Turnover</span>
            <span className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{formatINR(data?.totalSpentOverall)}</span>
            <span className="text-[11px] text-zinc-500 block mt-1">Across confirmed sales</span>
          </div>

          <div className="bg-[#151618] rounded-2xl p-4 sm:p-6 border border-zinc-800">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider block mb-1">Players Sold</span>
            <span className="text-2xl sm:text-3xl font-bold text-emerald-400 tracking-tight">{data?.soldCount || 0}</span>
            <span className="text-[11px] text-zinc-500 block mt-1">Out of {data?.totalPlayersCount || 0} registered players</span>
          </div>

          <div className="bg-[#151618] rounded-2xl p-4 sm:p-6 border border-zinc-800">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider block mb-1">Unsold Players</span>
            <span className="text-2xl sm:text-3xl font-bold text-zinc-300 tracking-tight">{data?.unsoldCount || 0}</span>
            <span className="text-[11px] text-zinc-500 block mt-1">Available for re-auction</span>
          </div>

          <div className="bg-[#151618] rounded-2xl p-4 sm:p-6 border border-zinc-800">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider block mb-1">Top Buy</span>
            {highestPlayer ? (
              <div>
                <span className="text-lg sm:text-xl font-bold text-white block truncate">{highestPlayer.name}</span>
                <span className="text-base font-semibold text-emerald-400">{formatINR(highestPlayer.soldPrice)}</span>
                <span className="text-[11px] text-zinc-500 block mt-0.5 truncate">Bought by {highestPlayer.soldToTeam?.name}</span>
              </div>
            ) : (
              <span className="text-sm text-zinc-500 block mt-2">No players sold yet</span>
            )}
          </div>
        </div>

        {/* TEAM-WISE SQUADS */}
        <div className="space-y-4">
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-zinc-400" />
            <span>Official Team Squads</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {teamSquads.map((teamItem) => {
              const teamData = teamItem.team || teamItem;
              const tName = teamData.name || teamItem.name || '';
              const tCode = teamData.code || teamItem.code || '';
              const tCaptain = teamData.captain || teamItem.captain || '';
              const tPurse = teamData.remainingPurse ?? teamItem.remainingPurse ?? 10000;
              const tSpent = teamData.totalSpent ?? teamItem.totalSpent ?? 0;
              const tColor = teamData.color || teamItem.color;
              const logoSrc = resolveTeamLogo(teamData || teamItem);
              const squadList = teamItem.players || teamData.players || [];

              return (
                <div
                  key={teamData._id || teamItem._id}
                  className="bg-[#151618] rounded-2xl border border-zinc-800 p-4 sm:p-6 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800 pb-3 sm:pb-4 mb-3 sm:mb-4 gap-2.5 sm:gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {logoSrc ? (
                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-zinc-900 border border-zinc-700/80 p-1 flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
                            <img
                              src={logoSrc}
                              alt={tName}
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          </div>
                        ) : (
                          <div
                            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-black text-xs text-black shrink-0"
                            style={{ backgroundColor: tColor || '#22c55e' }}
                          >
                            {tCode}
                          </div>
                        )}
                        <div className="min-w-0 truncate">
                          <h3 className="text-base sm:text-lg font-bold text-white leading-snug truncate">{tName} ({tCode})</h3>
                          <p className="text-xs text-zinc-400 truncate">Captain: <span className="text-white font-medium">{tCaptain || 'Not set'}</span></p>
                        </div>
                      </div>
                      <div className="text-left sm:text-right shrink-0 pt-1 sm:pt-0 border-t border-zinc-800/60 sm:border-t-0 flex sm:block justify-between items-center">
                        <span className="text-xs text-zinc-400 sm:block">Remaining Purse:</span>
                        <span className="text-sm sm:text-base font-bold text-white">{formatINR(tPurse)}</span>
                      </div>
                    </div>

                    {/* Players list */}
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {squadList && squadList.length > 0 ? (
                        squadList.map((p, idx) => (
                          <div
                            key={p._id || idx}
                            className="flex items-center justify-between p-2 sm:p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs gap-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-zinc-500 font-mono text-[10px] w-4 shrink-0">{idx + 1}.</span>
                              <span className="font-semibold text-white truncate max-w-[130px] sm:max-w-none">{p.name}</span>
                              <span className="text-[10px] text-zinc-400 px-1.5 sm:px-2 py-0.5 rounded bg-zinc-800 shrink-0">{p.category}</span>
                            </div>
                            <span className="font-semibold text-white shrink-0">{formatINR(p.soldPrice)}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-zinc-500 italic py-4 text-center">No players acquired yet</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
                    <span>Squad Size: <strong className="text-white">{squadList?.length || 0}</strong></span>
                    <span>Spent: <strong className="text-white">{formatINR(tSpent)}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </main>
    </div>
  );
}

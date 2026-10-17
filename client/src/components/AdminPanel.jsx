import React, { useState, useEffect } from 'react';
import {
  Gavel, Users, UserPlus, Layers, RotateCcw, Play, Pause, ChevronRight,
  ChevronLeft, Award, XCircle, DollarSign, Upload, Trash2, Edit2, CheckCircle2,
  AlertTriangle, RefreshCw, LogOut, ExternalLink, FileSpreadsheet, ShieldAlert,
  Shield, Search, Radio
} from 'lucide-react';
import { auctionAPI, teamsAPI, playersAPI, roundsAPI, uploadAPI } from '../services/api';
import { getSocket } from '../services/socket';
import AudioControl from './AudioControl';
import hfplLogo from '../logo/HFPL logo-Photoroom.png';
import { resolveTeamLogo, resolveImageUrl } from '../utils/media';

export default function AdminPanel({ onLogout }) {
  const [activeTab, setActiveTab] = useState('live'); // 'live' | 'players' | 'rounds' | 'teams'
  const [auctionState, setAuctionState] = useState(null);
  const [stats, setStats] = useState({});
  const [teams, setTeams] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Filter / Search for player table
  const [playerSearch, setPlayerSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [selectedSetFilter, setSelectedSetFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('All');

  // Live bidding form state
  const [selectedBiddingTeamId, setSelectedBiddingTeamId] = useState('');
  const [customBidAmount, setCustomBidAmount] = useState('');
  const [selectedIncrement, setSelectedIncrement] = useState(100);

  // Modals state
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [showRoundModal, setShowRoundModal] = useState(false);
  const [editingRound, setEditingRound] = useState(null);
  const [showUndoModal, setShowUndoModal] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [showDeletePlayerModal, setShowDeletePlayerModal] = useState(false);
  const [playerToDelete, setPlayerToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Forms
  const [playerForm, setPlayerForm] = useState({
    name: '', category: 'All-rounder', battingStyle: 'Right Hand Bat',
    bowlingStyle: 'Right Arm Medium', basePrice: 200, photo: '',
    description: '', roundId: '', matches: 0, runs: 0, wickets: 0, highestScore: 0, strikeRate: 0
  });

  const [teamForm, setTeamForm] = useState({
    name: '', code: '', captain: '', color: '#18181b', startingPurse: 10000, logo: ''
  });

  const [roundForm, setRoundForm] = useState({
    name: '', description: '', order: 1
  });

  const [csvContent, setCsvContent] = useState('');

  // Fetch full data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [stateRes, teamsRes, roundsRes, playersRes] = await Promise.all([
        auctionAPI.getState(),
        teamsAPI.getAll(),
        roundsAPI.getAll(),
        playersAPI.getAll()
      ]);

      if (stateRes.data.success) {
        setAuctionState(stateRes.data.state);
        setStats(stateRes.data.stats);
        if (stateRes.data.state?.selectedIncrement) {
          setSelectedIncrement(stateRes.data.state.selectedIncrement);
        }
      }
      if (teamsRes.data.success && teamsRes.data.teams?.length > 0) {
        setTeams(teamsRes.data.teams);
        setSelectedBiddingTeamId((prev) => prev || teamsRes.data.teams[0]._id);
      }
      if (roundsRes.data.success) setRounds(roundsRes.data.rounds);
      if (playersRes.data.success) setPlayers(playersRes.data.players);
    } catch (err) {
      console.error('Error fetching admin data:', err);
      showMessage('Error loading auction data from server.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const socket = getSocket();
    const handleStateUpdate = (data) => {
      if (data.state) setAuctionState(data.state);
      if (data.stats) setStats(data.stats);
      if (data.teams && data.teams.length > 0) {
        setTeams(data.teams);
        setSelectedBiddingTeamId((prev) => prev || data.teams[0]._id);
      }
    };

    const handleResolution = () => {
      fetchData();
    };

    socket.on('AUCTION_STATE_UPDATE', handleStateUpdate);
    socket.on('PLAYER_SOLD', handleResolution);
    socket.on('PLAYER_UNSOLD', handleResolution);
    socket.on('PLAYER_DELETED', handleResolution);

    return () => {
      socket.off('AUCTION_STATE_UPDATE', handleStateUpdate);
      socket.off('PLAYER_SOLD', handleResolution);
      socket.off('PLAYER_UNSOLD', handleResolution);
      socket.off('PLAYER_DELETED', handleResolution);
    };
  }, []);

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 4000);
  };

  const formatINR = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  // --- Live Controls ---
  const handleSetRound = async (roundId) => {
    try {
      setActionLoading(true);
      await auctionAPI.setRound(roundId);
      showMessage('Auction set updated.');
      fetchData();
    } catch (err) {
      showMessage(err.response?.data?.message || 'Error updating set', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartBidding = async () => {
    try {
      setActionLoading(true);
      await auctionAPI.startBidding();
      showMessage('Bidding session started!');
    } catch (err) {
      showMessage(err.response?.data?.message || 'Error starting bidding', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTogglePause = async () => {
    try {
      setActionLoading(true);
      await auctionAPI.togglePause();
    } catch (err) {
      showMessage(err.response?.data?.message || 'Error toggling pause', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePlaceBid = async (amount = null, increment = null) => {
    if (!selectedBiddingTeamId) {
      showMessage('Please select a bidding team first!', 'error');
      return;
    }

    try {
      setActionLoading(true);
      const payload = { teamId: selectedBiddingTeamId };
      if (amount !== null) payload.amount = Number(amount);
      else if (increment !== null) payload.increment = Number(increment);
      else payload.increment = selectedIncrement;

      await auctionAPI.placeBid(payload);
      setCustomBidAmount('');
      showMessage('Bid recorded successfully!');
    } catch (err) {
      showMessage(err.response?.data?.message || 'Failed to place bid', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSellPlayer = async () => {
    if (!auctionState?.highestBidder) {
      showMessage('No team has bid on this player yet! Mark as UNSOLD instead.', 'error');
      return;
    }
    if (!window.confirm(`Confirm HAMMER / SOLD for ₹${auctionState.currentBid} to ${auctionState.highestBidder?.name}?`)) {
      return;
    }

    try {
      setActionLoading(true);
      await auctionAPI.sellPlayer();
      showMessage('Player marked as SOLD! Purse deducted.', 'success');
      fetchData();
    } catch (err) {
      showMessage(err.response?.data?.message || 'Error selling player', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkUnsold = async () => {
    if (!window.confirm('Mark this player as UNSOLD?')) return;
    try {
      setActionLoading(true);
      await auctionAPI.markUnsold();
      showMessage('Player marked as UNSOLD.', 'info');
      fetchData();
    } catch (err) {
      showMessage(err.response?.data?.message || 'Error marking unsold', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleNextPlayer = async () => {
    try {
      setActionLoading(true);
      await auctionAPI.nextPlayer();
      showMessage('Moved to next player.');
      fetchData();
    } catch (err) {
      showMessage(err.response?.data?.message || 'Error moving to next player', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrevPlayer = async () => {
    try {
      setActionLoading(true);
      await auctionAPI.prevPlayer();
      showMessage('Moved to previous player.');
      fetchData();
    } catch (err) {
      showMessage(err.response?.data?.message || 'Error moving to previous player', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUndoSale = async () => {
    try {
      setActionLoading(true);
      await auctionAPI.undoSale(auctionState?.currentPlayer?._id);
      setShowUndoModal(false);
      showMessage('Sale reverted! Purse restored and player status reset.', 'success');
      fetchData();
    } catch (err) {
      showMessage(err.response?.data?.message || 'Error reverting sale', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSelectPlayer = async (pId) => {
    try {
      setActionLoading(true);
      await auctionAPI.setPlayer(pId);
      showMessage('Active player updated.');
      fetchData();
    } catch (err) {
      showMessage(err.response?.data?.message || 'Error updating player', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSelectRound = async (rId) => {
    try {
      setActionLoading(true);
      await auctionAPI.setRound(rId);
      showMessage('Active round updated.');
      fetchData();
    } catch (err) {
      showMessage(err.response?.data?.message || 'Error updating round', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Image Upload helper
  const handleImageUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await uploadAPI.uploadImage(formData);
      if (res.data.success) {
        if (type === 'player') {
          setPlayerForm({ ...playerForm, photo: res.data.url });
        } else if (type === 'team') {
          setTeamForm({ ...teamForm, logo: res.data.url });
        }
        showMessage('Photo uploaded successfully!');
      }
    } catch (err) {
      showMessage('Failed to upload image.', 'error');
    }
  };

  // --- Player CRUD ---
  const handleSavePlayer = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...playerForm,
        stats: {
          matches: Number(playerForm.matches) || 0,
          runs: Number(playerForm.runs) || 0,
          wickets: Number(playerForm.wickets) || 0,
          highestScore: Number(playerForm.highestScore) || 0,
          strikeRate: Number(playerForm.strikeRate) || 0
        }
      };

      if (editingPlayer) {
        await playersAPI.update(editingPlayer._id, payload);
        showMessage('Player updated successfully!');
      } else {
        await playersAPI.create(payload);
        showMessage('Player created successfully!');
      }
      setShowPlayerModal(false);
      setEditingPlayer(null);
      fetchData();
    } catch (err) {
      showMessage(err.response?.data?.message || 'Error saving player', 'error');
    }
  };

  const handleDeletePlayerClick = (p) => {
    setPlayerToDelete(p);
    setShowDeletePlayerModal(true);
  };

  const handleConfirmDeletePlayer = async () => {
    if (!playerToDelete) return;
    try {
      setDeleteLoading(true);
      const res = await playersAPI.delete(playerToDelete._id);
      showMessage(res.data?.message || `Player "${playerToDelete.name}" deleted successfully.`, 'success');
      setShowDeletePlayerModal(false);
      setPlayerToDelete(null);
      fetchData();
    } catch (err) {
      showMessage(err.response?.data?.message || 'Failed to delete player', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleReauctionPlayer = async (pId) => {
    if (!window.confirm('Allow this player to be auctioned again? Any prior sale transaction will be reverted.')) return;
    try {
      await playersAPI.reauction(pId);
      showMessage('Player is now available for re-auction!');
      fetchData();
    } catch (err) {
      showMessage(err.response?.data?.message || 'Error setting player for re-auction', 'error');
    }
  };

  // --- Team CRUD ---
  const handleSaveTeam = async (e) => {
    e.preventDefault();
    try {
      if (editingTeam) {
        await teamsAPI.update(editingTeam._id, teamForm);
        showMessage('Team updated successfully!');
      } else {
        await teamsAPI.create(teamForm);
        showMessage('Team created successfully!');
      }
      setShowTeamModal(false);
      setEditingTeam(null);
      fetchData();
    } catch (err) {
      showMessage(err.response?.data?.message || 'Error saving team', 'error');
    }
  };

  const handleDeleteTeam = async (tId) => {
    if (!window.confirm('Are you sure you want to delete this team?')) return;
    try {
      await teamsAPI.delete(tId);
      showMessage('Team deleted successfully.');
      fetchData();
    } catch (err) {
      showMessage(err.response?.data?.message || 'Cannot delete team', 'error');
    }
  };

  // --- Round CRUD ---
  const handleSaveRound = async (e) => {
    e.preventDefault();
    try {
      if (editingRound) {
        await roundsAPI.update(editingRound._id, roundForm);
        showMessage('Round updated successfully!');
      } else {
        await roundsAPI.create(roundForm);
        showMessage('Round created successfully!');
      }
      setShowRoundModal(false);
      setEditingRound(null);
      fetchData();
    } catch (err) {
      showMessage(err.response?.data?.message || 'Error saving round', 'error');
    }
  };

  const handleDeleteRound = async (rId) => {
    if (!window.confirm('Delete this round? Players inside will be unassigned.')) return;
    try {
      await roundsAPI.delete(rId);
      showMessage('Round deleted.');
      fetchData();
    } catch (err) {
      showMessage(err.response?.data?.message || 'Cannot delete round', 'error');
    }
  };

  // CSV Import
  const handleCSVImport = async () => {
    try {
      const lines = csvContent.trim().split('\n');
      if (lines.length < 2) {
        showMessage('CSV must contain a header and at least one data row.', 'error');
        return;
      }
      const parsedPlayers = [];

      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
        if (!row[0]) continue;
        const pObj = {
          name: row[0],
          category: row[1] || 'All-rounder',
          basePrice: Number(row[2]) || 200,
          battingStyle: row[3] || 'Right Hand Bat',
          bowlingStyle: row[4] || 'Right Arm Medium'
        };
        parsedPlayers.push(pObj);
      }

      await playersAPI.bulkImport(parsedPlayers);
      setShowCSVModal(false);
      setCsvContent('');
      showMessage(`Successfully imported ${parsedPlayers.length} players!`);
      fetchData();
    } catch (err) {
      showMessage('Error parsing CSV.', 'error');
    }
  };

  const currentPlayer = auctionState?.currentPlayer;
  const currentRound = auctionState?.currentRound;
  const isPlayerSold = currentPlayer?.status === 'sold' || auctionState?.status === 'sold';
  const isPlayerUnsold = !isPlayerSold && (currentPlayer?.status === 'unsold' || auctionState?.status === 'unsold');
  const status = isPlayerSold ? 'sold' : (isPlayerUnsold ? 'unsold' : (auctionState?.status || 'idle'));
  const highestBidder = isPlayerSold ? (currentPlayer?.soldToTeam || auctionState?.highestBidder) : auctionState?.highestBidder;
  const currentBid = isPlayerSold
    ? (currentPlayer?.soldPrice || auctionState?.currentBid || currentPlayer?.basePrice || 0)
    : (auctionState?.currentBid || (currentPlayer ? currentPlayer.basePrice : 0));

  // Filtered players list for players tab
  const filteredPlayers = players.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(playerSearch.toLowerCase());
    const matchesCat = categoryFilter === 'All' || p.category === categoryFilter;
    const matchesStatus = statusFilter === 'All' || p.status?.toLowerCase() === statusFilter.toLowerCase();
    const pRoundId = p.roundId?._id ? p.roundId._id.toString() : (p.roundId ? p.roundId.toString() : '');
    const matchesSet = (selectedSetFilter === 'ALL' || !selectedSetFilter) || pRoundId === selectedSetFilter;
    return matchesSearch && matchesCat && matchesStatus && matchesSet;
  });

  // Player count for the selected set (e.g. 8 Players for Set 1, or total players for All Sets)
  const selectedSetPlayerCount = (selectedSetFilter === 'ALL' || !selectedSetFilter)
    ? players.length
    : players.filter((p) => {
        const pRoundId = p.roundId?._id ? p.roundId._id.toString() : (p.roundId ? p.roundId.toString() : '');
        return pRoundId === selectedSetFilter;
      }).length;

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[#fafafa] text-zinc-900 font-sans">
      
      {/* ============================================================== */}
      {/* 1. MINIMAL DARK SIDEBAR                                        */}
      {/* ============================================================== */}
      <aside className="w-64 bg-[#0c0d0e] border-r border-zinc-800 text-white flex flex-col justify-between shrink-0 z-30 select-none">
        
        {/* Sidebar Header Brand */}
        <div>
          <div className="p-5 border-b border-zinc-800/80">
            <div className="flex items-center gap-3">
              <img src={hfplLogo} alt="HFPL Logo" className="h-9 w-auto object-contain" />
              <div>
                <h1 className="text-base font-bold tracking-tight text-white leading-tight">HFPL 2027</h1>
                <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-medium leading-tight">Admin Control Deck</p>
              </div>
            </div>

            {/* Quick Live Set Indicator */}
            <div className="mt-4 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-between text-xs">
              <span className="text-[10px] uppercase font-semibold text-zinc-400">Active Set:</span>
              <span className="text-xs font-semibold text-white truncate max-w-[120px]">
                {currentRound ? currentRound.name : 'Not set'}
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1.5">
            <button
              onClick={() => setActiveTab('live')}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider flex items-center gap-3 transition text-left ${
                activeTab === 'live'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <Gavel className="w-4 h-4" />
              <span>Live Auction Deck</span>
            </button>

            <button
              onClick={() => setActiveTab('players')}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider flex items-center gap-3 transition text-left ${
                activeTab === 'players'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>Player Management</span>
            </button>

            <button
              onClick={() => setActiveTab('rounds')}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider flex items-center gap-3 transition text-left ${
                activeTab === 'rounds'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Round Management</span>
            </button>

            <button
              onClick={() => setActiveTab('teams')}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider flex items-center gap-3 transition text-left ${
                activeTab === 'teams'
                  ? 'bg-white text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Team Management</span>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer Actions */}
        <div className="p-4 border-t border-zinc-800/80 space-y-3">
          {/* Quick Direct Links */}
          <div className="space-y-1.5">
            <a
              href="/auction"
              target="_blank"
              rel="noreferrer"
              className="w-full px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-white flex items-center justify-between transition"
            >
              <span className="flex items-center gap-2">
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>Open Projector</span>
              </span>
              <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
            </a>

            <a
              href="/results"
              target="_blank"
              rel="noreferrer"
              className="w-full px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-white flex items-center justify-between transition"
            >
              <span>Tournament Results</span>
              <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
            </a>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <AudioControl />
            <button
              onClick={onLogout}
              title="Log Out of Admin"
              className="p-1.5 text-zinc-400 hover:text-red-400 rounded-lg hover:bg-zinc-900 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ============================================================== */}
      {/* 2. MINIMAL CLEAN WORKSPACE                                     */}
      {/* ============================================================== */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Workspace Top Header Bar */}
        <header className="h-16 px-8 bg-white border-b border-zinc-200 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-zinc-900">
              {activeTab === 'live' && 'Live Auction Control Deck'}
              {activeTab === 'players' && 'Tournament Player Roster'}
              {activeTab === 'rounds' && 'Auction Sets & Sequences'}
              {activeTab === 'teams' && 'Franchise Teams & Purses'}
            </h2>
            <p className="text-xs text-zinc-500 font-medium">Real-Time Socket Synchronization Active</p>
          </div>

          {/* Quick Metrics Bar in Header */}
          <div className="hidden lg:flex items-center gap-2.5">
            <div className="bg-zinc-100 border border-zinc-200 px-3 py-1 rounded-lg text-xs font-medium text-zinc-700">
              <span className="text-zinc-500">Total: </span>
              <strong className="text-zinc-900">{stats.totalPlayers || 0}</strong>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg text-xs font-medium text-emerald-800">
              <span className="text-emerald-600">SOLD: </span>
              <strong>{stats.soldPlayers || 0}</strong>
            </div>
            <div className="bg-zinc-100 border border-zinc-200 px-3 py-1 rounded-lg text-xs font-medium text-zinc-700">
              <span className="text-zinc-500">UNSOLD: </span>
              <strong className="text-zinc-900">{stats.unsoldPlayers || 0}</strong>
            </div>
            <div className="bg-zinc-100 border border-zinc-200 px-3 py-1 rounded-lg text-xs font-medium text-zinc-700">
              <span className="text-zinc-500">UPCOMING: </span>
              <strong className="text-zinc-900">{stats.upcomingPlayers || 0}</strong>
            </div>
          </div>
        </header>

        {/* Floating Message Toast */}
        {message.text && (
          <div
            className={`fixed top-4 right-8 z-50 px-4 py-2.5 rounded-xl border shadow-xl flex items-center gap-2 text-xs font-medium transition animate-fade-in ${
              message.type === 'error'
                ? 'bg-red-600 text-white border-red-700'
                : 'bg-zinc-900 text-white border-zinc-800'
            }`}
          >
            {message.type === 'error' ? <AlertTriangle className="w-4 h-4 text-white" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Main Tab Body */}
        <main className="flex-1 overflow-y-auto p-8 bg-[#fafafa]">
          
          {/* ========================================================== */}
          {/* TAB 1: LIVE AUCTION DECK                                   */}
          {/* ========================================================== */}
          {activeTab === 'live' && (
            <div className="space-y-6 max-w-7xl mx-auto">
              
              {/* Row 1: Player Summary Card (Left) + Auctioneer Controls (Right) */}
              <div className="grid grid-cols-12 gap-6 items-start">
                
                {/* CURRENT PLAYER SUMMARY CARD (Cols 1-5) */}
                <div className="col-span-12 lg:col-span-5 bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                  {/* Set Selector & Navigation Header */}
                  <div className="flex items-center justify-between mb-4 border-b border-zinc-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Set:</span>
                      <select
                        value={currentRound?._id || ''}
                        onChange={(e) => handleSetRound(e.target.value)}
                        className="bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1 text-xs text-zinc-900 font-semibold focus:outline-none focus:border-zinc-900 transition"
                      >
                        {rounds.map((r) => (
                          <option key={r._id} value={r._id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handlePrevPlayer}
                        disabled={actionLoading}
                        title="Previous Player"
                        className="p-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-200 transition disabled:opacity-40"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleNextPlayer}
                        disabled={actionLoading}
                        title="Next Player"
                        className="p-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-200 transition disabled:opacity-40"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {!currentPlayer ? (
                    <div className="text-center py-10 text-zinc-500">
                      <p className="text-sm font-medium mb-3">No active player loaded.</p>
                      <button
                        onClick={handleNextPlayer}
                        className="px-5 py-2 rounded-full bg-zinc-900 text-white text-xs font-semibold hover:bg-black transition"
                      >
                        Load First Player
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex gap-4 items-center mb-4">
                        <img
                          src={resolveImageUrl(currentPlayer.photo) || 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=200&auto=format&fit=crop&q=80'}
                          alt={currentPlayer.name}
                          className="w-20 h-24 rounded-xl object-cover border border-zinc-200 shrink-0 shadow-sm"
                        />
                        <div className="truncate flex-1">
                          <span className="text-[10px] px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-zinc-100 text-zinc-700 border border-zinc-200">
                            {currentPlayer.category}
                          </span>
                          <h3 className="text-2xl font-bold text-zinc-900 mt-1 truncate">
                            {currentPlayer.name}
                          </h3>
                          <p className="text-xs text-zinc-500 mt-0.5">{currentPlayer.battingStyle} • {currentPlayer.bowlingStyle}</p>
                          <p className="text-xs font-semibold text-zinc-800 mt-1.5">Base Price: {formatINR(currentPlayer.basePrice)}</p>
                        </div>
                      </div>

                      {/* Live State Box */}
                      <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-zinc-500 uppercase font-semibold">Current Bid</span>
                          <span className="text-3xl font-bold text-zinc-900 tracking-tight">{formatINR(currentBid)}</span>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-zinc-200">
                          <span className="text-xs text-zinc-500 uppercase font-semibold">Highest Bidder</span>
                          <span className="text-sm font-bold text-zinc-900">
                            {highestBidder ? highestBidder.name : 'No bids yet'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-zinc-500 uppercase font-semibold">Auction Status</span>
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wide ${
                            status === 'bidding' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                            status === 'sold' ? 'bg-red-100 text-red-800 border border-red-300' :
                            status === 'unsold' ? 'bg-red-50 text-red-700 border border-red-300' :
                            'bg-zinc-200 text-zinc-800'
                          }`}>
                            {status}
                          </span>
                        </div>
                      </div>

                      {/* Quick Player Switcher Dropdown */}
                      <div className="mt-3.5">
                        <label className="text-[10px] text-zinc-500 uppercase font-semibold block mb-1">Jump to Player in Set:</label>
                        <select
                          value={currentPlayer._id}
                          onChange={(e) => handleSelectPlayer(e.target.value)}
                          className="w-full bg-white border border-zinc-200 rounded-xl p-2.5 text-xs text-zinc-900 font-medium focus:outline-none focus:border-zinc-900 transition"
                        >
                          {players.map((p) => (
                            <option key={p._id} value={p._id}>
                              #{p.orderInRound} {p.name} ({p.status.toUpperCase()}) — ₹{p.basePrice}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* LIVE BIDDING CONTROLS (Cols 6-12) */}
                <div className="col-span-12 lg:col-span-7 bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm space-y-5">
                  
                  {/* 1. SESSION CONTROLS: START / PAUSE / NEXT */}
                  <div className="flex items-center gap-3">
                    {status === 'bidding' ? (
                      <button
                        onClick={handleTogglePause}
                        disabled={actionLoading}
                        className="flex-1 py-3 px-4 rounded-xl bg-zinc-900 hover:bg-black text-white font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition"
                      >
                        <Pause className="w-4 h-4 text-white" />
                        <span>Pause Bidding</span>
                      </button>
                    ) : status === 'paused' ? (
                      <button
                        onClick={handleTogglePause}
                        disabled={actionLoading}
                        className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition shadow-sm"
                      >
                        <Play className="w-4 h-4" />
                        <span>Resume Bidding</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleStartBidding}
                        disabled={actionLoading || !currentPlayer || currentPlayer.status === 'sold'}
                        className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-sm"
                      >
                        <Play className="w-4 h-4" />
                        <span>Start Bidding Session</span>
                      </button>
                    )}

                    <button
                      onClick={handleNextPlayer}
                      disabled={actionLoading}
                      className="py-3 px-5 rounded-xl bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-zinc-900 font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 transition disabled:opacity-40"
                    >
                      <span>Next Player</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* 2. STEP 1: SELECT BIDDING TEAM */}
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-600 block mb-2">
                      Step 1: Select Bidding Team
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      {teams.map((t) => {
                        const isSelected = selectedBiddingTeamId === t._id;
                        const nextMinBid = !highestBidder ? (currentPlayer?.basePrice || 300) : (currentBid + selectedIncrement);
                        const hasPurse = t.remainingPurse >= nextMinBid;

                        return (
                          <button
                            key={t._id}
                            type="button"
                            onClick={() => setSelectedBiddingTeamId(t._id)}
                            className={`p-3 rounded-xl border text-left flex items-center justify-between transition ${
                              isSelected
                                ? 'border-zinc-900 bg-zinc-900/5 ring-2 ring-zinc-900'
                                : 'border-zinc-200 bg-zinc-50 hover:bg-zinc-100'
                            } ${!hasPurse ? 'opacity-50' : ''}`}
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              <div
                                className="w-3.5 h-3.5 rounded-full shrink-0"
                                style={{ backgroundColor: t.color || '#18181b' }}
                              />
                              <div className="truncate">
                                <span className="text-xs font-bold text-zinc-900 block truncate">{t.name}</span>
                                <span className="text-[10px] text-zinc-500">{t.squadCount || 0} players</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className={`text-xs font-bold block ${hasPurse ? 'text-zinc-900' : 'text-red-600'}`}>
                                {formatINR(t.remainingPurse)}
                              </span>
                              {!hasPurse && (
                                <span className="text-[9px] text-red-600 font-medium">Low Purse</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. STEP 2: CHOOSE INCREMENT & RAISE BID */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
                        Step 2: Choose Increment & Raise Bid
                      </label>
                      <span className="text-xs text-zinc-600 font-medium">
                        Next Bid: <strong className="text-zinc-900 font-bold">
                          {formatINR(!highestBidder ? (currentPlayer?.basePrice || 300) : (currentBid + selectedIncrement))}
                        </strong>
                      </span>
                    </div>

                    {/* Preset Increments */}
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {[100, 200, 500, 1000].map((inc) => (
                        <button
                          key={inc}
                          type="button"
                          onClick={() => setSelectedIncrement(inc)}
                          className={`py-2 px-3 rounded-xl text-xs font-bold tracking-wider border transition ${
                            selectedIncrement === inc
                              ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm'
                              : 'bg-white text-zinc-800 border-zinc-200 hover:bg-zinc-50'
                          }`}
                        >
                          +₹{inc}
                        </button>
                      ))}
                    </div>

                    {/* Prominent + Bid Button */}
                    <button
                      type="button"
                      onClick={() => handlePlaceBid(null, selectedIncrement)}
                      disabled={actionLoading || !selectedBiddingTeamId || !['bidding', 'ready'].includes(status) || currentPlayer?.status === 'sold' || currentPlayer?.status === 'unsold'}
                      className="w-full py-3.5 rounded-xl bg-zinc-900 hover:bg-black text-white font-bold text-sm tracking-wide transition disabled:opacity-50 shadow-md flex items-center justify-center gap-2"
                    >
                      <span>+ Bid</span>
                      <span className="text-emerald-400 font-extrabold">
                        ({formatINR(!highestBidder ? (currentPlayer?.basePrice || 300) : (currentBid + selectedIncrement))})
                      </span>
                      {teams.find((t) => t._id === selectedBiddingTeamId) && (
                        <span className="text-xs font-normal text-zinc-300 ml-1">
                          • {teams.find((t) => t._id === selectedBiddingTeamId).name}
                        </span>
                      )}
                    </button>

                    {/* Custom Bid Input */}
                    <div className="flex gap-2 mt-2.5">
                      <input
                        type="number"
                        placeholder="Or enter custom exact bid (₹)"
                        value={customBidAmount}
                        onChange={(e) => setCustomBidAmount(e.target.value)}
                        className="flex-1 bg-white border border-zinc-200 rounded-xl px-3.5 py-2 text-xs text-zinc-900 focus:outline-none focus:border-zinc-900 transition"
                      />
                      <button
                        type="button"
                        onClick={() => handlePlaceBid(customBidAmount, null)}
                        disabled={actionLoading || !customBidAmount || !selectedBiddingTeamId || currentPlayer?.status === 'sold' || currentPlayer?.status === 'unsold'}
                        className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-zinc-800 text-xs font-semibold transition disabled:opacity-50"
                      >
                        Submit Custom
                      </button>
                    </div>
                  </div>

                  {/* 4. STEP 3: RESOLUTION CONTROLS (HAMMER / SOLD & UNSOLD) */}
                  <div className="pt-3 border-t border-zinc-100 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={handleSellPlayer}
                      disabled={actionLoading || !highestBidder || currentPlayer?.status === 'sold'}
                      className="py-3.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-md"
                    >
                      <Gavel className="w-4 h-4" />
                      <span>HAMMER / SOLD</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleMarkUnsold}
                      disabled={actionLoading || currentPlayer?.status === 'sold'}
                      className="py-3.5 px-4 rounded-xl border-2 border-red-600 text-red-600 hover:bg-red-50 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>MARK UNSOLD</span>
                    </button>
                  </div>

                  {/* Undo last transaction */}
                  <div className="pt-1 text-right">
                    <button
                      type="button"
                      onClick={() => setShowUndoModal(true)}
                      className="text-xs text-zinc-400 hover:text-red-600 flex items-center gap-1.5 ml-auto transition font-medium"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Revert / Undo Last Sale Transaction</span>
                    </button>
                  </div>

                </div>
              </div>

              {/* Row 2: Teams Purse & Squad Audit Table */}
              <div className="bg-white border border-[#e4e4e7] rounded-lg p-5 shadow-sm">
                <h3 className="text-sm font-black  uppercase tracking-wider text-[#181818] mb-3">
                  FRANCHISE TEAMS PURSE & SQUAD STATUS
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#f4f4f5] text-[#64748B] font-bold uppercase text-[10px]">
                      <tr>
                        <th className="p-3">Team</th>
                        <th className="p-3">Captain</th>
                        <th className="p-3">Starting Purse</th>
                        <th className="p-3">Total Spent</th>
                        <th className="p-3">Remaining Purse</th>
                        <th className="p-3">Squad Size</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f4f4f5]">
                      {teams.map((t) => (
                        <tr key={t._id} className="hover:bg-[#F9FAFB]">
                          <td className="p-3 font-bold text-[#181818] flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: t.color || '#18181b' }} />
                            {t.name} ({t.code})
                          </td>
                          <td className="p-3 text-[#64748B]">{t.captain || '—'}</td>
                          <td className="p-3 text-[#181818] ">{formatINR(t.startingPurse)}</td>
                          <td className="p-3 text-[#dc2626] font-bold ">{formatINR(t.totalSpent)}</td>
                          <td className="p-3 text-[#181818] font-black  text-sm">{formatINR(t.remainingPurse)}</td>
                          <td className="p-3 text-[#181818] font-bold">{t.squadCount || 0} players</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* ========================================================== */}
          {/* TAB 2: PLAYER MANAGEMENT                                   */}
          {/* ========================================================== */}
          {activeTab === 'players' && (
            <div className="space-y-5 max-w-7xl mx-auto">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-lg font-black uppercase text-[#181818]">Player Roster</h3>
                    <span className="px-2 py-0.5 rounded-full bg-[#f4f4f5] border border-[#e4e4e7] text-[11px] font-bold text-[#64748B]">
                      {filteredPlayers.length} {filteredPlayers.length === 1 ? 'Player' : 'Players'}
                    </span>
                  </div>
                  <p className="text-xs text-[#64748B]">Add, edit, assign sets, or re-auction players</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowCSVModal(true)}
                    className="px-3.5 py-2 rounded bg-white hover:bg-[#f4f4f5] border border-[#e4e4e7] text-xs font-bold text-[#181818] flex items-center gap-2 transition"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-[#18181b]" />
                    <span>Import CSV</span>
                  </button>
                  <button
                    onClick={() => {
                      setEditingPlayer(null);
                      setPlayerForm({
                        name: '', category: 'All-rounder', battingStyle: 'Right Hand Bat',
                        bowlingStyle: 'Right Arm Medium', basePrice: 200, photo: '',
                        description: '', roundId: (selectedSetFilter !== 'ALL' && selectedSetFilter) ? selectedSetFilter : (rounds[0]?._id || ''), matches: 0, runs: 0, wickets: 0, highestScore: 0, strikeRate: 0
                      });
                      setShowPlayerModal(true);
                    }}
                    className="px-4 py-2 rounded bg-[#18181b] hover:bg-[#09090b] text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition shadow-sm"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Add New Player</span>
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="bg-white border border-[#e4e4e7] rounded-lg p-3 flex flex-wrap items-center gap-3 shadow-sm">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search players by name..."
                    value={playerSearch}
                    onChange={(e) => setPlayerSearch(e.target.value)}
                    className="w-full bg-[#f4f4f5] border border-[#e4e4e7] rounded pl-8 pr-3 py-1.5 text-xs text-[#181818] focus:outline-none focus:border-[#18181b]"
                  />
                </div>

                {/* Filter by Set Dropdown */}
                <div className="flex items-center gap-2">
                  <label htmlFor="set-filter" className="text-[#64748B] font-bold text-xs whitespace-nowrap">
                    Filter by Set
                  </label>
                  <select
                    id="set-filter"
                    aria-label="Filter by Set"
                    value={selectedSetFilter}
                    onChange={(e) => setSelectedSetFilter(e.target.value)}
                    className="bg-[#f4f4f5] border border-[#e4e4e7] rounded px-3 py-1.5 text-xs text-[#181818] font-bold focus:outline-none focus:border-[#18181b] cursor-pointer"
                  >
                    <option value="ALL">All Sets</option>
                    {rounds.map((r) => (
                      <option key={r._id} value={r._id}>
                        {r.name}
                      </option>
                    ))}
                  </select>

                  {/* Player Count for Selected Set */}
                  <span
                    className="px-2.5 py-1 rounded bg-[#18181b] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm"
                    title="Player count for selected set"
                  >
                    <Users className="w-3 h-3 text-zinc-300" />
                    <span>{selectedSetPlayerCount} Players</span>
                  </span>
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-[#64748B] font-bold">Status:</span>
                  {['All', 'UPCOMING', 'SOLD', 'UNSOLD'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider transition ${
                        statusFilter === st
                          ? 'bg-[#18181b] text-white'
                          : 'bg-[#f4f4f5] text-[#64748B] hover:text-[#181818]'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                {/* Category Filter */}
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-[#64748B] font-bold">Category:</span>
                  {['All', 'Batter', 'Bowler', 'All-rounder', 'Wicketkeeper'].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider transition ${
                        categoryFilter === cat
                          ? 'bg-[#18181b] text-white'
                          : 'bg-[#f4f4f5] text-[#64748B] hover:text-[#181818]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Players Table */}
              <div className="bg-white border border-[#e4e4e7] rounded-lg overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#f4f4f5] text-[#64748B] font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-3.5">Player</th>
                      <th className="p-3.5">Category</th>
                      <th className="p-3.5">Set</th>
                      <th className="p-3.5">Base Price</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Sold To / Winning Price</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f4f4f5]">
                    {filteredPlayers.map((p) => (
                      <tr key={p._id} className="hover:bg-[#F9FAFB]">
                        <td className="p-3.5 font-bold text-[#181818] flex items-center gap-3">
                          <img
                            src={resolveImageUrl(p.photo) || 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=100&auto=format&fit=crop&q=80'}
                            alt={p.name}
                            className="w-9 h-9 rounded object-cover border border-[#e4e4e7] shrink-0"
                          />
                          <div>
                            <span className="block">{p.name}</span>
                            <span className="text-[10px] text-[#64748B] font-normal">{p.battingStyle}</span>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#f4f4f5] text-[#181818] border border-[#e4e4e7] ">
                            {p.category}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="px-2.5 py-1 rounded text-[11px] font-bold bg-[#f4f4f5] text-[#181818] border border-[#e4e4e7] tracking-wide inline-flex items-center gap-1.5 shadow-none">
                            <Layers className="w-3 h-3 text-[#64748B]" />
                            {p.roundId?.name || (typeof p.roundId === 'string' && rounds.find(r => r._id === p.roundId)?.name) || 'Unassigned'}
                          </span>
                        </td>
                        <td className="p-3.5 font-bold text-[#181818] text-sm">
                          {formatINR(p.basePrice)}
                        </td>
                        <td className="p-3.5">
                          {/* Red styling for SOLD status */}
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            p.status === 'sold' ? 'bg-[#dc2626] text-white' :
                            p.status === 'unsold' ? 'border border-[#dc2626] text-[#dc2626]' :
                            'bg-[#f4f4f5] text-[#64748B]'
                          }`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-[#181818]">
                          {p.status === 'sold' ? (
                            <span className="font-bold text-[#181818]">
                              {p.soldToTeam?.name} ({formatINR(p.soldPrice)})
                            </span>
                          ) : (
                            <span className="text-[#64748B]">—</span>
                          )}
                        </td>
                        <td className="p-3.5 text-right space-x-1.5">
                          <button
                            onClick={() => handleSelectPlayer(p._id)}
                            title="Set as Current Live Auction Player"
                            className="p-1.5 bg-[#f4f4f5] hover:bg-[#18181b] hover:text-white rounded text-[#181818] transition"
                          >
                            <Gavel className="w-3.5 h-3.5" />
                          </button>
                          {p.status === 'unsold' && (
                            <button
                              onClick={() => handleReauctionPlayer(p._id)}
                              title="Re-Auction Unsold Player"
                              className="p-1.5 bg-[#f4f4f5] hover:bg-[#18181b] hover:text-white rounded text-[#18181b] transition"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setEditingPlayer(p);
                              setPlayerForm({
                                name: p.name,
                                category: p.category,
                                battingStyle: p.battingStyle,
                                bowlingStyle: p.bowlingStyle,
                                basePrice: p.basePrice,
                                photo: p.photo,
                                description: p.description,
                                roundId: p.roundId?._id || (typeof p.roundId === 'string' ? p.roundId : ''),
                                matches: p.stats?.matches || 0,
                                runs: p.stats?.runs || 0,
                                wickets: p.stats?.wickets || 0,
                                highestScore: p.stats?.highestScore || 0,
                                strikeRate: p.stats?.strikeRate || 0
                              });
                              setShowPlayerModal(true);
                            }}
                            className="p-1.5 bg-[#f4f4f5] hover:bg-[#e4e4e7] rounded text-[#181818] transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {/* Red styling for destructive delete - available for ALL statuses */}
                          <button
                            onClick={() => handleDeletePlayerClick(p)}
                            title={`Delete Player: ${p.name}`}
                            className="p-1.5 bg-[#f4f4f5] hover:bg-[#dc2626] hover:text-white rounded text-[#64748B] transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredPlayers.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-[#64748B] font-medium">
                          No players found matching the selected filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* TAB 3: ROUND MANAGEMENT                                   */}
          {/* ========================================================== */}
          {activeTab === 'rounds' && (
            <div className="space-y-5 max-w-7xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black  uppercase text-[#181818]">Auction Rounds</h3>
                  <p className="text-xs text-[#64748B]">Configure round sequences and assign player pools</p>
                </div>
                <button
                  onClick={() => {
                    setEditingRound(null);
                    setRoundForm({ name: '', description: '', order: rounds.length + 1 });
                    setShowRoundModal(true);
                  }}
                  className="px-4 py-2 rounded bg-[#18181b] hover:bg-[#09090b] text-white text-xs font-bold uppercase  tracking-wider flex items-center gap-2 transition shadow-sm"
                >
                  <Layers className="w-4 h-4" />
                  <span>Create Round</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {rounds.map((r) => {
                  const isActive = auctionState?.currentRound?._id === r._id;
                  return (
                    <div
                      key={r._id}
                      className={`bg-white rounded-lg p-5 border shadow-sm ${
                        isActive ? 'border-[#18181b] ring-2 ring-[#18181b]/20' : 'border-[#e4e4e7]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black uppercase tracking-wider text-[#18181b] ">
                          Round #{r.order}
                        </span>
                        {isActive && (
                          <span className="text-[10px] bg-[#18181b] text-white font-bold px-2 py-0.5 rounded  uppercase">
                            Active Round
                          </span>
                        )}
                      </div>

                      <h4 className="text-lg font-bold  text-[#181818] mb-1">{r.name}</h4>
                      <p className="text-xs text-[#64748B] mb-4 min-h-[32px]">{r.description || 'No description provided.'}</p>

                      <div className="grid grid-cols-3 gap-2 bg-[#f4f4f5] p-2.5 rounded border border-[#e4e4e7] text-center mb-4 text-xs">
                        <div>
                          <span className="text-[10px] text-[#64748B] block font-bold">Total</span>
                          <span className="font-bold text-[#181818] ">{r.totalPlayers || 0}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#dc2626] block font-bold">Sold</span>
                          <span className="font-bold text-[#dc2626] ">{r.soldPlayers || 0}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#64748B] block font-bold">Unsold</span>
                          <span className="font-bold text-[#181818] ">{r.unsoldPlayers || 0}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-[#f4f4f5]">
                        <button
                          onClick={() => handleSelectRound(r._id)}
                          disabled={isActive}
                          className="px-3 py-1.5 rounded bg-[#18181b] hover:bg-[#09090b] text-white text-xs font-bold  uppercase tracking-wider transition disabled:opacity-40"
                        >
                          {isActive ? 'Current Active' : 'Activate Round'}
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setEditingRound(r);
                              setRoundForm({ name: r.name, description: r.description, order: r.order });
                              setShowRoundModal(true);
                            }}
                            className="p-1.5 bg-[#f4f4f5] hover:bg-[#e4e4e7] rounded text-[#181818]"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteRound(r._id)}
                            className="p-1.5 bg-[#f4f4f5] hover:bg-[#dc2626] hover:text-white rounded text-[#64748B]"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* TAB 4: TEAM MANAGEMENT                                     */}
          {/* ========================================================== */}
          {activeTab === 'teams' && (
            <div className="space-y-5 max-w-7xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black  uppercase text-[#181818]">Franchise Teams</h3>
                  <p className="text-xs text-[#64748B]">Configure teams, colors, captains, and starting purses</p>
                </div>
                <button
                  onClick={() => {
                    setEditingTeam(null);
                    setTeamForm({
                      name: '', code: '', captain: '', color: '#18181b', startingPurse: 10000, logo: ''
                    });
                    setShowTeamModal(true);
                  }}
                  className="px-4 py-2 rounded bg-[#18181b] hover:bg-[#09090b] text-white text-xs font-bold uppercase  tracking-wider flex items-center gap-2 transition shadow-sm"
                >
                  <Users className="w-4 h-4" />
                  <span>Add Team</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {teams.map((t) => (
                  <div key={t._id} className="bg-white rounded-lg p-5 border border-[#e4e4e7] shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        {t.logo ? (
                          <div className="w-10 h-10 rounded border border-[#e4e4e7] p-0.5 flex items-center justify-center bg-white shadow-sm overflow-hidden">
                            <img
                              src={resolveTeamLogo(t)}
                              alt={t.name}
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          </div>
                        ) : (
                          <div
                            className="w-10 h-10 rounded flex items-center justify-center font-black  text-base text-black shadow-sm"
                            style={{ backgroundColor: t.color || '#18181b' }}
                          >
                            {t.code}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setEditingTeam(t);
                              setTeamForm({
                                name: t.name, code: t.code, captain: t.captain || '',
                                color: t.color || '#18181b', startingPurse: t.startingPurse, logo: t.logo || ''
                              });
                              setShowTeamModal(true);
                            }}
                            className="p-1.5 bg-[#f4f4f5] hover:bg-[#e4e4e7] rounded text-[#181818]"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTeam(t._id)}
                            className="p-1.5 bg-[#f4f4f5] hover:bg-[#dc2626] hover:text-white rounded text-[#64748B]"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <h4 className="text-xl font-bold  text-[#181818] uppercase">{t.name}</h4>
                      <p className="text-xs text-[#64748B] mb-4">Captain: {t.captain || 'Not appointed'}</p>

                      <div className="bg-[#f4f4f5] p-3 rounded border border-[#e4e4e7] space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-[#64748B]">Starting Purse:</span>
                          <span className="font-semibold text-[#181818] ">{formatINR(t.startingPurse)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#64748B]">Total Spent:</span>
                          <span className="font-semibold text-[#dc2626] ">{formatINR(t.totalSpent)}</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-[#e4e4e7]">
                          <span className="text-[#181818] font-bold">Remaining:</span>
                          <span className="font-black text-[#181818]  text-sm">
                            {formatINR(t.remainingPurse)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#f4f4f5] flex items-center justify-between text-xs">
                      <span className="text-[#64748B] font-bold uppercase">Squad Size:</span>
                      <span className="font-bold text-[#181818]  text-sm">{t.squadCount || 0} players</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ============================================================== */}
      {/* MODAL 1: ADD / EDIT PLAYER                                     */}
      {/* ============================================================== */}
      {showPlayerModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-[#e4e4e7] rounded-lg max-w-lg w-full p-6 shadow-xl my-8 text-[#181818]">
            <h3 className="text-xl font-black  uppercase text-[#181818] mb-4">
              {editingPlayer ? 'Edit Player Details' : 'Add New Player'}
            </h3>

            <form onSubmit={handleSavePlayer} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#181818] font-bold uppercase mb-1">Player Name *</label>
                <input
                  type="text"
                  required
                  value={playerForm.name}
                  onChange={(e) => setPlayerForm({ ...playerForm, name: e.target.value })}
                  className="w-full bg-[#f4f4f5] border border-[#e4e4e7] rounded p-2.5 text-[#181818] focus:outline-none focus:border-[#18181b]"
                  placeholder="e.g. Rohit Sharma"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#181818] font-bold uppercase mb-1">Category *</label>
                  <select
                    value={playerForm.category}
                    onChange={(e) => setPlayerForm({ ...playerForm, category: e.target.value })}
                    className="w-full bg-[#f4f4f5] border border-[#e4e4e7] rounded p-2.5 text-[#181818] focus:outline-none focus:border-[#18181b]"
                  >
                    <option value="Batter">Batter</option>
                    <option value="Bowler">Bowler</option>
                    <option value="All-rounder">All-rounder</option>
                    <option value="Wicketkeeper">Wicketkeeper</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#181818] font-bold uppercase mb-1">Base Price (₹) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="50"
                    value={playerForm.basePrice}
                    onChange={(e) => setPlayerForm({ ...playerForm, basePrice: e.target.value })}
                    className="w-full bg-[#f4f4f5] border border-[#e4e4e7] rounded p-2.5 text-[#181818] focus:outline-none focus:border-[#18181b]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#181818] font-bold uppercase mb-1">Batting Style</label>
                  <input
                    type="text"
                    value={playerForm.battingStyle}
                    onChange={(e) => setPlayerForm({ ...playerForm, battingStyle: e.target.value })}
                    className="w-full bg-[#f4f4f5] border border-[#e4e4e7] rounded p-2.5 text-[#181818]"
                    placeholder="Right Hand Bat"
                  />
                </div>
                <div>
                  <label className="block text-[#181818] font-bold uppercase mb-1">Bowling Style</label>
                  <input
                    type="text"
                    value={playerForm.bowlingStyle}
                    onChange={(e) => setPlayerForm({ ...playerForm, bowlingStyle: e.target.value })}
                    className="w-full bg-[#f4f4f5] border border-[#e4e4e7] rounded p-2.5 text-[#181818]"
                    placeholder="Right Arm Medium Fast"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#181818] font-bold uppercase mb-1">Assigned Set</label>
                <select
                  value={playerForm.roundId}
                  onChange={(e) => setPlayerForm({ ...playerForm, roundId: e.target.value })}
                  className="w-full bg-[#f4f4f5] border border-[#e4e4e7] rounded p-2.5 text-[#181818]"
                >
                  <option value="">-- Unassigned --</option>
                  {rounds.map((r) => (
                    <option key={r._id} value={r._id}>{r.name}</option>
                  ))}
                </select>
              </div>

              {/* Photo Upload / URL */}
              <div>
                <label className="block text-[#181818] font-bold uppercase mb-1">Player Photo</label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={playerForm.photo}
                    onChange={(e) => setPlayerForm({ ...playerForm, photo: e.target.value })}
                    className="flex-1 bg-[#f4f4f5] border border-[#e4e4e7] rounded p-2 text-[#181818] text-xs"
                    placeholder="Image URL or upload file"
                  />
                  <label className="cursor-pointer bg-[#f4f4f5] hover:bg-[#e4e4e7] text-[#181818] border border-[#e4e4e7] px-3 py-2 rounded flex items-center gap-1.5 font-bold">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageUpload(e, 'player')}
                    />
                  </label>
                </div>
              </div>

              {/* Career Stats Grid */}
              <div className="p-3 bg-[#f4f4f5] rounded border border-[#e4e4e7] space-y-2">
                <span className="font-bold uppercase tracking-wider text-[#64748B] block text-[10px]">Career Statistics</span>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] text-[#64748B] block">Matches</label>
                    <input
                      type="number"
                      value={playerForm.matches}
                      onChange={(e) => setPlayerForm({ ...playerForm, matches: e.target.value })}
                      className="w-full bg-white border border-[#e4e4e7] rounded p-1.5 text-[#181818]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#64748B] block">Runs</label>
                    <input
                      type="number"
                      value={playerForm.runs}
                      onChange={(e) => setPlayerForm({ ...playerForm, runs: e.target.value })}
                      className="w-full bg-white border border-[#e4e4e7] rounded p-1.5 text-[#181818]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#64748B] block">Wickets</label>
                    <input
                      type="number"
                      value={playerForm.wickets}
                      onChange={(e) => setPlayerForm({ ...playerForm, wickets: e.target.value })}
                      className="w-full bg-white border border-[#e4e4e7] rounded p-1.5 text-[#181818]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#64748B] block">Strike Rate</label>
                    <input
                      type="number"
                      step="0.1"
                      value={playerForm.strikeRate}
                      onChange={(e) => setPlayerForm({ ...playerForm, strikeRate: e.target.value })}
                      className="w-full bg-white border border-[#e4e4e7] rounded p-1.5 text-[#181818]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#f4f4f5]">
                <button
                  type="button"
                  onClick={() => setShowPlayerModal(false)}
                  className="px-4 py-2 rounded bg-[#f4f4f5] hover:bg-[#e4e4e7] text-[#181818] font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded bg-[#18181b] hover:bg-[#09090b] text-white font-extrabold uppercase  tracking-wider"
                >
                  Save Player
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: ADD / EDIT TEAM                                       */}
      {/* ============================================================== */}
      {showTeamModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#e4e4e7] rounded-lg max-w-md w-full p-6 shadow-xl text-[#181818]">
            <h3 className="text-xl font-black  uppercase text-[#181818] mb-4">
              {editingTeam ? 'Edit Franchise Team' : 'Add New Team'}
            </h3>

            <form onSubmit={handleSaveTeam} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#181818] font-bold uppercase mb-1">Team Name *</label>
                <input
                  type="text"
                  required
                  value={teamForm.name}
                  onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                  className="w-full bg-[#f4f4f5] border border-[#e4e4e7] rounded p-2.5 text-[#181818]"
                  placeholder="e.g. Super Strikers"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#181818] font-bold uppercase mb-1">Short Code *</label>
                  <input
                    type="text"
                    required
                    maxLength="5"
                    value={teamForm.code}
                    onChange={(e) => setTeamForm({ ...teamForm, code: e.target.value })}
                    className="w-full bg-[#f4f4f5] border border-[#e4e4e7] rounded p-2.5 text-[#181818] uppercase"
                    placeholder="SS"
                  />
                </div>
                <div>
                  <label className="block text-[#181818] font-bold uppercase mb-1">Brand Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={teamForm.color}
                      onChange={(e) => setTeamForm({ ...teamForm, color: e.target.value })}
                      className="w-10 h-9 rounded bg-[#f4f4f5] border border-[#e4e4e7] cursor-pointer"
                    />
                    <input
                      type="text"
                      value={teamForm.color}
                      onChange={(e) => setTeamForm({ ...teamForm, color: e.target.value })}
                      className="flex-1 bg-[#f4f4f5] border border-[#e4e4e7] rounded p-2 text-[#181818]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[#181818] font-bold uppercase mb-1">Captain Name</label>
                <input
                  type="text"
                  value={teamForm.captain}
                  onChange={(e) => setTeamForm({ ...teamForm, captain: e.target.value })}
                  className="w-full bg-[#f4f4f5] border border-[#e4e4e7] rounded p-2.5 text-[#181818]"
                  placeholder="e.g. Rajesh Sharma"
                />
              </div>

              <div>
                <label className="block text-[#181818] font-bold uppercase mb-1">Starting Purse (₹) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="500"
                  value={teamForm.startingPurse}
                  onChange={(e) => setTeamForm({ ...teamForm, startingPurse: e.target.value })}
                  className="w-full bg-[#f4f4f5] border border-[#e4e4e7] rounded p-2.5 text-[#181818]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#f4f4f5]">
                <button
                  type="button"
                  onClick={() => setShowTeamModal(false)}
                  className="px-4 py-2 rounded bg-[#f4f4f5] hover:bg-[#e4e4e7] text-[#181818] font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded bg-[#18181b] hover:bg-[#09090b] text-white font-extrabold uppercase  tracking-wider"
                >
                  Save Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: ADD / EDIT ROUND                                      */}
      {/* ============================================================== */}
      {showRoundModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#e4e4e7] rounded-lg max-w-md w-full p-6 shadow-xl text-[#181818]">
            <h3 className="text-xl font-black  uppercase text-[#181818] mb-4">
              {editingRound ? 'Edit Round' : 'Create New Round'}
            </h3>

            <form onSubmit={handleSaveRound} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#181818] font-bold uppercase mb-1">Round Name *</label>
                <input
                  type="text"
                  required
                  value={roundForm.name}
                  onChange={(e) => setRoundForm({ ...roundForm, name: e.target.value })}
                  className="w-full bg-[#f4f4f5] border border-[#e4e4e7] rounded p-2.5 text-[#181818]"
                  placeholder="e.g. Round 1: Marquee All-Rounders"
                />
              </div>

              <div>
                <label className="block text-[#181818] font-bold uppercase mb-1">Sequence Order *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={roundForm.order}
                  onChange={(e) => setRoundForm({ ...roundForm, order: e.target.value })}
                  className="w-full bg-[#f4f4f5] border border-[#e4e4e7] rounded p-2.5 text-[#181818]"
                />
              </div>

              <div>
                <label className="block text-[#181818] font-bold uppercase mb-1">Description</label>
                <textarea
                  rows="3"
                  value={roundForm.description}
                  onChange={(e) => setRoundForm({ ...roundForm, description: e.target.value })}
                  className="w-full bg-[#f4f4f5] border border-[#e4e4e7] rounded p-2.5 text-[#181818]"
                  placeholder="Category description or rules for this round"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#f4f4f5]">
                <button
                  type="button"
                  onClick={() => setShowRoundModal(false)}
                  className="px-4 py-2 rounded bg-[#f4f4f5] hover:bg-[#e4e4e7] text-[#181818] font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded bg-[#18181b] hover:bg-[#09090b] text-white font-extrabold uppercase  tracking-wider"
                >
                  Save Round
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: UNDO SALE CONFIRMATION (Red Styling)                   */}
      {/* ============================================================== */}
      {showUndoModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-[#dc2626] rounded-lg max-w-md w-full p-6 shadow-xl text-center text-[#181818]">
            <div className="w-14 h-14 rounded-full bg-[#dc2626]/15 border border-[#dc2626]/40 flex items-center justify-center mx-auto mb-3">
              <ShieldAlert className="w-7 h-7 text-[#dc2626]" />
            </div>
            <h3 className="text-xl font-black  uppercase text-[#181818] mb-2">Revert / Undo Sale?</h3>
            <p className="text-xs text-[#64748B] mb-6 leading-relaxed">
              This will undo the sale transaction for <strong className="text-[#181818]">{currentPlayer?.name || 'the current player'}</strong>.
              The purchase price will be automatically refunded to the team's remaining purse, and the player will be removed from their squad.
            </p>

            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowUndoModal(false)}
                className="px-5 py-2 rounded bg-[#f4f4f5] hover:bg-[#e4e4e7] text-[#181818] text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUndoSale}
                className="px-5 py-2 rounded bg-[#dc2626] hover:bg-[#b91c1c] text-white text-xs font-black uppercase  tracking-wider"
              >
                Yes, Revert Sale
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 5: CSV BULK IMPORT                                       */}
      {/* ============================================================== */}
      {showCSVModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#e4e4e7] rounded-lg max-w-lg w-full p-6 shadow-xl text-[#181818]">
            <h3 className="text-xl font-black  uppercase text-[#181818] mb-2">Bulk Import Players via CSV</h3>
            <p className="text-xs text-[#64748B] mb-3">
              Format: <code>Name,Category,BasePrice,BattingStyle,BowlingStyle</code>
            </p>

            <div className="mb-3">
              <button
                type="button"
                onClick={() => {
                  setCsvContent(
                    `Name,Category,BasePrice,BattingStyle,BowlingStyle\nSunil Gavaskar,Batter,500,Right Hand Bat,Right Arm Off Spin\nKapil Dev,All-rounder,600,Right Hand Bat,Right Arm Fast\nZaheer Khan,Bowler,400,Left Hand Bat,Left Arm Fast Medium\nMS Dhoni,Wicketkeeper,600,Right Hand Bat,None`
                  );
                }}
                className="text-xs text-[#18181b] hover:underline font-bold"
              >
                Insert Sample Template
              </button>
            </div>

            <textarea
              rows="7"
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              placeholder="Paste CSV rows here..."
              className="w-full bg-[#f4f4f5] border border-[#e4e4e7] rounded p-3 text-xs text-[#181818] font-mono focus:outline-none focus:border-[#18181b]"
            />

            <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-[#f4f4f5]">
              <button
                type="button"
                onClick={() => setShowCSVModal(false)}
                className="px-4 py-2 rounded bg-[#f4f4f5] hover:bg-[#e4e4e7] text-[#181818] font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCSVImport}
                className="px-5 py-2 rounded bg-[#18181b] hover:bg-[#09090b] text-white font-extrabold uppercase  tracking-wider text-xs"
              >
                Import Players
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 6: DELETE PLAYER CONFIRMATION DIALOG                     */}
      {/* ============================================================== */}
      {showDeletePlayerModal && playerToDelete && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-red-500 rounded-xl max-w-md w-full p-6 shadow-2xl text-[#181818]">
            {/* Header with Alert Icon */}
            <div className="flex items-start gap-3.5 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 border border-red-300 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase text-[#181818]">Delete Player</h3>
                <p className="text-xs text-[#64748B]">
                  Are you sure you want to delete this player from the roster?
                </p>
              </div>
            </div>

            {/* Financial Impact Notice */}
            {playerToDelete.status === 'sold' ? (
              <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs">
                <div className="flex items-center gap-2 font-bold mb-1 text-amber-800">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Automatic Purse Refund Notice</span>
                </div>
                <p className="leading-relaxed">
                  This player is currently <strong>SOLD</strong>. Deleting them will automatically refund{' '}
                  <strong className="text-red-700 font-extrabold">{formatINR(playerToDelete.soldPrice || 0)}</strong> back
                  to <strong>{playerToDelete.soldToTeam?.name || 'the winning team'}</strong>'s remaining purse and
                  remove them from the squad roster.
                </p>
              </div>
            ) : (
              <div className="mb-4 p-3 rounded-lg bg-zinc-50 border border-zinc-200 text-zinc-700 text-xs">
                <p className="leading-relaxed">
                  This player has status <strong className="uppercase">{playerToDelete.status}</strong>. Deleting will
                  remove the player from the tournament database with no purse changes.
                </p>
              </div>
            )}

            {/* Player Details Breakdown */}
            <div className="bg-[#f4f4f5] border border-[#e4e4e7] rounded-lg p-3.5 mb-5 space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-[#e4e4e7]">
                <span className="text-[#64748B] font-semibold">Player Name:</span>
                <span className="font-extrabold text-[#181818] text-sm">{playerToDelete.name}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#64748B] font-semibold">Category:</span>
                <span className="font-bold text-[#181818]">{playerToDelete.category}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#64748B] font-semibold">Current Status:</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                    playerToDelete.status === 'sold'
                      ? 'bg-red-600 text-white'
                      : playerToDelete.status === 'unsold'
                      ? 'border border-red-500 text-red-600'
                      : 'bg-zinc-200 text-zinc-800'
                  }`}
                >
                  {playerToDelete.status}
                </span>
              </div>

              {playerToDelete.status === 'sold' && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B] font-semibold">Winning Team:</span>
                    <span className="font-extrabold text-[#181818]">
                      {playerToDelete.soldToTeam?.name || 'Assigned Franchise'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B] font-semibold">Final Sale Price:</span>
                    <span className="font-extrabold text-red-600 text-sm">
                      {formatINR(playerToDelete.soldPrice || 0)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#e4e4e7] bg-white -mx-3.5 -mb-3.5 p-3 rounded-b-lg">
                    <span className="text-zinc-600 font-bold">Purse Adjustment:</span>
                    <span className="font-extrabold text-emerald-600">
                      +{formatINR(playerToDelete.soldPrice || 0)} Refund to Team
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Dialog Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={deleteLoading}
                onClick={() => {
                  setShowDeletePlayerModal(false);
                  setPlayerToDelete(null);
                }}
                className="px-4 py-2 rounded bg-[#f4f4f5] hover:bg-[#e4e4e7] text-[#181818] text-xs font-bold transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={handleConfirmDeletePlayer}
                className="px-5 py-2 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 transition disabled:opacity-50 shadow-md"
              >
                {deleteLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm & Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

const AuctionState = require('../models/AuctionState');
const Player = require('../models/Player');
const Team = require('../models/Team');
const Round = require('../models/Round');
const Transaction = require('../models/Transaction');
const Bid = require('../models/Bid');
const { recalculateTeamPurse } = require('./teamController');
const { emitEvent } = require('../socket');

// Helper to get or create the single live auction state document
const getOrCreateAuctionState = async () => {
  let state = await AuctionState.findOne();
  if (!state) {
    const firstRound = await Round.findOne().sort({ order: 1 });
    let firstPlayer = null;
    if (firstRound) {
      firstPlayer = await Player.findOne({ roundId: firstRound._id }).sort({ orderInRound: 1 });
    } else {
      firstPlayer = await Player.findOne().sort({ orderInRound: 1 });
    }

    state = new AuctionState({
      currentRound: firstRound ? firstRound._id : null,
      currentPlayer: firstPlayer ? firstPlayer._id : null,
      currentBid: firstPlayer ? firstPlayer.basePrice : 0,
      highestBidder: null,
      status: 'idle',
      bidIncrementOptions: [100, 200, 500, 1000],
      selectedIncrement: 100
    });
    await state.save();
  }
  return state;
};

// Helper to fetch the populated state object with team purse lists and summary statistics
const getFullPopulatedState = async () => {
  const state = await getOrCreateAuctionState();

  let populatedState = await AuctionState.findById(state._id)
    .populate('currentRound')
    .populate({
      path: 'currentPlayer',
      populate: [
        { path: 'roundId' },
        { path: 'soldToTeam', select: 'name code color logo captain startingPurse remainingPurse' }
      ]
    })
    .populate('highestBidder', 'name code color logo captain startingPurse remainingPurse totalSpent')
    .populate('bidHistory.team', 'name code color logo captain')
    .populate('lastSoldDetails.player', 'name category photo basePrice')
    .populate('lastSoldDetails.team', 'name code color logo captain')
    .populate('lastUnsoldPlayer', 'name category photo basePrice');

  // Authoritative State Reconciliation with MongoDB Player & Transaction collections:
  // If the active currentPlayer is persisted as SOLD or UNSOLD in MongoDB,
  // ensure AuctionState matches the persisted Player & Transaction records,
  // EXCEPT when the auction is at an explicit boundary (round_completed or completed).
  if (populatedState && populatedState.currentPlayer && state.status !== 'round_completed' && state.status !== 'completed') {
    const cp = populatedState.currentPlayer;
    let stateChanged = false;

    if (cp.status === 'sold') {
      const tx = await Transaction.findOne({ player: cp._id, type: 'PURCHASE' }).sort({ createdAt: -1 });
      const trueSoldPrice = (tx && tx.amount) ? tx.amount : (cp.soldPrice || cp.basePrice);
      const trueSoldTeamId = (tx && tx.team) ? tx.team : (cp.soldToTeam?._id || cp.soldToTeam);

      if (state.status !== 'sold') {
        state.status = 'sold';
        stateChanged = true;
      }
      if (state.currentBid !== trueSoldPrice) {
        state.currentBid = trueSoldPrice;
        stateChanged = true;
      }
      if (trueSoldTeamId && String(state.highestBidder) !== String(trueSoldTeamId)) {
        state.highestBidder = trueSoldTeamId;
        stateChanged = true;
      }

      if (stateChanged) {
        await state.save();
        populatedState = await AuctionState.findById(state._id)
          .populate('currentRound')
          .populate({
            path: 'currentPlayer',
            populate: [
              { path: 'roundId' },
              { path: 'soldToTeam', select: 'name code color logo captain startingPurse remainingPurse' }
            ]
          })
          .populate('highestBidder', 'name code color logo captain startingPurse remainingPurse totalSpent')
          .populate('bidHistory.team', 'name code color logo captain')
          .populate('lastSoldDetails.player', 'name category photo basePrice')
          .populate('lastSoldDetails.team', 'name code color logo captain')
          .populate('lastUnsoldPlayer', 'name category photo basePrice');
      }
    } else if (cp.status === 'unsold') {
      if (state.status !== 'unsold' || state.highestBidder) {
        state.status = 'unsold';
        state.highestBidder = null;
        await state.save();
        populatedState.status = 'unsold';
        populatedState.highestBidder = null;
      }
    }
  }

  // Summary counts
  const totalPlayers = await Player.countDocuments();
  const soldPlayers = await Player.countDocuments({ status: 'sold' });
  const unsoldPlayers = await Player.countDocuments({ status: 'unsold' });
  const upcomingPlayers = await Player.countDocuments({ status: 'upcoming' });

  // Teams with purse overview
  const teams = await Team.find().sort({ name: 1 });
  const teamsWithCount = await Promise.all(
    teams.map(async (t) => {
      const count = await Player.countDocuments({ soldToTeam: t._id, status: 'sold' });
      return {
        ...t.toObject(),
        squadCount: count
      };
    })
  );

  // Total players in current round & current player's index in round
  let roundTotalPlayers = 0;
  let playerIndexInRound = 0;
  if (populatedState.currentRound) {
    roundTotalPlayers = await Player.countDocuments({ roundId: populatedState.currentRound._id });
    if (populatedState.currentPlayer) {
      const priorInRound = await Player.countDocuments({
        roundId: populatedState.currentRound._id,
        orderInRound: { $lt: populatedState.currentPlayer.orderInRound }
      });
      playerIndexInRound = priorInRound + 1;
    }
  }

  return {
    state: populatedState,
    stats: {
      totalPlayers,
      soldPlayers,
      unsoldPlayers,
      upcomingPlayers,
      roundTotalPlayers,
      playerIndexInRound
    },
    teams: teamsWithCount
  };
};

// Broadcast the latest state to all connected clients
const broadcastStateUpdate = async (extraPayload = {}) => {
  try {
    const fullData = await getFullPopulatedState();
    emitEvent('AUCTION_STATE_UPDATE', { ...fullData, ...extraPayload });
    return fullData;
  } catch (err) {
    console.error('Error broadcasting auction state:', err);
  }
};

// GET /api/auction/state
exports.getState = async (req, res) => {
  try {
    const fullData = await getFullPopulatedState();
    res.json({ success: true, ...fullData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/auction/set-round
exports.setRound = async (req, res) => {
  try {
    const { roundId } = req.body;
    const round = await Round.findById(roundId);
    if (!round) return res.status(404).json({ success: false, message: 'Round not found' });

    const state = await getOrCreateAuctionState();
    state.currentRound = round._id;

    // Find first upcoming player in this round; fallback to first player if all auctioned
    let nextPlayer = await Player.findOne({ roundId: round._id, status: 'upcoming' }).sort({ orderInRound: 1 });
    if (!nextPlayer) {
      nextPlayer = await Player.findOne({ roundId: round._id }).sort({ orderInRound: 1 });
    }

    state.currentPlayer = nextPlayer ? nextPlayer._id : null;
    if (nextPlayer) {
      if (nextPlayer.status === 'sold') {
        const tx = await Transaction.findOne({ player: nextPlayer._id, type: 'PURCHASE' }).sort({ createdAt: -1 });
        state.currentBid = (tx && tx.amount) ? tx.amount : (nextPlayer.soldPrice || nextPlayer.basePrice);
        state.highestBidder = (tx && tx.team) ? tx.team : nextPlayer.soldToTeam;
        state.status = 'sold';
      } else if (nextPlayer.status === 'unsold') {
        state.currentBid = nextPlayer.basePrice;
        state.highestBidder = null;
        state.status = 'unsold';
      } else {
        state.currentBid = nextPlayer.basePrice;
        state.highestBidder = null;
        state.bidHistory = [];
        state.status = 'ready';
      }
    } else {
      state.currentBid = 0;
      state.highestBidder = null;
      state.bidHistory = [];
      state.status = 'idle';
    }
    await state.save();

    await broadcastStateUpdate({ announcement: `Round changed to: ${round.name}` });
    const fullState = await getFullPopulatedState();
    res.json({ success: true, ...fullState });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/auction/set-player
exports.setPlayer = async (req, res) => {
  try {
    const { playerId } = req.body;
    const player = await Player.findById(playerId);
    if (!player) return res.status(404).json({ success: false, message: 'Player not found' });

    const state = await getOrCreateAuctionState();
    state.currentPlayer = player._id;
    if (player.roundId) {
      state.currentRound = player.roundId;
    }

    if (player.status === 'sold') {
      const tx = await Transaction.findOne({ player: player._id, type: 'PURCHASE' }).sort({ createdAt: -1 });
      state.currentBid = (tx && tx.amount) ? tx.amount : (player.soldPrice || player.basePrice);
      state.highestBidder = (tx && tx.team) ? tx.team : (player.soldToTeam?._id || player.soldToTeam);
      state.status = 'sold';
    } else if (player.status === 'unsold') {
      state.currentBid = player.basePrice;
      state.highestBidder = null;
      state.status = 'unsold';
    } else {
      state.currentBid = player.basePrice;
      state.highestBidder = null;
      state.bidHistory = [];
      state.status = 'ready';
    }

    await state.save();
    await broadcastStateUpdate({ announcement: `Now on auction: ${player.name}` });
    const fullState = await getFullPopulatedState();
    res.json({ success: true, ...fullState });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/auction/start-bidding
exports.startBidding = async (req, res) => {
  try {
    const state = await getOrCreateAuctionState();
    if (state.status === 'round_completed') {
      return res.status(400).json({ success: false, message: 'Round has ended. Please move to the next round before starting bidding.' });
    }
    if (!state.currentPlayer) {
      return res.status(400).json({ success: false, message: 'No player selected for auction.' });
    }

    const player = await Player.findById(state.currentPlayer);
    if (player.status === 'sold') {
      return res.status(400).json({ success: false, message: 'This player is already SOLD. Please select another player or undo sale.' });
    }

    state.status = 'bidding';
    if (!state.currentBid || state.currentBid < player.basePrice) {
      state.currentBid = player.basePrice;
    }
    await state.save();

    await broadcastStateUpdate({ announcement: `Bidding started for ${player.name} at ₹${state.currentBid}!` });
    res.json({ success: true, state });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/auction/bid
// Uses sequential Promise queue to guarantee rapid consecutive bids never interleave or use stale DB state
let bidQueue = Promise.resolve();

exports.placeBid = (req, res) => {
  bidQueue = bidQueue.then(async () => {
    try {
      let { teamId, amount, increment } = req.body;
      const state = await getOrCreateAuctionState();

      if (!['bidding', 'ready'].includes(state.status)) {
        return res.status(400).json({ success: false, message: 'Auction is not in active bidding state.' });
      }

      if (!state.currentPlayer) {
        return res.status(400).json({ success: false, message: 'No active player to bid on.' });
      }

      const player = await Player.findById(state.currentPlayer);
      if (!player) {
        return res.status(404).json({ success: false, message: 'Player not found.' });
      }

      if (player.status === 'sold' || player.status === 'unsold' || ['sold', 'unsold'].includes(state.status)) {
        return res.status(400).json({
          success: false,
          message: `Player is already ${player.status === 'sold' || state.status === 'sold' ? 'SOLD' : 'UNSOLD'}. Bidding is closed.`
        });
      }

      const minInc = state.selectedIncrement || 100;
      let targetAmount = 0;
      let isIncremental = false;
      let appliedInc = 0;

      // Base price reference: use currentBid if initialized and valid, otherwise player basePrice
      const currentBase = (state.currentBid && state.currentBid >= player.basePrice)
        ? state.currentBid
        : player.basePrice;

      if (increment !== undefined && increment !== null && increment !== '') {
        // INCREMENTAL BIDDING: Add selected increment to authoritative current bid
        isIncremental = true;
        appliedInc = Number(increment);
        if (isNaN(appliedInc) || appliedInc <= 0) {
          return res.status(400).json({ success: false, message: 'Invalid bid increment amount.' });
        }

        // Validate against configured minimum increment rule
        if (appliedInc < minInc) {
          return res.status(400).json({
            success: false,
            message: `Selected increment (+₹${appliedInc}) is lower than the configured minimum increment (+₹${minInc}).`
          });
        }

        targetAmount = currentBase + appliedInc;
      } else if (amount !== undefined && amount !== null && amount !== '') {
        // CUSTOM EXACT BIDDING: Absolute price provided
        targetAmount = Number(amount);
        if (isNaN(targetAmount) || targetAmount <= 0) {
          return res.status(400).json({ success: false, message: 'Invalid custom bid amount.' });
        }

        // Custom exact bid must be >= currentBase + minInc
        if (targetAmount < currentBase + minInc) {
          return res.status(400).json({
            success: false,
            message: `Custom bid (₹${targetAmount}) must be at least ₹${currentBase + minInc} (current ₹${currentBase} + min increment ₹${minInc}).`
          });
        }
      } else {
        // Fallback default increment
        appliedInc = minInc;
        targetAmount = currentBase + appliedInc;
      }

      // Universal validation
      // 1. Must be strictly higher than current bid
      if (targetAmount <= state.currentBid) {
        return res.status(400).json({
          success: false,
          message: `New bid (₹${targetAmount}) must be strictly higher than current bid (₹${state.currentBid}).`
        });
      }

      // 2. Prevent bids below player base price
      if (targetAmount < player.basePrice) {
        return res.status(400).json({
          success: false,
          message: `Bid cannot be lower than player base price (₹${player.basePrice}).`
        });
      }

      let team = null;
      if (teamId) {
        team = await Team.findById(teamId);
        if (!team) return res.status(404).json({ success: false, message: 'Team not found.' });

        if (state.highestBidder && String(state.highestBidder) === String(team._id)) {
          return res.status(400).json({
            success: false,
            message: `${team.name} is already the highest bidder.`
          });
        }

        if (targetAmount > team.remainingPurse) {
          return res.status(400).json({
            success: false,
            message: `${team.name} only has ₹${team.remainingPurse} remaining in purse. Cannot bid ₹${targetAmount}!`
          });
        }
      } else {
        // Teamless verbal bidding: verify at least one franchise team can afford this bid
        const teams = await Team.find().select('remainingPurse');
        const maxRemainingPurse = teams.reduce((max, t) => Math.max(max, t.remainingPurse || 0), 0);
        if (teams.length > 0 && targetAmount > maxRemainingPurse) {
          return res.status(400).json({
            success: false,
            message: `Bid of ₹${targetAmount} exceeds the maximum purse available across all franchise teams (₹${maxRemainingPurse}).`
          });
        }
      }

      // Authoritative State Update
      state.currentBid = targetAmount;
      if (team) {
        state.highestBidder = team._id;
      }
      state.status = 'bidding';
      state.bidHistory.push({
        team: team ? team._id : null,
        amount: targetAmount,
        timestamp: new Date()
      });
      await state.save();

      // Log bid record
      const bidRecord = new Bid({
        player: player._id,
        team: team ? team._id : null,
        round: state.currentRound,
        amount: targetAmount
      });
      await bidRecord.save();

      emitEvent('BID_PLACED', {
        team: team ? { id: team._id, _id: team._id, name: team.name, code: team.code, color: team.color, logo: team.logo } : null,
        amount: targetAmount,
        currentBid: targetAmount,
        highestBidder: team ? { id: team._id, _id: team._id, name: team.name, code: team.code, color: team.color, logo: team.logo } : null,
        increment: isIncremental ? appliedInc : null,
        playerName: player.name,
        status: 'bidding'
      });

      res.json({ success: true, currentBid: targetAmount, highestBidder: team, status: 'bidding' });

      // Run full state broadcast asynchronously so subsequent rapid bids in queue are not blocked
      broadcastStateUpdate({
        announcement: team
          ? `Bid raised to ₹${targetAmount} by ${team.name}!`
          : isIncremental
          ? `Bid raised by +₹${appliedInc} to ₹${targetAmount}!`
          : `Bid raised to ₹${targetAmount}!`
      }).catch((e) => console.error('Background broadcastStateUpdate error:', e));
    } catch (error) {
      console.error('Error in placeBid:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }).catch((queueErr) => {
    console.error('Fatal queue error in placeBid:', queueErr);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: queueErr.message });
    }
  });
};

// POST /api/auction/sell
exports.sellPlayer = async (req, res) => {
  try {
    const state = await getOrCreateAuctionState();
    if (!state.currentPlayer) {
      return res.status(400).json({ success: false, message: 'No active player to sell.' });
    }

    const player = await Player.findById(state.currentPlayer);
    if (!player) return res.status(404).json({ success: false, message: 'Player not found.' });

    if (player.status === 'sold') {
      return res.status(400).json({ success: false, message: `Player ${player.name} has already been sold!` });
    }

    const selectedTeamId = req.body?.teamId || req.body?.team || req.body?.winningTeamId;
    let team = null;

    if (selectedTeamId) {
      // Authoritative manual selection from SOLD dialog: do not fall back to stale highestBidder
      team = await Team.findById(selectedTeamId);
      if (!team) {
        return res.status(400).json({
          success: false,
          message: 'Selected winning team not found.'
        });
      }
    } else if (state.highestBidder) {
      // Fallback only when no explicit team ID was provided
      team = await Team.findById(state.highestBidder);
      if (!team) {
        return res.status(400).json({
          success: false,
          message: 'Winning team from highest bidder not found.'
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Please choose which team wins the player before finalizing sale.'
      });
    }

    const finalPrice = state.currentBid || player.basePrice;

    // Strict validation against remaining purse
    if (finalPrice > team.remainingPurse) {
      return res.status(400).json({
        success: false,
        message: `Insufficient purse! ${team.name} has ₹${team.remainingPurse}, but winning bid is ₹${finalPrice}.`
      });
    }

    // 1. Mark player SOLD in MongoDB
    player.status = 'sold';
    player.soldToTeam = team._id;
    player.soldPrice = finalPrice;
    player.soldRound = state.currentRound;
    player.soldAt = new Date();
    await player.save();

    // 2. Record transaction (persisted source of truth)
    const transaction = new Transaction({
      player: player._id,
      team: team._id,
      round: state.currentRound,
      amount: finalPrice,
      type: 'PURCHASE',
      notes: `Sold to ${team.name} for ₹${finalPrice}`
    });
    await transaction.save();

    // 3. Deduct purse
    await recalculateTeamPurse(team._id);

    // 4. Update Auction State with final sale details
    state.status = 'sold';
    state.currentBid = finalPrice;
    state.highestBidder = team._id;
    state.lastSoldDetails = {
      player: player._id,
      team: team._id,
      amount: finalPrice,
      timestamp: new Date()
    };
    await state.save();

    // Emit SOLD event for celebratory screen effects and sound
    emitEvent('PLAYER_SOLD', {
      player: { id: player._id, name: player.name, category: player.category, photo: player.photo, soldPrice: finalPrice },
      team: { id: team._id, name: team.name, code: team.code, color: team.color, logo: team.logo },
      amount: finalPrice
    });

    await broadcastStateUpdate({
      announcement: `SOLD! ${player.name} bought by ${team.name} for ₹${finalPrice}!`
    });

    res.json({ success: true, message: `Player SOLD to ${team.name} for ₹${finalPrice}`, player, team, finalPrice });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/auction/unsold
exports.markUnsold = async (req, res) => {
  try {
    const state = await getOrCreateAuctionState();
    if (!state.currentPlayer) {
      return res.status(400).json({ success: false, message: 'No active player to mark unsold.' });
    }

    const player = await Player.findById(state.currentPlayer);
    if (player.status === 'sold') {
      return res.status(400).json({ success: false, message: 'Cannot mark a sold player as unsold directly. Undo sale first.' });
    }

    // Mark UNSOLD (no purse deduction)
    player.status = 'unsold';
    await player.save();

    state.status = 'unsold';
    state.lastUnsoldPlayer = player._id;
    state.highestBidder = null;
    await state.save();

    emitEvent('PLAYER_UNSOLD', {
      player: { id: player._id, name: player.name, category: player.category, basePrice: player.basePrice }
    });

    await broadcastStateUpdate({ announcement: `${player.name} is UNSOLD!` });
    res.json({ success: true, message: `Player marked UNSOLD.`, player });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/auction/pause
exports.togglePause = async (req, res) => {
  try {
    const state = await getOrCreateAuctionState();
    if (state.status === 'bidding') {
      state.status = 'paused';
    } else if (state.status === 'paused') {
      state.status = 'bidding';
    }
    await state.save();
    await broadcastStateUpdate({ announcement: `Auction ${state.status === 'paused' ? 'PAUSED' : 'RESUMED'}` });
    res.json({ success: true, status: state.status });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/auction/next-player
exports.nextPlayer = async (req, res) => {
  try {
    const state = await getOrCreateAuctionState();
    if (!state.currentPlayer) {
      return res.status(400).json({ success: false, message: 'No player currently selected.' });
    }

    const currentPlayer = await Player.findById(state.currentPlayer);
    const roundId = state.currentRound || currentPlayer.roundId;

    // Find next upcoming player in the same round (strictly deterministic by orderInRound)
    let nextPlayer = await Player.findOne({
      roundId,
      status: 'upcoming',
      orderInRound: { $gt: currentPlayer.orderInRound }
    }).sort({ orderInRound: 1, createdAt: 1, _id: 1 });

    // If none upcoming with higher order, check any remaining upcoming in this round
    if (!nextPlayer) {
      nextPlayer = await Player.findOne({
        roundId,
        status: 'upcoming',
        _id: { $ne: currentPlayer._id }
      }).sort({ orderInRound: 1, createdAt: 1, _id: 1 });
    }

    // EXPLICIT ROUND COMPLETION: Do NOT automatically start the next round!
    if (!nextPlayer && roundId) {
      const currentRound = await Round.findById(roundId);
      let nextRound = null;
      if (currentRound) {
        nextRound = await Round.findOne({ order: { $gt: currentRound.order } }).sort({ order: 1 });
      }

      if (nextRound) {
        const roundTitle = currentRound?.name
          ? `${currentRound.name.toUpperCase().replace(/\s*COMPLETED\s*$/i, '')} COMPLETED`
          : `ROUND ${currentRound?.order || 1} COMPLETED`;
        state.status = 'round_completed';
        state.announcement = roundTitle;
        await state.save();

        emitEvent('ROUND_COMPLETED', {
          round: currentRound,
          nextRound
        });

        await broadcastStateUpdate({
          announcement: roundTitle
        });
        const fullState = await getFullPopulatedState();
        return res.json({
          success: true,
          roundCompleted: true,
          currentRound,
          nextRound,
          message: `${currentRound ? currentRound.name : 'Round'} completed! Bidding is paused until moving to next round.`,
          ...fullState
        });
      } else {
        // No further rounds remain: AUCTION COMPLETED
        state.status = 'completed';
        state.announcement = 'AUCTION COMPLETED';
        await state.save();

        emitEvent('AUCTION_COMPLETED', {});
        await broadcastStateUpdate({ announcement: 'AUCTION COMPLETED' });
        const fullState = await getFullPopulatedState();
        return res.json({
          success: true,
          completed: true,
          message: 'All configured rounds and players have been auctioned! AUCTION COMPLETED.',
          ...fullState
        });
      }
    }

    // Setup new player, preserving sold/unsold state if already resolved
    state.currentPlayer = nextPlayer._id;
    if (nextPlayer.status === 'sold') {
      const tx = await Transaction.findOne({ player: nextPlayer._id, type: 'PURCHASE' }).sort({ createdAt: -1 });
      state.currentBid = (tx && tx.amount) ? tx.amount : (nextPlayer.soldPrice || nextPlayer.basePrice);
      state.highestBidder = (tx && tx.team) ? tx.team : nextPlayer.soldToTeam;
      state.status = 'sold';
    } else if (nextPlayer.status === 'unsold') {
      state.currentBid = nextPlayer.basePrice;
      state.highestBidder = null;
      state.status = 'unsold';
    } else {
      state.currentBid = nextPlayer.basePrice;
      state.highestBidder = null;
      state.status = 'ready';
    }
    state.bidHistory = [];
    await state.save();

    await broadcastStateUpdate({ announcement: `Up next: ${nextPlayer.name}` });
    const fullState = await getFullPopulatedState();
    res.json({ success: true, ...fullState });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/auction/prev-player
exports.prevPlayer = async (req, res) => {
  try {
    const state = await getOrCreateAuctionState();
    if (!state.currentPlayer) {
      return res.status(400).json({ success: false, message: 'No player currently selected.' });
    }

    const currentPlayer = await Player.findById(state.currentPlayer);
    const roundId = state.currentRound || currentPlayer.roundId;

    // Find player with lower orderInRound
    let prevPlayer = await Player.findOne({
      roundId,
      orderInRound: { $lt: currentPlayer.orderInRound }
    }).sort({ orderInRound: -1 });

    if (!prevPlayer) {
      return res.status(400).json({ success: false, message: 'Already at the first player of this round.' });
    }

    state.currentPlayer = prevPlayer._id;
    if (prevPlayer.status === 'sold') {
      const tx = await Transaction.findOne({ player: prevPlayer._id, type: 'PURCHASE' }).sort({ createdAt: -1 });
      state.currentBid = (tx && tx.amount) ? tx.amount : (prevPlayer.soldPrice || prevPlayer.basePrice);
      state.highestBidder = (tx && tx.team) ? tx.team : prevPlayer.soldToTeam;
      state.status = 'sold';
    } else if (prevPlayer.status === 'unsold') {
      state.currentBid = prevPlayer.basePrice;
      state.highestBidder = null;
      state.status = 'unsold';
    } else {
      state.currentBid = prevPlayer.basePrice;
      state.highestBidder = null;
      state.status = 'ready';
    }
    state.bidHistory = [];
    await state.save();

    await broadcastStateUpdate({ announcement: `Moved to previous player: ${prevPlayer.name}` });
    const fullState = await getFullPopulatedState();
    res.json({ success: true, ...fullState });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/auction/undo-sale
exports.undoSale = async (req, res) => {
  try {
    const { playerId } = req.body;
    const state = await getOrCreateAuctionState();

    const targetPlayerId = playerId || state.currentPlayer;
    if (!targetPlayerId) {
      return res.status(400).json({ success: false, message: 'No player specified to undo.' });
    }

    const player = await Player.findById(targetPlayerId);
    if (!player || player.status !== 'sold') {
      return res.status(400).json({ success: false, message: 'Player is not in SOLD status.' });
    }

    const previousTeamId = player.soldToTeam;
    const previousPrice = player.soldPrice;

    // 1. Create reversal transaction
    const reversalTx = new Transaction({
      player: player._id,
      team: previousTeamId,
      round: player.soldRound || player.roundId,
      amount: -previousPrice,
      type: 'REVERSAL',
      notes: `Undid sale of ${player.name} to team.`
    });
    await reversalTx.save();

    // 2. Reset player
    player.status = 'upcoming';
    player.soldToTeam = null;
    player.soldPrice = 0;
    player.soldRound = null;
    player.soldAt = null;
    await player.save();

    // 3. Restore team purse
    if (previousTeamId) {
      await recalculateTeamPurse(previousTeamId);
    }

    // 4. Update live state
    state.currentPlayer = player._id;
    state.currentBid = player.basePrice;
    state.highestBidder = null;
    state.bidHistory = [];
    state.status = 'ready';
    state.lastSoldDetails = null;
    await state.save();

    emitEvent('TRANSACTION_REVERTED', {
      playerId: player._id,
      playerName: player.name,
      teamId: previousTeamId,
      amountRestored: previousPrice
    });

    await broadcastStateUpdate({ announcement: `Sale undone for ${player.name}. Purse restored!` });
    res.json({ success: true, message: `Sale undone for ${player.name}. ₹${previousPrice} restored to team.`, player });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/auction/set-increment
exports.setBidIncrement = async (req, res) => {
  try {
    const { increment } = req.body;
    const inc = Number(increment);
    if (!inc || inc <= 0) return res.status(400).json({ success: false, message: 'Invalid increment' });

    const state = await getOrCreateAuctionState();
    state.selectedIncrement = inc;
    if (!state.bidIncrementOptions.includes(inc)) {
      state.bidIncrementOptions.push(inc);
      state.bidIncrementOptions.sort((a, b) => a - b);
    }
    await state.save();

    await broadcastStateUpdate();
    res.json({ success: true, state });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/auction/end-round
exports.endRound = async (req, res) => {
  try {
    const state = await getOrCreateAuctionState();
    let currentRound = null;
    if (state.currentRound) {
      currentRound = await Round.findById(state.currentRound);
    }
    if (!currentRound && state.currentPlayer) {
      const cp = await Player.findById(state.currentPlayer);
      if (cp?.roundId) currentRound = await Round.findById(cp.roundId);
    }
    if (!currentRound) {
      currentRound = await Round.findOne().sort({ order: 1 });
    }
    if (!currentRound) {
      return res.status(400).json({ success: false, message: 'No round found to end.' });
    }

    state.currentRound = currentRound._id;
    const nextRound = await Round.findOne({ order: { $gt: currentRound.order } }).sort({ order: 1 });

    if (nextRound) {
      const roundTitle = currentRound?.name
        ? `${currentRound.name.toUpperCase().replace(/\s*COMPLETED\s*$/i, '')} COMPLETED`
        : `ROUND ${currentRound?.order || 1} COMPLETED`;
      state.status = 'round_completed';
      state.announcement = roundTitle;
      await state.save();

      emitEvent('ROUND_COMPLETED', {
        round: currentRound,
        nextRound
      });

      await broadcastStateUpdate({
        announcement: roundTitle
      });

      const fullState = await getFullPopulatedState();
      return res.json({
        success: true,
        roundCompleted: true,
        currentRound,
        nextRound,
        message: `Round ${currentRound.order || 1} ended! Bidding is paused until moving to next round.`,
        ...fullState
      });
    } else {
      state.status = 'completed';
      state.announcement = 'AUCTION COMPLETED';
      await state.save();

      emitEvent('AUCTION_COMPLETED', {});
      await broadcastStateUpdate({ announcement: 'AUCTION COMPLETED' });
      const fullState = await getFullPopulatedState();
      return res.json({
        success: true,
        completed: true,
        message: 'All configured rounds have ended! AUCTION COMPLETED.',
        ...fullState
      });
    }
  } catch (error) {
    console.error('Error ending round:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/auction/advance-round
exports.advanceRound = async (req, res) => {
  try {
    const state = await getOrCreateAuctionState();
    if (!state.currentRound) {
      return res.status(400).json({ success: false, message: 'No current round set.' });
    }

    const currentRound = await Round.findById(state.currentRound);
    if (!currentRound) {
      return res.status(404).json({ success: false, message: 'Current round not found.' });
    }

    const nextRound = await Round.findOne({ order: { $gt: currentRound.order } }).sort({ order: 1 });
    if (!nextRound) {
      state.status = 'completed';
      state.announcement = 'AUCTION COMPLETED';
      await state.save();
      await broadcastStateUpdate({ announcement: 'AUCTION COMPLETED' });
      const fullState = await getFullPopulatedState();
      return res.json({
        success: true,
        completed: true,
        message: 'No further rounds available. Auction is completed.',
        ...fullState
      });
    }

    // Activate next round
    state.currentRound = nextRound._id;

    // Find first eligible player in next round (preferring upcoming)
    let firstPlayer = await Player.findOne({ roundId: nextRound._id, status: 'upcoming' })
      .sort({ orderInRound: 1, createdAt: 1, _id: 1 });
    if (!firstPlayer) {
      firstPlayer = await Player.findOne({ roundId: nextRound._id })
        .sort({ orderInRound: 1, createdAt: 1, _id: 1 });
    }

    state.currentPlayer = firstPlayer ? firstPlayer._id : null;
    state.currentBid = firstPlayer ? firstPlayer.basePrice : 0;
    state.highestBidder = null;
    state.bidHistory = [];
    // Strict requirement: Do not automatically start bidding; admin must explicitly click "Start Bidding"
    state.status = firstPlayer ? 'ready' : 'idle';
    state.announcement = `Round ${nextRound.order}: ${nextRound.name}`;
    await state.save();

    await broadcastStateUpdate({ announcement: `Round changed to: ${nextRound.name}` });
    const fullState = await getFullPopulatedState();
    res.json({ success: true, ...fullState });
  } catch (error) {
    console.error('Error advancing to next round:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getFullPopulatedState = getFullPopulatedState;
exports.broadcastStateUpdate = broadcastStateUpdate;


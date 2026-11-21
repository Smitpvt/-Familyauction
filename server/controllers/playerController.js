const mongoose = require('mongoose');
const Player = require('../models/Player');
const Round = require('../models/Round');
const Team = require('../models/Team');
const Transaction = require('../models/Transaction');
const Bid = require('../models/Bid');
const AuctionState = require('../models/AuctionState');
const { recalculateTeamPurse } = require('./teamController');
const { broadcastStateUpdate } = require('./auctionController');
const { emitEvent } = require('../socket');

// Re-indexes players within a specific round to strict, gapless 1..N sequence
const normalizeRoundSequence = async (roundId) => {
  if (!roundId) return;
  const players = await Player.find({ roundId }).sort({ orderInRound: 1, createdAt: 1, _id: 1 });
  if (players.length === 0) return;
  const bulkOps = players.map((p, idx) => ({
    updateOne: {
      filter: { _id: p._id },
      update: { $set: { orderInRound: idx + 1 } }
    }
  }));
  await Player.bulkWrite(bulkOps);
};

exports.getAllPlayers = async (req, res) => {
  try {
    const { roundId, status, category, search } = req.query;
    const filter = {};

    if (roundId && roundId.toLowerCase() !== 'all') filter.roundId = roundId;
    if (status && status.toLowerCase() !== 'all') filter.status = status.toLowerCase();
    if (category && category.toLowerCase() !== 'all') filter.category = category;
    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }

    const players = await Player.find(filter)
      .populate('roundId', 'name order')
      .populate('soldToTeam', 'name code color logo');

    // Sort by Round order first, then orderInRound (1..N) within each round
    players.sort((a, b) => {
      const orderA = a.roundId?.order ?? 9999;
      const orderB = b.roundId?.order ?? 9999;
      if (orderA !== orderB) return orderA - orderB;
      return (a.orderInRound || 1) - (b.orderInRound || 1);
    });

    res.json({ success: true, players });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getPlayerById = async (req, res) => {
  try {
    const player = await Player.findById(req.params.id)
      .populate('roundId', 'name order')
      .populate('soldToTeam', 'name code color logo');
    if (!player) return res.status(404).json({ success: false, message: 'Player not found' });
    res.json({ success: true, player });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createPlayer = async (req, res) => {
  try {
    const {
      name,
      category,
      battingStyle,
      bowlingStyle,
      photo,
      basePrice,
      description,
      stats,
      roundId,
      orderInRound
    } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Player name is required' });
    }

    // Determine sequence within the assigned round/set
    let calculatedOrder = orderInRound ? Number(orderInRound) : null;
    if (roundId) {
      if (!calculatedOrder || calculatedOrder < 1) {
        const lastPlayer = await Player.findOne({ roundId }).sort({ orderInRound: -1 });
        calculatedOrder = (lastPlayer?.orderInRound || 0) + 1;
      }
    } else {
      calculatedOrder = calculatedOrder || 1;
    }

    const player = new Player({
      name: name.trim(),
      category: category || 'All-rounder',
      battingStyle: battingStyle || 'Right Hand Bat',
      bowlingStyle: bowlingStyle || 'Right Arm Medium',
      photo: photo || '',
      basePrice: basePrice !== undefined ? Math.max(500, Number(basePrice)) : 500,
      description: description || '',
      stats: stats || { matches: 0, runs: 0, wickets: 0, highestScore: 0, strikeRate: 0 },
      roundId: roundId || null,
      orderInRound: calculatedOrder,
      status: 'upcoming'
    });

    await player.save();

    if (roundId) {
      // Re-normalize players in this round so sequence is gapless and deterministic
      const others = await Player.find({ roundId, _id: { $ne: player._id } })
        .sort({ orderInRound: 1, createdAt: 1, _id: 1 });
      const insertIdx = Math.min(Math.max(0, calculatedOrder - 1), others.length);
      others.splice(insertIdx, 0, player);
      const bulkOps = others.map((p, idx) => ({
        updateOne: {
          filter: { _id: p._id },
          update: { $set: { orderInRound: idx + 1 } }
        }
      }));
      await Player.bulkWrite(bulkOps);
    }

    const populated = await Player.findById(player._id).populate('roundId', 'name order');
    
    // Broadcast state and notify clients of player changes
    if (broadcastStateUpdate) await broadcastStateUpdate();
    emitEvent('PLAYERS_REORDERED', { roundId });

    res.status(201).json({ success: true, player: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updatePlayer = async (req, res) => {
  try {
    const {
      name,
      category,
      battingStyle,
      bowlingStyle,
      photo,
      basePrice,
      description,
      stats,
      roundId,
      orderInRound,
      status
    } = req.body;

    const player = await Player.findById(req.params.id);
    if (!player) return res.status(404).json({ success: false, message: 'Player not found' });

    const oldRoundId = player.roundId ? String(player.roundId) : null;
    const newRoundId = roundId !== undefined ? (roundId ? String(roundId) : null) : oldRoundId;
    const isRoundChanged = oldRoundId !== newRoundId;

    if (name) player.name = name.trim();
    if (category) player.category = category;
    if (battingStyle !== undefined) player.battingStyle = battingStyle;
    if (bowlingStyle !== undefined) player.bowlingStyle = bowlingStyle;
    if (photo !== undefined) player.photo = photo;
    if (basePrice !== undefined) player.basePrice = Math.max(500, Number(basePrice));
    if (description !== undefined) player.description = description;
    if (stats) player.stats = { ...player.stats, ...stats };
    if (roundId !== undefined) player.roundId = roundId || null;

    // If admin explicitly resets status from unsold to upcoming
    if (status && ['upcoming', 'unsold'].includes(status) && player.status !== 'sold') {
      player.status = status;
    }

    if (isRoundChanged) {
      // 1. Moving player between rounds:
      if (newRoundId) {
        if (orderInRound !== undefined && Number(orderInRound) > 0) {
          player.orderInRound = Number(orderInRound);
        } else {
          const lastInNew = await Player.findOne({ roundId: newRoundId }).sort({ orderInRound: -1 });
          player.orderInRound = (lastInNew?.orderInRound || 0) + 1;
        }
      } else {
        player.orderInRound = 1;
      }
      await player.save();

      // Normalize sequence in BOTH the old round and the new round!
      if (oldRoundId) await normalizeRoundSequence(oldRoundId);
      if (newRoundId) {
        const othersInNew = await Player.find({ roundId: newRoundId, _id: { $ne: player._id } })
          .sort({ orderInRound: 1, createdAt: 1, _id: 1 });
        const targetPos = Math.max(1, Math.min(player.orderInRound, othersInNew.length + 1));
        othersInNew.splice(targetPos - 1, 0, player);
        const bulkOps = othersInNew.map((p, idx) => ({
          updateOne: {
            filter: { _id: p._id },
            update: { $set: { orderInRound: idx + 1 } }
          }
        }));
        await Player.bulkWrite(bulkOps);
      }
    } else {
      // 2. Same round, but sequence number changed:
      if (orderInRound !== undefined && Number(orderInRound) !== player.orderInRound && oldRoundId) {
        const targetOrder = Math.max(1, Number(orderInRound));
        player.orderInRound = targetOrder;
        await player.save();

        const others = await Player.find({ roundId: oldRoundId, _id: { $ne: player._id } })
          .sort({ orderInRound: 1, createdAt: 1, _id: 1 });
        const insertIdx = Math.min(targetOrder - 1, others.length);
        others.splice(insertIdx, 0, player);
        const bulkOps = others.map((p, idx) => ({
          updateOne: {
            filter: { _id: p._id },
            update: { $set: { orderInRound: idx + 1 } }
          }
        }));
        await Player.bulkWrite(bulkOps);
      } else {
        if (orderInRound !== undefined) player.orderInRound = Number(orderInRound);
        await player.save();
      }
    }

    const populated = await Player.findById(player._id)
      .populate('roundId', 'name order')
      .populate('soldToTeam', 'name code color logo');

    if (broadcastStateUpdate) await broadcastStateUpdate();
    emitEvent('PLAYERS_REORDERED', { roundId: newRoundId || oldRoundId });

    res.json({ success: true, player: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deletePlayer = async (req, res) => {
  let session = null;
  let inTransaction = false;

  try {
    const player = await Player.findById(req.params.id);
    if (!player) {
      return res.status(404).json({ success: false, message: 'Player not found in database.' });
    }

    let winningTeam = null;
    let refundAmount = 0;
    let purchaseTx = null;

    // 1. If player is SOLD, identify actual winning team & final sale price strictly
    if (player.status === 'sold') {
      let winningTeamId = player.soldToTeam?._id || player.soldToTeam;
      refundAmount = player.soldPrice || 0;

      // Cross-reference with persisted Transaction records
      purchaseTx = await Transaction.findOne({
        player: player._id,
        type: 'PURCHASE'
      }).sort({ createdAt: -1 });

      if (purchaseTx) {
        if (!winningTeamId) winningTeamId = purchaseTx.team;
        if (!refundAmount || refundAmount <= 0) refundAmount = purchaseTx.amount;
      }

      // Financial safety check: stop with error if winning team cannot be identified reliably
      if (!winningTeamId) {
        return res.status(400).json({
          success: false,
          message: `Cannot reliably identify winning team for SOLD player "${player.name}". Deletion aborted to prevent financial errors.`
        });
      }

      winningTeam = await Team.findById(winningTeamId);
      if (!winningTeam) {
        return res.status(400).json({
          success: false,
          message: `Winning team record (${winningTeamId}) not found in database. Deletion aborted to prevent financial errors.`
        });
      }

      if (refundAmount < 0) refundAmount = 0;
    }

    // 2. Start atomic MongoDB transaction where supported
    try {
      session = await mongoose.startSession();
      session.startTransaction();
      inTransaction = true;
    } catch (sessionErr) {
      // Standalone MongoDB without replica set doesn't support transactions
      session = null;
      inTransaction = false;
    }

    const sessionOpt = inTransaction ? { session } : {};

    // 3. Handle associated auction transaction/history according to schema & prevent duplicate refunds
    if (player.status === 'sold' && winningTeam) {
      // Check if this sale was already reversed/refunded
      const existingReversal = purchaseTx
        ? await Transaction.findOne({
            $or: [
              { reversalOf: purchaseTx._id },
              { player: player._id, type: 'REVERSAL' }
            ]
          }).session(inTransaction ? session : null)
        : null;

      if (!existingReversal && refundAmount > 0) {
        // Record the REVERSAL transaction in audit history
        const reversalTx = new Transaction({
          player: player._id,
          team: winningTeam._id,
          round: player.soldRound || player.roundId,
          amount: -refundAmount,
          type: 'REVERSAL',
          reversalOf: purchaseTx?._id || null,
          notes: `Refunded ₹${refundAmount} to ${winningTeam.name} upon deletion of sold player ${player.name}`
        });
        await reversalTx.save(sessionOpt);
      }
    }

    // 4. Delete the player from MongoDB
    await Player.findByIdAndDelete(player._id, sessionOpt);

    // 5. Delete specific bid records strictly for this player
    await Bid.deleteMany({ player: player._id }, sessionOpt);

    // 6. Recalculate team purse atomically - refunding the soldPrice to the winning team
    if (winningTeam) {
      await recalculateTeamPurse(winningTeam._id, inTransaction ? session : null);
    }

    // Commit MongoDB transaction if one was opened
    if (inTransaction && session) {
      await session.commitTransaction();
    }

    // Normalize remaining players in this round to gapless 1..N order
    if (player.roundId) {
      await normalizeRoundSequence(player.roundId);
    }

    // 7. Reconcile live AuctionState if this player was active on stage
    const auctionState = await AuctionState.findOne();
    let stateChanged = false;

    if (auctionState) {
      if (auctionState.currentPlayer && String(auctionState.currentPlayer) === String(player._id)) {
        // The deleted player was on auction: advance or reset
        let nextP = null;
        if (auctionState.currentRound) {
          nextP = await Player.findOne({
            roundId: auctionState.currentRound,
            status: 'upcoming'
          }).sort({ orderInRound: 1 });
        }
        if (!nextP) {
          nextP = await Player.findOne({ status: 'upcoming' }).sort({ orderInRound: 1 });
        }

        auctionState.currentPlayer = nextP ? nextP._id : null;
        auctionState.currentBid = nextP ? nextP.basePrice : 0;
        auctionState.highestBidder = null;
        auctionState.bidHistory = [];
        auctionState.status = nextP ? 'ready' : 'idle';
        stateChanged = true;
      }

      if (auctionState.lastSoldDetails?.player && String(auctionState.lastSoldDetails.player) === String(player._id)) {
        auctionState.lastSoldDetails = null;
        stateChanged = true;
      }

      if (auctionState.lastUnsoldPlayer && String(auctionState.lastUnsoldPlayer) === String(player._id)) {
        auctionState.lastUnsoldPlayer = null;
        stateChanged = true;
      }

      if (stateChanged) {
        await auctionState.save();
      }
    }

    // 8. Synchronize all connected clients via Socket.IO
    const announcement = winningTeam
      ? `Player ${player.name} deleted. ₹${refundAmount} refunded to ${winningTeam.name}.`
      : `Player ${player.name} deleted.`;

    if (broadcastStateUpdate) {
      await broadcastStateUpdate({ announcement });
    }

    emitEvent('PLAYER_DELETED', {
      playerId: player._id,
      playerName: player.name,
      status: player.status,
      refundedTeam: winningTeam ? { id: winningTeam._id, name: winningTeam.name } : null,
      refundAmount: winningTeam ? refundAmount : 0
    });

    const successMessage = winningTeam
      ? `Player "${player.name}" deleted successfully. ₹${refundAmount} refunded to ${winningTeam.name}.`
      : `Player "${player.name}" deleted successfully.`;

    res.json({
      success: true,
      message: successMessage,
      deletedPlayer: {
        id: player._id,
        name: player.name,
        status: player.status
      },
      refund: winningTeam ? {
        teamId: winningTeam._id,
        teamName: winningTeam.name,
        amount: refundAmount
      } : null
    });
  } catch (error) {
    if (inTransaction && session) {
      await session.abortTransaction().catch(() => {});
    }
    console.error('Error deleting player:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to delete player' });
  } finally {
    if (session) {
      session.endSession().catch(() => {});
    }
  }
};

// Re-auction an unsold or previously sold player (with safe reversal)
exports.reauctionPlayer = async (req, res) => {
  try {
    const player = await Player.findById(req.params.id);
    if (!player) return res.status(404).json({ success: false, message: 'Player not found' });

    const previousTeamId = player.soldToTeam;

    if (player.status === 'sold' && previousTeamId) {
      // Revert previous transaction
      const reversalTx = new Transaction({
        player: player._id,
        team: previousTeamId,
        round: player.soldRound || player.roundId,
        amount: -player.soldPrice,
        type: 'REVERSAL',
        notes: `Reverted sale for re-auction of ${player.name}`
      });
      await reversalTx.save();
    }

    player.status = 'upcoming';
    player.soldToTeam = null;
    player.soldPrice = 0;
    player.soldRound = null;
    player.soldAt = null;
    await player.save();

    if (previousTeamId) {
      await recalculateTeamPurse(previousTeamId);
    }

    res.json({ success: true, message: `Player ${player.name} is now available for auction again.`, player });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Bulk CSV or array import
exports.bulkImportPlayers = async (req, res) => {
  try {
    const { players } = req.body;
    if (!Array.isArray(players) || players.length === 0) {
      return res.status(400).json({ success: false, message: 'Array of players is required.' });
    }

    const imported = [];
    for (const p of players) {
      if (!p.name) continue;
      const doc = new Player({
        name: p.name.trim(),
        category: p.category || 'All-rounder',
        battingStyle: p.battingStyle || 'Right Hand Bat',
        bowlingStyle: p.bowlingStyle || 'Right Arm Medium',
        photo: p.photo || '',
        basePrice: Math.max(500, Number(p.basePrice) || 500),
        description: p.description || '',
        stats: {
          matches: Number(p.matches) || 0,
          runs: Number(p.runs) || 0,
          wickets: Number(p.wickets) || 0,
          highestScore: Number(p.highestScore) || 0,
          strikeRate: Number(p.strikeRate) || 0
        },
        roundId: p.roundId || null,
        orderInRound: Number(p.orderInRound) || 1,
        status: 'upcoming'
      });
      await doc.save();
      imported.push(doc);
    }

    res.json({ success: true, count: imported.length, message: `Successfully imported ${imported.length} players.` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/players/reorder
exports.reorderPlayers = async (req, res) => {
  try {
    const { playerId, newOrder, direction, roundId, playerIds } = req.body;

    let targetRoundId = roundId;
    let targetPlayer = null;

    if (playerId) {
      targetPlayer = await Player.findById(playerId);
      if (!targetPlayer) {
        return res.status(404).json({ success: false, message: 'Player not found.' });
      }
      targetRoundId = targetRoundId || targetPlayer.roundId;
    }

    if (!targetRoundId) {
      return res.status(400).json({ success: false, message: 'Target round/set is required to reorder players.' });
    }

    // Fetch all players assigned to this round, sorted deterministically
    const playersInRound = await Player.find({ roundId: targetRoundId })
      .sort({ orderInRound: 1, createdAt: 1, _id: 1 });

    if (playersInRound.length === 0) {
      return res.status(400).json({ success: false, message: 'No players found in this round.' });
    }

    let orderedList = [...playersInRound];

    if (Array.isArray(playerIds) && playerIds.length > 0) {
      // Reordering via full explicit array of IDs
      const idMap = new Map(playersInRound.map(p => [String(p._id), p]));
      const newList = [];
      for (const id of playerIds) {
        if (idMap.has(String(id))) {
          newList.push(idMap.get(String(id)));
          idMap.delete(String(id));
        }
      }
      // Any remaining players appended
      for (const remaining of idMap.values()) {
        newList.push(remaining);
      }
      orderedList = newList;
    } else if (targetPlayer && direction) {
      const currentIndex = orderedList.findIndex(p => String(p._id) === String(targetPlayer._id));
      if (currentIndex !== -1) {
        if (direction === 'up' && currentIndex > 0) {
          const temp = orderedList[currentIndex];
          orderedList[currentIndex] = orderedList[currentIndex - 1];
          orderedList[currentIndex - 1] = temp;
        } else if (direction === 'down' && currentIndex < orderedList.length - 1) {
          const temp = orderedList[currentIndex];
          orderedList[currentIndex] = orderedList[currentIndex + 1];
          orderedList[currentIndex + 1] = temp;
        }
      }
    } else if (targetPlayer && newOrder !== undefined) {
      const targetPos = Math.max(1, Math.min(Number(newOrder) || 1, orderedList.length));
      const currentIndex = orderedList.findIndex(p => String(p._id) === String(targetPlayer._id));
      if (currentIndex !== -1) {
        const [removed] = orderedList.splice(currentIndex, 1);
        orderedList.splice(targetPos - 1, 0, removed);
      }
    }

    // Persist normalized orderInRound (1..N) to eliminate duplicates or gaps
    const bulkOps = orderedList.map((player, idx) => ({
      updateOne: {
        filter: { _id: player._id },
        update: { $set: { orderInRound: idx + 1 } }
      }
    }));

    if (bulkOps.length > 0) {
      await Player.bulkWrite(bulkOps);
    }

    // Fetch the updated players to return
    const updatedPlayers = await Player.find({ roundId: targetRoundId })
      .populate('roundId', 'name order')
      .populate('soldToTeam', 'name code color logo')
      .sort({ orderInRound: 1, createdAt: 1 });

    // Broadcast state update so all screens (Projector, Admin Panel) reflect any stats / ordering changes safely
    await broadcastStateUpdate();

    emitEvent('PLAYERS_REORDERED', {
      roundId: targetRoundId,
      players: updatedPlayers
    });

    res.json({ success: true, message: 'Player sequence updated successfully.', players: updatedPlayers });
  } catch (error) {
    console.error('Error reordering players:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};


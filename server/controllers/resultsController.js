const Team = require('../models/Team');
const Player = require('../models/Player');
const Round = require('../models/Round');
const Transaction = require('../models/Transaction');

exports.getAuctionSummary = async (req, res) => {
  try {
    const teams = await Team.find().sort({ name: 1 });
    const rounds = await Round.find().sort({ order: 1 });
    const allPlayers = await Player.find().populate('roundId').populate('soldToTeam').sort({ soldPrice: -1 });

    const soldPlayers = allPlayers.filter((p) => p.status === 'sold');
    const unsoldPlayers = allPlayers.filter((p) => p.status === 'unsold');
    const upcomingPlayers = allPlayers.filter((p) => p.status === 'upcoming');

    // Highest priced player
    const highestPricedPlayer = soldPlayers.length > 0 ? soldPlayers[0] : null;

    // Team-wise squads and stats
    const teamSquads = teams.map((team) => {
      const players = soldPlayers.filter(
        (p) => p.soldToTeam && String(p.soldToTeam._id) === String(team._id)
      );
      return {
        _id: team._id,
        name: team.name,
        code: team.code,
        logo: team.logo,
        color: team.color,
        captain: team.captain,
        startingPurse: team.startingPurse,
        totalSpent: team.totalSpent,
        remainingPurse: team.remainingPurse,
        team: {
          _id: team._id,
          name: team.name,
          code: team.code,
          logo: team.logo,
          color: team.color,
          captain: team.captain,
          startingPurse: team.startingPurse,
          totalSpent: team.totalSpent,
          remainingPurse: team.remainingPurse
        },
        squadSize: players.length,
        players
      };
    });

    // Round-wise results
    const roundResults = rounds.map((round) => {
      const roundPlayers = allPlayers.filter(
        (p) => p.roundId && String(p.roundId._id) === String(round._id)
      );
      return {
        round: {
          _id: round._id,
          name: round.name,
          order: round.order
        },
        total: roundPlayers.length,
        sold: roundPlayers.filter((p) => p.status === 'sold').length,
        unsold: roundPlayers.filter((p) => p.status === 'unsold').length,
        upcoming: roundPlayers.filter((p) => p.status === 'upcoming').length,
        players: roundPlayers
      };
    });

    // Total auction turnover
    const totalSpentOverall = soldPlayers.reduce((sum, p) => sum + (p.soldPrice || 0), 0);

    res.json({
      success: true,
      summary: {
        totalPlayersCount: allPlayers.length,
        soldCount: soldPlayers.length,
        unsoldCount: unsoldPlayers.length,
        upcomingCount: upcomingPlayers.length,
        totalSpentOverall,
        highestPricedPlayer,
        teamSquads,
        roundResults,
        soldPlayers,
        unsoldPlayers
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Export CSV of auction results
exports.exportCSV = async (req, res) => {
  try {
    const players = await Player.find()
      .populate('roundId', 'name')
      .populate('soldToTeam', 'name code')
      .sort({ status: 1, soldPrice: -1 });

    const rows = [
      ['Player Name', 'Category', 'Base Price (INR)', 'Status', 'Sold To Team', 'Final Price (INR)', 'Round', 'Batting', 'Bowling']
    ];

    players.forEach((p) => {
      rows.push([
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.category || ''}"`,
        p.basePrice || 0,
        p.status,
        `"${p.soldToTeam ? p.soldToTeam.name : 'N/A'}"`,
        p.soldPrice || 0,
        `"${p.roundId ? p.roundId.name : 'Unassigned'}"`,
        `"${p.battingStyle || ''}"`,
        `"${p.bowlingStyle || ''}"`
      ]);
    });

    const csvContent = rows.map((r) => r.join(',')).join('\r\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="HFPL_Auction_Results.csv"');
    res.status(200).send(csvContent);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

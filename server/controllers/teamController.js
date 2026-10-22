const Team = require('../models/Team');
const Player = require('../models/Player');
const Transaction = require('../models/Transaction');

// Recalculates team purse strictly from confirmed transactions/players
const recalculateTeamPurse = async (teamId, session = null) => {
  const query = Team.findById(teamId);
  if (session) query.session(session);
  const team = await query;
  if (!team) return null;

  // Calculate total spent from sold players assigned to this team
  const playerQuery = Player.find({ soldToTeam: teamId, status: 'sold' });
  if (session) playerQuery.session(session);
  const players = await playerQuery;
  const totalSpent = players.reduce((sum, p) => sum + (p.soldPrice || 0), 0);
  const remainingPurse = Math.max(0, team.startingPurse - totalSpent);

  team.totalSpent = totalSpent;
  team.remainingPurse = remainingPurse;
  await team.save(session ? { session } : {});

  return team;
};

exports.recalculateTeamPurse = recalculateTeamPurse;

exports.getAllTeams = async (req, res) => {
  try {
    const teams = await Team.find().sort({ name: 1 });
    // Fetch players for each team
    const teamsWithSquads = await Promise.all(
      teams.map(async (team) => {
        const squad = await Player.find({ soldToTeam: team._id, status: 'sold' }).sort({ soldPrice: -1 });
        const obj = team.toObject();
        if (/sheslekar/i.test(obj.captain)) {
          obj.captain = 'Shrirang Sherlekar';
        }
        return {
          ...obj,
          squad,
          squadCount: squad.length
        };
      })
    );
    res.json({ success: true, teams: teamsWithSquads });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getTeamById = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });
    const squad = await Player.find({ soldToTeam: team._id, status: 'sold' }).sort({ soldAt: 1, createdAt: 1, _id: 1 });
    const teamObj = team.toObject();
    if (/sheslekar/i.test(teamObj.captain)) {
      teamObj.captain = 'Shrirang Sherlekar';
    }
    res.json({ success: true, team: { ...teamObj, squad } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createTeam = async (req, res) => {
  try {
    const { name, code, logo, color, secondaryColor, captain, startingPurse } = req.body;
    if (!name || !code) {
      return res.status(400).json({ success: false, message: 'Team name and code are required.' });
    }

    const purse = startingPurse !== undefined ? Number(startingPurse) : 10000;
    const team = new Team({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      logo: logo || '',
      color: color || '#f59e0b',
      secondaryColor: secondaryColor || '#0f172a',
      captain: captain ? captain.trim() : '',
      startingPurse: purse,
      totalSpent: 0,
      remainingPurse: purse
    });

    await team.save();
    res.status(201).json({ success: true, team });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Team name already exists.' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateTeam = async (req, res) => {
  try {
    const { name, code, logo, color, secondaryColor, captain, startingPurse } = req.body;
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });

    if (name) team.name = name.trim();
    if (code) team.code = code.trim().toUpperCase();
    if (logo !== undefined) team.logo = logo;
    if (color) team.color = color;
    if (secondaryColor) team.secondaryColor = secondaryColor;
    if (captain !== undefined) team.captain = captain.trim();

    if (startingPurse !== undefined) {
      const newStarting = Number(startingPurse);
      if (newStarting < team.totalSpent) {
        return res.status(400).json({
          success: false,
          message: `Cannot set starting purse lower than already spent amount (₹${team.totalSpent}).`
        });
      }
      team.startingPurse = newStarting;
      team.remainingPurse = newStarting - team.totalSpent;
    }

    await team.save();
    res.json({ success: true, team });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteTeam = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ success: false, message: 'Team not found' });

    const ownedPlayers = await Player.countDocuments({ soldToTeam: team._id, status: 'sold' });
    if (ownedPlayers > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete team with ${ownedPlayers} purchased players. Revert sales first.`
      });
    }

    await Team.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Team deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

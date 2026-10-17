const Round = require('../models/Round');
const Player = require('../models/Player');

exports.getAllRounds = async (req, res) => {
  try {
    const rounds = await Round.find().sort({ order: 1 });
    const roundsWithStats = await Promise.all(
      rounds.map(async (round) => {
        const totalPlayers = await Player.countDocuments({ roundId: round._id });
        const soldPlayers = await Player.countDocuments({ roundId: round._id, status: 'sold' });
        const unsoldPlayers = await Player.countDocuments({ roundId: round._id, status: 'unsold' });
        const upcomingPlayers = await Player.countDocuments({ roundId: round._id, status: 'upcoming' });
        return {
          ...round.toObject(),
          totalPlayers,
          soldPlayers,
          unsoldPlayers,
          upcomingPlayers
        };
      })
    );
    res.json({ success: true, rounds: roundsWithStats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createRound = async (req, res) => {
  try {
    const { name, description, order } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Round name is required' });

    const maxOrderDoc = await Round.findOne().sort({ order: -1 });
    const roundOrder = order !== undefined ? Number(order) : (maxOrderDoc ? maxOrderDoc.order + 1 : 1);

    const round = new Round({
      name: name.trim(),
      description: description || '',
      order: roundOrder
    });

    await round.save();
    res.status(201).json({ success: true, round });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateRound = async (req, res) => {
  try {
    const { name, description, order, status } = req.body;
    const round = await Round.findById(req.params.id);
    if (!round) return res.status(404).json({ success: false, message: 'Round not found' });

    if (name) round.name = name.trim();
    if (description !== undefined) round.description = description;
    if (order !== undefined) round.order = Number(order);
    if (status) round.status = status;

    await round.save();
    res.json({ success: true, round });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteRound = async (req, res) => {
  try {
    const round = await Round.findById(req.params.id);
    if (!round) return res.status(404).json({ success: false, message: 'Round not found' });

    // Unassign players from this round
    await Player.updateMany({ roundId: round._id }, { $set: { roundId: null } });
    await Round.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Round deleted and players unassigned.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    trim: true,
    default: 'All-rounder' // Batter, Bowler, All-rounder, Wicketkeeper, or custom
  },
  battingStyle: {
    type: String,
    default: 'Right Hand Bat'
  },
  bowlingStyle: {
    type: String,
    default: 'Right Arm Medium'
  },
  photo: {
    type: String,
    default: ''
  },
  basePrice: {
    type: Number,
    required: true,
    default: 200,
    min: 0
  },
  description: {
    type: String,
    default: ''
  },
  stats: {
    matches: { type: Number, default: 0 },
    runs: { type: Number, default: 0 },
    wickets: { type: Number, default: 0 },
    highestScore: { type: Number, default: 0 },
    strikeRate: { type: Number, default: 0 }
  },
  roundId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Round',
    default: null
  },
  orderInRound: {
    type: Number,
    default: 1
  },
  status: {
    type: String,
    enum: ['upcoming', 'active', 'sold', 'unsold'],
    default: 'upcoming'
  },
  soldToTeam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    default: null
  },
  soldPrice: {
    type: Number,
    default: 0
  },
  soldRound: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Round',
    default: null
  },
  soldAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('Player', playerSchema);

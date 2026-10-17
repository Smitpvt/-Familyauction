const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema({
  player: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player',
    required: true
  },
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true
  },
  round: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Round'
  },
  amount: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('Bid', bidSchema);

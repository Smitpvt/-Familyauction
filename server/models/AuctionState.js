const mongoose = require('mongoose');

const auctionStateSchema = new mongoose.Schema({
  currentRound: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Round',
    default: null
  },
  currentPlayer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player',
    default: null
  },
  currentBid: {
    type: Number,
    default: 0
  },
  highestBidder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    default: null
  },
  status: {
    type: String,
    enum: ['idle', 'ready', 'bidding', 'paused', 'sold', 'unsold', 'round_completed', 'completed'],
    default: 'idle'
  },
  bidIncrementOptions: {
    type: [Number],
    default: [100, 200, 500, 1000]
  },
  selectedIncrement: {
    type: Number,
    default: 100
  },
  bidHistory: [{
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team'
    },
    amount: Number,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  lastSoldDetails: {
    player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    amount: Number,
    timestamp: Date
  },
  lastUnsoldPlayer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Player',
    default: null
  },
  announcement: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('AuctionState', auctionStateSchema);

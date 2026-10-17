const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
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
  type: {
    type: String,
    enum: ['PURCHASE', 'REVERSAL'],
    default: 'PURCHASE'
  },
  notes: {
    type: String,
    default: ''
  },
  reversalOf: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);

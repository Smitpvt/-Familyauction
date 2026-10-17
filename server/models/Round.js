const mongoose = require('mongoose');

const roundSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  order: {
    type: Number,
    required: true,
    default: 1
  },
  description: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['upcoming', 'active', 'completed'],
    default: 'upcoming'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for player count in this round
roundSchema.virtual('playerCount', {
  ref: 'Player',
  localField: '_id',
  foreignField: 'roundId',
  count: true
});

module.exports = mongoose.model('Round', roundSchema);

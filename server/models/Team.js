const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  code: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    maxlength: 5
  },
  logo: {
    type: String,
    default: ''
  },
  color: {
    type: String,
    default: '#f59e0b' // Primary brand color
  },
  secondaryColor: {
    type: String,
    default: '#0f172a'
  },
  captain: {
    type: String,
    trim: true,
    default: ''
  },
  startingPurse: {
    type: Number,
    required: true,
    default: 10000,
    min: 0
  },
  totalSpent: {
    type: Number,
    default: 0,
    min: 0
  },
  remainingPurse: {
    type: Number,
    default: 10000,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for purchased players count
teamSchema.virtual('playersCount', {
  ref: 'Player',
  localField: '_id',
  foreignField: 'soldToTeam',
  count: true
});

module.exports = mongoose.model('Team', teamSchema);

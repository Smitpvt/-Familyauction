const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    default: 'HFPL Auctioneer'
  },
  role: {
    type: String,
    default: 'admin'
  }
}, { timestamps: true });

module.exports = mongoose.model('Admin', adminSchema);

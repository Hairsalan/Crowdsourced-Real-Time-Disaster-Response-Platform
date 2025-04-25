const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['user', 'ngo', 'moderator', 'admin'],
    default: 'user'
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],  // [longitude, latitude]
      default: undefined
    }
  },
  radiusMiles: {
    type: Number,
    default: 50,
    min: 1,
    max: 200
  },
  dateJoined: {
    type: Date,
    default: Date.now
  },
  banned: { 
    type: Boolean, 
    default: false 
  },
  banExpires: { 
    type: Date, 
    default: null 
  }
});

// Add 2dsphere index for geospatial queries
UserSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('User', UserSchema);
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PostSchema = new Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['fire', 'flood', 'earthquake', 'hurricane', 'tornado', 'other'],
    required: true
  },
  location: {
    latitude: Number,
    longitude: Number,
    displayName: String
  },
  author: {
    type: String,
    required: true
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  upvotes: {
    type: Number,
    default: 0
  },
  downvotes: {
    type: Number,
    default: 0
  },
  comments: [{
    text: String,
    author: String,
    authorId: mongoose.Schema.Types.ObjectId,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
});

module.exports = mongoose.model('Post', PostSchema);
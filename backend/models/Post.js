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
    enum: ['fire', 'flood', 'earthquake', 'hurricane', 'tornado', 'other', 'news'],
    required: true
  },
  // Image path for post attachments
  imagePath: {
    type: String
  },
  // External ID for news items
  externalId: {
    type: String,
    index: true
  },
  // Source for news items
  source: String,
  // Category for news items
  category: String,
  // Link for news items
  link: String,
  // Published date for news items
  publishedAt: Date,
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: undefined
    },
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
  votes: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    voteType: { type: String, enum: ['upvote', 'downvote'] }
  }],
  comments: [{
    text: String,
    author: String,
    authorId: mongoose.Schema.Types.ObjectId,
    createdAt: {
      type: Date,
      default: Date.now
    },
    isPinned: {
      type: Boolean,
      default: false
    },
    imagePath: {
      type: String
    }
  }]
});

// Add 2dsphere index for geospatial queries
PostSchema.index({ "location": "2dsphere" });

module.exports = mongoose.model('Post', PostSchema);
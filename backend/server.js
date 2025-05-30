const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Import models
const User = require('./models/User');
const Post = require('./models/Post');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/disaster_app';

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('MongoDB connected successfully');
  
  // Ensure the geospatial index exists
  Post.collection.createIndex({ "location.coordinates": "2dsphere" })
    .then(() => console.log("Geospatial index created successfully"))
    .catch(err => console.error("Error creating geospatial index:", err));
})
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// Additional connection debugging
mongoose.connection.on('connected', () => {
  console.log('Mongoose connected to:', MONGODB_URI);
});
mongoose.connection.on('error', (err) => {
  console.log('Mongoose connection error: ' + err);
});
mongoose.connection.on('disconnected', () => {
  console.log('Mongoose disconnected');
});

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ message: 'Authentication required' });
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// Middleware to check user role
const checkRole = (roles) => {
  return (req, res, next) => {
    // authenticateToken middleware should be used before this middleware
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    if (roles.includes(req.user.role)) {
      next();
    } else {
      res.status(403).json({ message: 'Insufficient permissions' });
    }
  };
};

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Add multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Create a unique filename with original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExt = path.extname(file.originalname);
    cb(null, uniqueSuffix + fileExt);
  }
});

// File filter to allow only images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Create multer upload instance
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

// Serve static files from the uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Auth Routes
app.post('/api/signup', async (req, res) => {
  try {
    console.log('Signup request received:', req.body);
    const { username, email, password, role } = req.body;
    
    // Check if user already exists
    let existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    // Check if username is taken
    existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already taken' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Validate role (default to 'user' if invalid)
    const validRoles = ['user', 'ngo', 'moderator', 'admin'];
    const userRole = validRoles.includes(role) ? role : 'user';
    
// Create new user
const user = new User({
  username,
  email,
  password: hashedPassword,
  role: userRole,
  // Special "no location" coordinates (0,0 is in the Atlantic Ocean)
  location: {
    type: 'Point',
    coordinates: [0, 0],
    displayName: 'No Location Set'
  }
});
    
    console.log('Saving user to MongoDB...');
    const savedUser = await user.save();
    console.log('User saved successfully:', savedUser._id);
    
    // Create token
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        email: user.email,
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        // Include user's location if available
        location: user.location ? {
          latitude: user.location.coordinates[1],
          longitude: user.location.coordinates[0],
          displayName: user.location.displayName || `${user.location.coordinates[1]}, ${user.location.coordinates[0]}`
        } : null,
        radiusMiles: user.radiusMiles || 50
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    console.log('Login request received:', req.body.email);
    const { email, password } = req.body;
    
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    // Check if user is banned
    if (user.banned) {
      const now = new Date();
      if (!user.banExpires || user.banExpires > now) {
        const banMessage = user.banExpires
          ? `Your account has been banned until ${user.banExpires.toISOString()}.`
          : 'Your account has been permanently banned.';
        return res.status(403).json({ 
          message: banMessage,
          banned: true,
          banExpires: user.banExpires
        });
      } else {
        // Ban has expired, automatically remove it
        user.banned = false;
        user.banExpires = null;
        await user.save();
      }
    }
    
    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    console.log('User logged in successfully:', user._id);
    
    // Create token
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        email: user.email,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        banned: user.banned,
        banExpires: user.banExpires,
        // Include user's saved location if available and not [0,0]
        location: (user.location && 
                   user.location.coordinates && 
                   user.location.coordinates.length === 2 &&
                   (user.location.coordinates[0] !== 0 || user.location.coordinates[1] !== 0)) ? {
          latitude: user.location.coordinates[1],
          longitude: user.location.coordinates[0],
          displayName: user.location.displayName || `${user.location.coordinates[1]}, ${user.location.coordinates[0]}`
        } : null,
        radiusMiles: user.radiusMiles || 50
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get posts in user's radius
app.get('/api/posts', async (req, res) => {
  try {
    // Parse query parameters
    const radius = Number(req.query.radius) || 50; // Default to 50 miles
    let lat = req.query.lat ? Number(req.query.lat) : null;
    let lng = req.query.lng ? Number(req.query.lng) : null;
    const type = req.query.type; // Filter by post type (news, fire, etc.)
    const user = req.user; // This will be null if no token or undefined if token is bad
    
    // Build query object
    const query = {};
    
    // Add type filter if provided
    if (type) {
      if (type.startsWith('!')) {
        // Handle exclusion format: !news means exclude news posts
        const excludeType = type.substring(1);
        query.type = { $ne: excludeType };
        console.log(`Excluding posts with type: ${excludeType}`);
      } else {
        // Standard case: exact match
        query.type = type;
      }
    }
    
    // Add externalId filter if provided
    if (req.query.externalId) {
      query.externalId = req.query.externalId;
    }
    
    // Get posts from database
    let posts = [];
    
    // Get posts with or without location filtering
    if (!lat || !lng) {
      posts = await Post.find(query)
                       .sort({ createdAt: -1 })
                       .limit(100);
      console.log(`Retrieved ${posts.length} posts without location filtering. Type filter: ${type || 'none'}`);
    } else {
      // Add location filter to query
      query['location.coordinates'] = {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [lng, lat]
            },
            $maxDistance: radius * 1609.34 // Convert miles to meters
          }
      };
      
      posts = await Post.find(query)
                     .sort({ createdAt: -1 })
        .limit(100);
      console.log(`Retrieved ${posts.length} posts within ${radius} miles of [${lat}, ${lng}]. Type filter: ${type || 'none'}`);
    }
    
    // Get all unique author IDs from the posts and comments
    const authorIds = new Set();
    posts.forEach(post => {
      authorIds.add(post.authorId.toString());
      post.comments.forEach(comment => {
        if (comment.authorId) {
          authorIds.add(comment.authorId.toString());
        }
      });
    });
    
    // Fetch user roles for all authors
    const users = await User.find({
      _id: { $in: Array.from(authorIds) }
    }).select('_id role');
    
    // Create a mapping of user ID to role
    const userRoles = {};
    users.forEach(user => {
      userRoles[user._id.toString()] = user.role;
    });
    
    // Prepare posts with user roles data
    const postsWithRoles = posts.map(post => {
      const postObj = post.toObject();
      postObj.userRoles = userRoles;
      return postObj;
    });
    
    res.json(postsWithRoles);
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create new post with GeoJSON location and image upload
app.post('/api/posts', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    console.log('Creating new post with data:', req.body);
    const { title, description, type } = req.body;
    let location = null;
    
    // Check if location is provided as a JSON string
    if (req.body.location) {
      try {
        location = JSON.parse(req.body.location);
      } catch (e) {
        console.error('Failed to parse location data:', e);
      }
    }
    
    // Create post object
    const postData = {
      title,
      description,
      type,
      author: req.user.username,
      authorId: req.user.id
    };
    
    // Add image path if file was uploaded
    if (req.file) {
      postData.imagePath = '/uploads/' + req.file.filename;
    }
    
    // Add external data fields for news items
    if (req.body.externalId) postData.externalId = req.body.externalId;
    if (req.body.source) postData.source = req.body.source;
    if (req.body.category) postData.category = req.body.category;
    if (req.body.link) postData.link = req.body.link;
    if (req.body.publishedAt) postData.publishedAt = new Date(req.body.publishedAt);
    
    // Add location data in GeoJSON format if provided
    if (location && location.latitude !== undefined && location.longitude !== undefined) {
      postData.location = {
        type: 'Point',
        coordinates: [location.longitude, location.latitude], // MongoDB uses [longitude, latitude] order
        displayName: location.displayName || `${location.latitude}, ${location.longitude}`
      };
    } else if (location && location.coordinates && location.coordinates.length === 2) {
      // Handle already-formatted GeoJSON coordinates
      postData.location = {
        type: 'Point',
        coordinates: location.coordinates,
        displayName: location.displayName || `${location.coordinates[1]}, ${location.coordinates[0]}`
      };
    }
    
    console.log('Saving post with data:', postData);
    const newPost = new Post(postData);
    const post = await newPost.save();
    
    console.log('Post saved successfully:', post._id);
    res.status(201).json(post);
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Route to update user location
app.put('/api/users/me/location', authenticateToken, async (req, res) => {
  try {
    console.log('Updating user location:', req.user.id);
    const { latitude, longitude, radiusMiles } = req.body;
    
    // Validate inputs
    if (!latitude || !longitude) {
      return res.status(400).json({ message: 'Latitude and longitude are required' });
    }
    
    // Parse as numbers and validate
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const radius = radiusMiles ? parseInt(radiusMiles, 10) : undefined;
    
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ message: 'Invalid coordinates' });
    }
    
    if (radius !== undefined && (isNaN(radius) || radius < 1 || radius > 200)) {
      return res.status(400).json({ message: 'Radius must be between 1 and 200 miles' });
    }
    
    // Update user location
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Update coordinates (MongoDB uses [longitude, latitude] order)
    user.location = {
      type: 'Point',
      coordinates: [lng, lat]
    };
    
    // Update radius if provided
    if (radius !== undefined) {
      user.radiusMiles = radius;
    }
    
    await user.save();
    console.log('User location updated successfully for:', user.username);
    
    // Return updated user info without sensitive data
    res.json({
      message: 'Location updated successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        location: {
          latitude: lat,
          longitude: lng
        },
        radiusMiles: user.radiusMiles
      }
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get current user profile
app.get('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      // Include user's saved location if available and not [0,0]
      location: (user.location && 
                 user.location.coordinates && 
                 user.location.coordinates.length === 2 &&
                 (user.location.coordinates[0] !== 0 || user.location.coordinates[1] !== 0)) ? {
        latitude: user.location.coordinates[1],
        longitude: user.location.coordinates[0],
        displayName: user.location.displayName || `${user.location.coordinates[1]}, ${user.location.coordinates[0]}`
      } : null,
      radiusMiles: user.radiusMiles || 50
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Upvote/Downvote routes
app.post('/api/posts/:id/upvote', authenticateToken, async (req, res) => {
  try {
    console.log(`Upvoting post: ${req.params.id}`);
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const userId = req.user.id;
    const existingVote = post.votes.find(v => v.userId.toString() === userId);

    if (existingVote) {
      if (existingVote.voteType === 'upvote') {
        // User already upvoted, do nothing
        return res.status(400).json({ message: 'You have already upvoted this post.' });
      } else {
        // Change downvote to upvote
        existingVote.voteType = 'upvote';
      }
    } else {
      // Add new upvote
      post.votes.push({ userId, voteType: 'upvote' });
    }

    // Recalculate upvotes and downvotes
    post.upvotes = post.votes.filter(v => v.voteType === 'upvote').length;
    post.downvotes = post.votes.filter(v => v.voteType === 'downvote').length;
    await post.save();

    res.json(post);
  } catch (error) {
    console.error('Upvote error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.post('/api/posts/:id/downvote', authenticateToken, async (req, res) => {
  try {
    console.log(`Downvoting post: ${req.params.id}`);
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const userId = req.user.id;
    const existingVote = post.votes.find(v => v.userId.toString() === userId);

    if (existingVote) {
      if (existingVote.voteType === 'downvote') {
        // User already downvoted, do nothing
        return res.status(400).json({ message: 'You have already downvoted this post.' });
      } else {
        // Change upvote to downvote
        existingVote.voteType = 'downvote';
      }
    } else {
      // Add new downvote
      post.votes.push({ userId, voteType: 'downvote' });
    }

    // Recalculate upvotes and downvotes
    post.upvotes = post.votes.filter(v => v.voteType === 'upvote').length;
    post.downvotes = post.votes.filter(v => v.voteType === 'downvote').length;
    await post.save();

    res.json(post);
  } catch (error) {
    console.error('Downvote error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add comment to post with image upload
app.post('/api/posts/:id/comment', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    console.log(`Adding comment to post: ${req.params.id}`);
    
    // First, validate that the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.error(`Invalid post ID format: ${req.params.id}`);
      return res.status(400).json({ message: 'Invalid post ID format' });
    }
    
    const post = await Post.findById(req.params.id);
    if (!post) {
      console.error(`Post not found with ID: ${req.params.id}`);
      return res.status(404).json({ message: 'Post not found' });
    }

    const { text } = req.body;
    const isPinned = req.body.isPinned === 'true'; // Convert string to boolean
    
    // Validate that at least text or image is provided
    if ((!text || text.trim() === '') && !req.file) {
      return res.status(400).json({ message: 'Comment must contain text or an image' });
    }

    // Only allow NGO users to pin comments
    const canPinComment = req.user.role === 'ngo';
    const shouldPinComment = isPinned && canPinComment;

    // Create new comment object
    const newComment = {
      text: text ? text.trim() : '',
      author: req.user.username,
      authorId: req.user.id,
      createdAt: new Date(),
      isPinned: shouldPinComment
    };
    
    // Add image path if file was uploaded
    if (req.file) {
      newComment.imagePath = '/uploads/' + req.file.filename;
    }

    // Add comment to post
    post.comments.push(newComment);
    await post.save();

    // Get all unique author IDs from the post and comments
    const authorIds = new Set();
    authorIds.add(post.authorId.toString());
    post.comments.forEach(comment => {
      if (comment.authorId) {
        authorIds.add(comment.authorId.toString());
      }
    });
    
    // Fetch user roles for all authors
    const users = await User.find({
      _id: { $in: Array.from(authorIds) }
    }).select('_id role');
    
    // Create a mapping of user ID to role
    const userRoles = {};
    users.forEach(user => {
      userRoles[user._id.toString()] = user.role;
    });
    
    // Add user roles to post response
    const postObj = post.toObject();
    postObj.userRoles = userRoles;

    res.status(201).json(postObj);
  } catch (error) {
    console.error('Comment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Admin-only routes
app.get('/api/admin/users', authenticateToken, checkRole(['admin']), async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Admin and moderator routes
app.delete('/api/posts/:id', authenticateToken, checkRole(['admin', 'moderator']), async (req, res) => {
  try {
    const post = await Post.findByIdAndDelete(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// NGO and admin routes
app.post('/api/official-reports', authenticateToken, checkRole(['admin', 'ngo']), async (req, res) => {
  try {
    // Handle official reports (only available to NGOs and admins)
    res.status(201).json({ message: 'Official report created' });
  } catch (error) {
    console.error('Official report error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Data migration route (optional)
app.get('/api/migrate', async (req, res) => {
  try {
    console.log('Starting data migration...');
    const fs = require('fs');
    const path = require('path');
    
    // Paths to JSON files
    const DATA_DIR = path.join(__dirname, 'data');
    const USERS_FILE = path.join(DATA_DIR, 'users.json');
    const POSTS_FILE = path.join(DATA_DIR, 'posts.json');
    
    let usersCount = 0;
    let postsCount = 0;
    
    // Migrate users
if (fs.existsSync(USERS_FILE)) {
  const userData = fs.readFileSync(USERS_FILE, 'utf8');
  const users = JSON.parse(userData);
  
  for (const user of users) {
    const existingUser = await User.findOne({ email: user.email });
    if (!existingUser) {
      // Create a default location with coordinates if none exists
      let locationData = {
        type: 'Point',
        coordinates: [-122.0076, 37.3541] // Default coordinates (Santa Clara area)
      };
      
      // Use location from the JSON if it exists and has correct format
      if (user.location && 
          user.location.type === 'Point' && 
          Array.isArray(user.location.coordinates) && 
          user.location.coordinates.length === 2) {
        locationData = user.location;
      }
      
      await new User({
        username: user.username,
        email: user.email,
        password: user.password, // Already hashed
        role: user.role || 'user', // Default to 'user' if no role
        location: locationData, // Use the properly formatted location
        radiusMiles: user.radiusMiles || 50,
        dateJoined: user.dateJoined
      }).save();
      usersCount++;
      console.log(`Migrated user: ${user.username}`);
    }
  }
}
    
    // Migrate posts
if (fs.existsSync(POSTS_FILE)) {
  const postsData = fs.readFileSync(POSTS_FILE, 'utf8');
  const posts = JSON.parse(postsData);
  
  for (const post of posts) {
    const existingPost = await Post.findOne({ title: post.title, author: post.author });
    if (!existingPost) {
      // Find the user by their username
      const user = await User.findOne({ username: post.author });
      
      if (user) {
        // Handle different location formats properly
        let locationData = null;
        
        if (post.location) {
          // Case 1: Post has proper GeoJSON format
          if (post.location.type === 'Point' && 
              Array.isArray(post.location.coordinates) && 
              post.location.coordinates.length === 2) {
            
            locationData = {
              type: 'Point',
              coordinates: post.location.coordinates, // [longitude, latitude]
              displayName: post.location.displayName || 
                `${post.location.coordinates[1]}, ${post.location.coordinates[0]}`
            };
            console.log(`GeoJSON location found for post: ${post.title}`);
          }
          // Case 2: Post has old format with lat/lng
          else if (post.location.latitude !== undefined && post.location.longitude !== undefined) {
            locationData = {
              type: 'Point',
              coordinates: [post.location.longitude, post.location.latitude],
              displayName: post.location.displayName || 
                `${post.location.latitude}, ${post.location.longitude}`
            };
            console.log(`Converting old lat/lng format for post: ${post.title}`);
          }
          // Case 3: Post has string location
          else if (typeof post.location === 'string') {
            // Skip posts with only string locations, or optionally:
            /*
            locationData = {
              type: 'Point',
              coordinates: [0, 0], // Default coordinates
              displayName: post.location
            };
            console.log(`Using string location for post: ${post.title}`);
            */
            console.log(`Skipping post with string-only location: ${post.title}`);
            continue; // Skip this post
          }
        }
        
        if (!locationData) {
          console.log(`No valid location data for post: ${post.title}`);
        }
        
        await new Post({
          title: post.title,
          location: locationData,
          description: post.description,
          type: post.type || 'other', // Fallback if type is missing
          author: post.author,
          authorId: user._id,
          createdAt: post.createdAt || new Date(),
          upvotes: post.upvotes || 0,
          downvotes: post.downvotes || 0,
          comments: post.comments || []
        }).save();
        postsCount++;
        console.log(`Migrated post: ${post.title}`);
      } else {
        console.log(`Skipping post, user not found: ${post.author}`);
      }
    } else {
      console.log(`Post already exists: ${post.title}`);
    }
  }
}
    
    console.log(`Migration complete: ${usersCount} users and ${postsCount} posts migrated`);
    res.json({ 
      message: 'Data migration complete',
      stats: {
        users: usersCount,
        posts: postsCount
      }
    });
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ message: 'Migration error', error: error.message });
  }
});

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working', mongoConnected: mongoose.connection.readyState === 1 });
});

// Testing route to directly compute distances
app.get('/api/test-distance', async (req, res) => {
  try {
    const { lat1, lng1, lat2, lng2 } = req.query;
    
    if (!lat1 || !lng1 || !lat2 || !lng2) {
      return res.status(400).json({ message: 'All coordinates are required' });
    }
    
    // Parse coordinates
    const latitude1 = parseFloat(lat1);
    const longitude1 = parseFloat(lng1);
    const latitude2 = parseFloat(lat2);
    const longitude2 = parseFloat(lng2);
    
    if (isNaN(latitude1) || isNaN(longitude1) || isNaN(latitude2) || isNaN(longitude2)) {
      return res.status(400).json({ message: 'Invalid coordinates' });
    }
    
    // Calculate distance using Haversine formula
    const R = 6371; // Earth's radius in km
    const dLat = (latitude2 - latitude1) * Math.PI / 180;
    const dLon = (longitude2 - longitude1) * Math.PI / 180;
    const lat1Rad = latitude1 * Math.PI / 180;
    const lat2Rad = latitude2 * Math.PI / 180;
    
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1Rad) * Math.cos(lat2Rad) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distanceKm = R * c;
    const distanceMiles = distanceKm * 0.621371;
    
    // Get all posts to calculate their distances
    const posts = await Post.find();
    const postsWithDistances = posts
      .filter(post => post.location && post.location.coordinates && post.location.coordinates.length === 2)
      .map(post => {
        const postLng = post.location.coordinates[0];
        const postLat = post.location.coordinates[1];
        
        // Calculate distance to this post
        const dLatPost = (postLat - latitude1) * Math.PI / 180;
        const dLonPost = (postLng - longitude1) * Math.PI / 180;
        const lat1RadPost = latitude1 * Math.PI / 180;
        const lat2RadPost = postLat * Math.PI / 180;
        
        const aPost = 
          Math.sin(dLatPost/2) * Math.sin(dLatPost/2) +
          Math.cos(lat1RadPost) * Math.cos(lat2RadPost) * 
          Math.sin(dLonPost/2) * Math.sin(dLonPost/2);
        const cPost = 2 * Math.atan2(Math.sqrt(aPost), Math.sqrt(1-aPost));
        const distanceKmPost = R * cPost;
        const distanceMilesPost = distanceKmPost * 0.621371;
        
        return {
          title: post.title,
          coordinates: [postLat, postLng],
          distanceMiles: distanceMilesPost,
          location: post.location.displayName
        };
      });
    
    res.json({
      distance: {
        kilometers: distanceKm,
        miles: distanceMiles
      },
      posts: postsWithDistances.sort((a, b) => a.distanceMiles - b.distanceMiles)
    });
  } catch (error) {
    console.error('Distance calculation error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get paginated users (for admins and moderators)
app.get('/api/users', authenticateToken, checkRole(['admin', 'moderator']), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Count total users for pagination
    const total = await User.countDocuments();

    // Get users with pagination
    const users = await User.find()
      .select('-password') // Exclude password field
      .skip(skip)
      .limit(limit);

    res.json({
      users: users.map(user => ({
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role || 'user',
        banned: user.banned || false,
        banExpires: user.banExpires || null
      })),
      total
    });
  } catch (error) {
    console.error('Get paginated users error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Ban a user
app.post('/api/users/:id/ban', authenticateToken, checkRole(['admin', 'moderator']), async (req, res) => {
  try {
    const { duration } = req.body;
    if (!duration) {
      return res.status(400).json({ message: 'Ban duration is required' });
    }

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Role-based restrictions
    if (targetUser.role === 'admin') {
      return res.status(403).json({ message: 'You cannot ban an admin' });
    }

    if (targetUser.role === 'moderator' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Moderators cannot ban other moderators' });
    }

    // Prevent self-banning
    if (req.user.id === req.params.id) {
      return res.status(403).json({ message: 'You cannot ban yourself' });
    }

    // Calculate ban expiration date
    let banExpires = null;
    if (duration !== 'permanent') {
      const durationValue = parseInt(duration);
      const durationUnit = duration.slice(-1);
      banExpires = new Date();

      if (durationUnit === 'd') {
        banExpires.setDate(banExpires.getDate() + durationValue);
      } else if (durationUnit === 'w') {
        banExpires.setDate(banExpires.getDate() + (durationValue * 7));
      } else if (durationUnit === 'm') {
        banExpires.setMonth(banExpires.getMonth() + durationValue);
      }
    }

    // Update user with ban information
    targetUser.banned = true;
    targetUser.banExpires = banExpires;
    await targetUser.save();

    res.json({
      message: 'User banned successfully',
      banExpires: targetUser.banExpires
    });
  } catch (error) {
    console.error('Ban user error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Unban a user
app.post('/api/users/:id/unban', authenticateToken, checkRole(['admin', 'moderator']), async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check role-based permissions
    if (targetUser.role === 'admin') {
      return res.status(403).json({ message: 'You cannot unban an admin' });
    }

    if (targetUser.role === 'moderator' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Moderators cannot unban other moderators' });
    }

    targetUser.banned = false;
    targetUser.banExpires = null;
    await targetUser.save();

    res.json({ message: 'User unbanned successfully' });
  } catch (error) {
    console.error('Unban user error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete a user (admin only)
app.delete('/api/users/:id', authenticateToken, checkRole(['admin']), async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Prevent deleting admins or self
    if (targetUser.role === 'admin') {
      return res.status(403).json({ message: 'You cannot delete an admin' });
    }
    
    if (req.user.id === req.params.id) {
      return res.status(403).json({ message: 'You cannot delete yourself' });
    }
    
    await User.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Change user role (admin and moderators with restrictions)
app.post('/api/users/:id/role', authenticateToken, checkRole(['admin', 'moderator']), async (req, res) => {
  try {
    console.log(`Role change request from ${req.user.role} for user ${req.params.id}, new role: ${req.body.newRole}`);
    
    const { newRole } = req.body;
    if (!newRole) {
      return res.status(400).json({ message: 'New role is required' });
    }

    // Validate role
    const validRoles = ['user', 'ngo', 'moderator', 'admin'];
    if (!validRoles.includes(newRole)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent self-role change
    if (req.user.id === req.params.id) {
      return res.status(403).json({ message: 'You cannot change your own role' });
    }

    // Moderator restrictions
    if (req.user.role === 'moderator') {
      // Moderators can: 1) change users to NGO, or 2) change NGOs back to users
      const isValidModeratorChange = 
        (targetUser.role === 'user' && newRole === 'ngo') || // user -> NGO
        (targetUser.role === 'ngo' && newRole === 'user');   // NGO -> user

      if (!isValidModeratorChange) {
        console.log('Moderator tried to perform an unauthorized role change');
        return res.status(403).json({ 
          message: 'As a moderator, you can only promote users to NGO status or demote NGOs to regular users' 
        });
      }
    }

    // Update user's role
    targetUser.role = newRole;
    await targetUser.save();
    
    console.log(`User ${targetUser.username} role updated to ${newRole} by ${req.user.username}`);

    res.json({
      message: 'User role updated successfully',
      user: {
        _id: targetUser._id,
        username: targetUser.username,
        email: targetUser.email,
        role: targetUser.role
      }
    });
  } catch (error) {
    console.error('Change user role error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add a route for looking up posts by external ID
app.get('/api/posts/lookup', authenticateToken, async (req, res) => {
  try {
    const { externalId } = req.query;
    
    if (!externalId) {
      return res.status(400).json({ message: 'External ID is required' });
    }
    
    const post = await Post.findOne({ externalId });
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    res.json(post);
  } catch (error) {
    console.error('Error looking up post by external ID:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete a comment
app.delete('/api/posts/:postId/comments/:commentId', authenticateToken, checkRole(['admin', 'moderator']), async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    
    // Find the post
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    // Find the comment index
    const commentIndex = post.comments.findIndex(comment => comment._id.toString() === commentId);
    if (commentIndex === -1) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    
    // Remove the comment from the array
    post.comments.splice(commentIndex, 1);
    
    // Save the post
    await post.save();
    
    // Get all unique author IDs for returning user roles
    const authorIds = new Set();
    authorIds.add(post.authorId.toString());
    post.comments.forEach(comment => {
      if (comment.authorId) {
        authorIds.add(comment.authorId.toString());
      }
    });
    
    // Fetch user roles for all authors
    const users = await User.find({
      _id: { $in: Array.from(authorIds) }
    }).select('_id role');
    
    // Create a mapping of user ID to role
    const userRoles = {};
    users.forEach(user => {
      userRoles[user._id.toString()] = user.role;
    });
    
    // Add user roles to post response
    const postObj = post.toObject();
    postObj.userRoles = userRoles;
    
    res.json({ 
      message: 'Comment deleted successfully',
      post: postObj
    });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
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
.then(() => console.log('MongoDB connected successfully'))
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
      role: userRole
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
        role: user.role
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
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Post Routes
app.get('/api/posts', async (req, res) => {
  try {
    console.log('Fetching all posts...');
    const posts = await Post.find().sort({ createdAt: -1 });
    console.log(`Found ${posts.length} posts`);
    res.json(posts);
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.post('/api/posts', authenticateToken, async (req, res) => {
  try {
    console.log('Creating new post:', req.body);
    const { title, description, type, location } = req.body;
    
    // Create new post with location data
    const newPost = new Post({
      title,
      description,
      type,
      location, // This now includes latitude, longitude, and displayName
      author: req.user.username,
      authorId: req.user.id
    });
    
    console.log('Saving post to MongoDB...');
    const post = await newPost.save();
    console.log('Post saved successfully:', post._id);
    res.status(201).json(post);
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Upvote/Downvote routes
app.post('/api/posts/:id/upvote', authenticateToken, async (req, res) => {
  try {
    console.log(`Upvoting post: ${req.params.id}`);
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    
    post.upvotes += 1;
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
    
    post.downvotes += 1;
    await post.save();
    
    res.json(post);
  } catch (error) {
    console.error('Downvote error:', error);
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
          await new User({
            username: user.username,
            email: user.email,
            password: user.password, // Already hashed
            role: user.role || 'user', // Default to 'user' if no role
            dateJoined: user.dateJoined
          }).save();
          usersCount++;
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
            await new Post({
              title: post.title,
              location: post.location,
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
          }
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

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
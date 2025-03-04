const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = 'your-secret-key'; // In production, use environment variables

// Middleware
app.use(cors());
app.use(bodyParser.json());

// File paths for storage
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const POSTS_FILE = path.join(DATA_DIR, 'posts.json');

// Create data directory if it doesn't exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

// Load data from files or initialize with empty arrays
let users = [];
let posts = [];

try {
  if (fs.existsSync(USERS_FILE)) {
    const userData = fs.readFileSync(USERS_FILE, 'utf8');
    users = JSON.parse(userData);
    console.log(`Loaded ${users.length} users from storage`);
  }
} catch (error) {
  console.error('Error loading users data:', error);
}

try {
  if (fs.existsSync(POSTS_FILE)) {
    const postsData = fs.readFileSync(POSTS_FILE, 'utf8');
    posts = JSON.parse(postsData);
    console.log(`Loaded ${posts.length} posts from storage`);
  }
} catch (error) {
  console.error('Error loading posts data:', error);
}

// Function to save data to files
const saveData = () => {
  // Save users
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (error) {
    console.error('Error saving users data:', error);
  }
  
  // Save posts
  try {
    fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
  } catch (error) {
    console.error('Error saving posts data:', error);
  }
};

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

// Auth Routes
app.post('/api/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Check if user already exists
    if (users.find(user => user.email === email)) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create new user
    const newUser = {
      id: Date.now().toString(),
      username,
      email,
      password: hashedPassword,
      dateJoined: new Date()
    };
    
    users.push(newUser);
    saveData(); // Save to file
    
    // Create token
    const token = jwt.sign(
      { id: newUser.id, username: newUser.username, email: newUser.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = users.find(user => user.email === email);
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    // Create token
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Post Routes
app.get('/api/posts', (req, res) => {
  res.json(posts);
});

app.post('/api/posts', authenticateToken, (req, res) => {
  try {
    const { title, location, description, type } = req.body;
    
    const newPost = {
      id: Date.now().toString(),
      title,
      location,
      description,
      type,
      author: req.user.username,
      authorId: req.user.id,
      createdAt: new Date(),
      upvotes: 0,
      downvotes: 0,
      comments: []
    };
    
    posts.push(newPost);
    saveData(); // Save to file
    res.status(201).json(newPost);
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Upvote/Downvote routes
app.post('/api/posts/:id/upvote', authenticateToken, (req, res) => {
  const post = posts.find(post => post.id === req.params.id);
  if (!post) return res.status(404).json({ message: 'Post not found' });
  
  post.upvotes += 1;
  saveData(); // Save to file
  res.json(post);
});

app.post('/api/posts/:id/downvote', authenticateToken, (req, res) => {
  const post = posts.find(post => post.id === req.params.id);
  if (!post) return res.status(404).json({ message: 'Post not found' });
  
  post.downvotes += 1;
  saveData(); // Save to file
  res.json(post);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

/* Database connection */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

/* Initialize database tables */
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS highlights (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        verse_ref VARCHAR(255) NOT NULL,
        word VARCHAR(255) NOT NULL,
        note TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Database tables initialized');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
}

initDB();

/* Sign up endpoint */
app.post('/api/signup', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.json({ success: false, message: 'Email and password are required' });
  }

  try {
    const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (userExists.rows.length > 0) {
      return res.json({ success: false, message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email',
      [email, hashedPassword]
    );

    res.json({ success: true, message: 'User registered successfully', userId: result.rows[0].id });
  } catch (err) {
    console.error('Signup error:', err);
    res.json({ success: false, message: 'Server error during signup' });
  }
});

/* Login endpoint */
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.json({ success: false, message: 'Email and password are required' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.json({ success: false, message: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.json({ success: false, message: 'Invalid email or password' });
    }

    res.json({ success: true, userId: user.id, email: user.email });
  } catch (err) {
    console.error('Login error:', err);
    res.json({ success: false, message: 'Server error during login' });
  }
});

/* Post question endpoint */
app.post('/api/posts', async (req, res) => {
  const { content, userId } = req.body;

  if (!content || !userId) {
    return res.json({ success: false, message: 'Content and userId are required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO posts (user_id, content) VALUES ($1, $2) RETURNING id, created_at',
      [userId, content]
    );

    res.json({ success: true, message: 'Post created successfully', postId: result.rows[0].id });
  } catch (err) {
    console.error('Post error:', err);
    res.json({ success: false, message: 'Server error creating post' });
  }
});

/* Get all posts endpoint */
app.get('/api/posts', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT p.id, p.content, u.email, p.created_at FROM posts p JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC'
    );

    res.json({ success: true, posts: result.rows });
  } catch (err) {
    console.error('Get posts error:', err);
    res.json({ success: false, message: 'Server error fetching posts' });
  }
});

/* Save highlights endpoint */
app.post('/api/highlights', async (req, res) => {
  const { userId, verseRef, word, note } = req.body;

  if (!userId || !verseRef || !word || !note) {
    return res.json({ success: false, message: 'All fields are required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO highlights (user_id, verse_ref, word, note) VALUES ($1, $2, $3, $4) RETURNING id',
      [userId, verseRef, word, note]
    );

    res.json({ success: true, message: 'Highlight saved', highlightId: result.rows[0].id });
  } catch (err) {
    console.error('Highlight error:', err);
    res.json({ success: false, message: 'Server error saving highlight' });
  }
});

/* Get user highlights endpoint */
app.get('/api/highlights/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await pool.query(
      'SELECT * FROM highlights WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    res.json({ success: true, highlights: result.rows });
  } catch (err) {
    console.error('Get highlights error:', err);
    res.json({ success: false, message: 'Server error fetching highlights' });
  }
});

/* Delete highlight endpoint */
app.delete('/api/highlights/:highlightId', async (req, res) => {
  const { highlightId } = req.params;

  try {
    await pool.query('DELETE FROM highlights WHERE id = $1', [highlightId]);
    res.json({ success: true, message: 'Highlight deleted' });
  } catch (err) {
    console.error('Delete highlight error:', err);
    res.json({ success: false, message: 'Server error deleting highlight' });
  }
});

/* Health check endpoint */
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

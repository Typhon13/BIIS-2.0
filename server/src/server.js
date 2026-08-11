const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Test Route
app.get('/api/test-db', async (req, res) => {
  try {
    // Queries PostgreSQL for current database name and system time
    const result = await db.query('SELECT current_database(), NOW()');
    res.json({
      success: true,
      message: 'Successfully connected to PostgreSQL!',
      database: result.rows[0].current_database,
      timestamp: result.rows[0].now,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});
app.get('/', (req, res) => {
  res.send('BIIS 2.0 Backend Server is Running');
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
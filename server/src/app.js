const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.use(
  cors({
    origin: clientOrigin,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get('/', (req, res) => {
  res.send('BIIS 2.0 Server is running smoothly!');
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Not found',
  });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  console.error('Unhandled request error:', error.message.split('\n')[0]);
  return res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
});

module.exports = app;
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const adminAcademicRoutes = require(
  './routes/admin-academic.routes'
);
const teacherRoutes = require(
  './routes/teacher.routes'
);
const studentRoutes = require(
  './routes/student.routes'
);

const app = express();

const clientOrigin =
  process.env.CLIENT_ORIGIN ||
  'http://localhost:5173';

app.disable('x-powered-by');

app.use(
  cors({
    origin: clientOrigin,
    credentials: true,
  })
);

app.use(
  express.json({
    limit: '1mb',
  })
);

app.use(cookieParser());

app.get('/', (req, res) => {
  return res.status(200).json({
    success: true,
    message:
      'BIIS 2.0 Server is running smoothly!',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', adminAcademicRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/student', studentRoutes);

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  console.error(
    'Unhandled request error:',
    error.message
  );

  return res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
});

module.exports = app;
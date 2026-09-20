require('dotenv').config();

const app = require('./app');
const db = require('./config/db');

const port = Number(process.env.PORT || 5000);

async function startServer() {
  try {
    await db.query('SELECT 1');

    console.log(
      'PostgreSQL connection successful'
    );

    app.listen(port, () => {
      console.log(
        `BIIS server running at http://localhost:${port}`
      );
    });
  } catch (error) {
    console.error(
      'Unable to start BIIS server:',
      error.message
    );

    process.exit(1);
  }
}

startServer();
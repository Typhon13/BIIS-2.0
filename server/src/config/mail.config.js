require('dotenv').config();

function getMailConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const from = process.env.MAIL_FROM;
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !from) {
    throw new Error('MAIL_CONFIGURATION_UNAVAILABLE');
  }
  return {
    host,
    port,
    secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD || '' } : undefined,
    from,
    resetUrl: process.env.PASSWORD_RESET_URL || 'http://localhost:5173/reset-password',
    expiresMinutes: Number(process.env.PASSWORD_RESET_EXPIRES_MINUTES || 30),
  };
}

module.exports = { getMailConfig };
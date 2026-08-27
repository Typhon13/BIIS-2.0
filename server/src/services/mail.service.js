const nodemailer = require('nodemailer');
const { getMailConfig } = require('../config/mail.config');

let transport;

function getTransport() {
  if (!transport) {
    const config = getMailConfig();
    transport = nodemailer.createTransport({ host: config.host, port: config.port, secure: config.secure, auth: config.auth });
  }
  return transport;
}

function setTransportForTests(testTransport) { transport = testTransport; }
function resetTransport() { transport = undefined; }

async function sendPasswordResetEmail({ email, resetToken }) {
  const config = getMailConfig();
  const link = `${config.resetUrl}?token=${encodeURIComponent(resetToken)}`;
  return getTransport().sendMail({
    from: config.from,
    to: email,
    subject: 'Password reset instructions',
    text: `A password reset was requested for your account. Use this link within ${config.expiresMinutes} minutes: ${link}\n\nIf you did not request this, ignore this email.`,
    html: `<p>A password reset was requested for your account.</p><p><a href="${link}">Reset your password</a> within ${config.expiresMinutes} minutes.</p><p>If you did not request this, ignore this email.</p>`,
  });
}

module.exports = { sendPasswordResetEmail, setTransportForTests, resetTransport };
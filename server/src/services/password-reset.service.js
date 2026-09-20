const crypto = require('crypto');
const resetRepository = require('../repositories/password-reset.repository');
const passwordUtils = require('../utils/password.utils');
const mailService = require('./mail.service');
const { getMailConfig } = require('../config/mail.config');

const genericForgotMessage = 'If an eligible account exists, password reset instructions have been sent.';
const genericResetMessage = 'Invalid or expired password reset token.';

function validatePassword(password, confirmPassword) {
  return typeof password === 'string' && password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && password === confirmPassword;
}

async function requestReset(email) {
  const user = await resetRepository.findEligibleUserByEmail(email);
  if (!user) return { sent: false };
  let mailConfig;
  try {
    mailConfig = getMailConfig();
  } catch (error) {
    throw new Error('MAIL_UNAVAILABLE');
  }
  const token = crypto.randomBytes(64).toString('hex');
  const request = await resetRepository.createResetRequest({ userId: user.user_id, tokenHash: crypto.createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + mailConfig.expiresMinutes * 60 * 1000) });
  if (!request) return { sent: false };
  try {
    await mailService.sendPasswordResetEmail({ email: request.email, resetToken: token });
    return { sent: true };
  } catch (error) {
    await resetRepository.invalidateRequest(request.requestId);
    const serviceError = new Error('MAIL_UNAVAILABLE');
    throw serviceError;
  }
}

async function resetPassword({ token, password, confirmPassword }) {
  if (!validatePassword(password, confirmPassword)) throw new Error('INVALID_RESET_INPUT');
  const passwordHash = await passwordUtils.hashPassword(password);
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const consumed = await resetRepository.consumeResetToken({ tokenHash, passwordHash });
  if (!consumed) throw new Error('INVALID_RESET_TOKEN');
}

module.exports = { requestReset, resetPassword, genericForgotMessage, genericResetMessage, validatePassword };
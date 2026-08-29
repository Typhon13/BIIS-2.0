const resetService = require('../services/password-reset.service');

async function forgotPassword(req, res) {
  try {
    await resetService.requestReset(req.body.email);
    return res.status(200).json({ success: true, message: resetService.genericForgotMessage });
  } catch (error) {
    if (error.message === 'MAIL_UNAVAILABLE') return res.status(503).json({ success: false, message: 'Password reset service is temporarily unavailable.' });
    return res.status(500).json({ success: false, message: 'Password reset service failed.' });
  }
}

async function resetPassword(req, res) {
  try {
    await resetService.resetPassword(req.body);
    return res.status(200).json({ success: true, message: 'Password reset successful. Please log in with your new password.' });
  } catch (error) {
    if (error.message === 'INVALID_RESET_INPUT' || error.message === 'INVALID_RESET_TOKEN') return res.status(400).json({ success: false, message: resetService.genericResetMessage });
    return res.status(500).json({ success: false, message: 'Password reset failed.' });
  }
}

module.exports = { forgotPassword, resetPassword };
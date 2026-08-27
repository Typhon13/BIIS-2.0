/**
 * Authorization Middleware
 * Ensures that authenticated users have one of the allowed roles
 */

function authorizeRoles(...allowedRoles) {
  const normalized = allowedRoles
    .filter(Boolean)
    .map((role) => String(role).trim().toUpperCase());

  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const currentRole = String(req.user.role).trim().toUpperCase();
    if (!normalized.includes(currentRole)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden',
      });
    }

    return next();
  };
}

module.exports = {
  authorizeRoles,
};

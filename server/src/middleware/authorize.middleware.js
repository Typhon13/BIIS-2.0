function authorizeRoles(...allowedRoles) {
  const normalizedRoles = allowedRoles.map((role) =>
    String(role).trim().toUpperCase()
  );

  return function authorize(req, res, next) {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const currentRole = String(req.user.role)
      .trim()
      .toUpperCase();

    if (!normalizedRoles.includes(currentRole)) {
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
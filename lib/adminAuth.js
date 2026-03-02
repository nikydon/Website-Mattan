/**
 * Middleware: redirect to login if not authenticated.
 */
function requireAdmin(req, res, next) {
  if (req.session && req.session.admin) {
    return next();
  }
  res.redirect('/admin/login');
}

module.exports = { requireAdmin };

const express = require('express');
const prisma = require('../../lib/prisma');
const { requireAdmin } = require('../../lib/adminAuth');
const { loadSettings, getDefaultTenant } = require('../../lib/settings');

const router = express.Router();

// ─── Login ───────────────────────────────────────────
router.get('/login', (req, res) => {
  if (req.session && req.session.admin) return res.redirect('/admin');
  res.render('admin/login', { pageTitle: 'Login' });
});

router.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) {
    req.session.admin = true;
    return res.redirect('/admin');
  }
  res.render('admin/login', { pageTitle: 'Login', error: 'Invalid password.' });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

// ─── All routes below require auth ──────────────────
router.use(requireAdmin);

// ─── Dashboard ───────────────────────────────────────
router.get('/', async (req, res) => {
  const tenant = await getDefaultTenant();
  const [collections, items, images, posts] = await Promise.all([
    prisma.collection.count({ where: { tenantId: tenant.id } }),
    prisma.catalogItem.count({ where: { tenantId: tenant.id } }),
    prisma.image.count({ where: { tenantId: tenant.id } }),
    prisma.newsPost.count({ where: { tenantId: tenant.id } }),
  ]);
  const videos = await prisma.image.count({ where: { tenantId: tenant.id, mediaType: 'video' } });
  res.render('admin/dashboard', { pageTitle: 'Dashboard', counts: { collections, items, images, posts, videos } });
});

// ─── Mount sub-routers ───────────────────────────────
router.use('/collections', require('./collections'));
router.use('/items', require('./items'));
router.use('/news', require('./news'));
router.use('/media', require('./media'));
router.use('/settings', require('./settings'));

module.exports = router;

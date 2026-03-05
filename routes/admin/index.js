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
  if (password === (process.env.ADMIN_PASSWORD || 'mattan2024')) {
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

  const [collections, items, images, orders, customers] = await Promise.all([
    prisma.collection.count({ where: { tenantId: tenant.id } }),
    prisma.catalogItem.count({ where: { tenantId: tenant.id } }),
    prisma.image.count({ where: { tenantId: tenant.id } }),
    prisma.order.count({ where: { tenantId: tenant.id } }),
    prisma.customer.count({ where: { tenantId: tenant.id } }),
  ]);

  const lowStock = await prisma.catalogItem.findMany({
    where: { tenantId: tenant.id, stockQty: { lte: 5 } },
    orderBy: { stockQty: 'asc' },
    take: 10,
    include: { collection: true },
  });

  const recentItems = await prisma.catalogItem.findMany({
    where: { tenantId: tenant.id },
    orderBy: { updatedAt: 'desc' },
    take: 8,
    include: { collection: true },
  });

  const recentPosts = await prisma.newsPost.findMany({
    where: { tenantId: tenant.id },
    orderBy: { updatedAt: 'desc' },
    take: 5,
  });

  const pendingOrders = await prisma.order.count({
    where: { tenantId: tenant.id, status: 'pending' },
  });

  res.render('admin/dashboard', {
    pageTitle: 'Dashboard',
    activePage: 'dashboard',
    counts: { collections, items, images, orders, customers },
    lowStock,
    recentItems,
    recentPosts,
    orderCount: pendingOrders,
  });
});

// ─── Mount sub-routers ───────────────────────────────
router.use('/collections', require('./collections'));
router.use('/items', require('./items'));
router.use('/news', require('./news'));
router.use('/media', require('./media'));
router.use('/settings', require('./settings'));
router.use('/orders', require('./orders'));
router.use('/customers', require('./customers'));
router.use('/coupons', require('./coupons'));
router.use('/analytics', require('./analytics'));
router.use('/layout', require('./layout'));

module.exports = router;

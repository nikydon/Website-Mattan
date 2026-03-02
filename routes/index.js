const express = require('express');
const prisma = require('../lib/prisma');
const { loadSettings, getDefaultTenant } = require('../lib/settings');

const router = express.Router();

// ─── Homepage ────────────────────────────────────────
router.get('/', async (req, res) => {
  const tenant = await getDefaultTenant();
  const settings = await loadSettings(tenant.id);

  const collections = await prisma.collection.findMany({
    where: { tenantId: tenant.id, published: true },
    orderBy: { sortOrder: 'asc' },
    include: {
      catalogItems: {
        where: { published: true },
        orderBy: { sortOrder: 'asc' },
        take: 1,
        include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } },
      },
      _count: { select: { catalogItems: true } },
    },
  });

  res.render('index', { settings, collections });
});

// ─── Collections listing ─────────────────────────────
router.get('/collections', async (req, res) => {
  const tenant = await getDefaultTenant();
  const settings = await loadSettings(tenant.id);

  const collections = await prisma.collection.findMany({
    where: { tenantId: tenant.id, published: true },
    orderBy: { sortOrder: 'asc' },
    include: {
      catalogItems: {
        where: { published: true },
        orderBy: { sortOrder: 'asc' },
        take: 1,
        include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } },
      },
      _count: { select: { catalogItems: true } },
    },
  });

  res.render('collections', { pageTitle: 'Collections', settings, collections });
});

// ─── Single collection ───────────────────────────────
router.get('/collections/:slug', async (req, res) => {
  const tenant = await getDefaultTenant();
  const settings = await loadSettings(tenant.id);

  const collection = await prisma.collection.findUnique({
    where: { tenantId_slug: { tenantId: tenant.id, slug: req.params.slug } },
    include: {
      catalogItems: {
        where: { published: true },
        orderBy: { sortOrder: 'asc' },
        include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } },
      },
    },
  });

  if (!collection || !collection.published) {
    return res.status(404).render('404', { settings });
  }

  res.render('collection', { pageTitle: collection.name, settings, collection });
});

// ─── Single piece ────────────────────────────────────
router.get('/pieces/:slug', async (req, res) => {
  const tenant = await getDefaultTenant();
  const settings = await loadSettings(tenant.id);

  const item = await prisma.catalogItem.findUnique({
    where: { tenantId_slug: { tenantId: tenant.id, slug: req.params.slug } },
    include: {
      collection: true,
      images: { orderBy: { sortOrder: 'asc' } },
    },
  });

  if (!item || !item.published) {
    return res.status(404).render('404', { settings });
  }

  res.render('piece', { pageTitle: item.title, settings, item });
});

// ─── About ───────────────────────────────────────────
router.get('/about', async (req, res) => {
  const tenant = await getDefaultTenant();
  const settings = await loadSettings(tenant.id);
  res.render('about', { pageTitle: 'About', settings });
});

// ─── News listing ────────────────────────────────────
router.get('/news', async (req, res) => {
  const tenant = await getDefaultTenant();
  const settings = await loadSettings(tenant.id);

  const posts = await prisma.newsPost.findMany({
    where: { tenantId: tenant.id, publishedAt: { not: null } },
    orderBy: { publishedAt: 'desc' },
  });

  res.render('news', { pageTitle: 'News', settings, posts });
});

// ─── Single news post ────────────────────────────────
router.get('/news/:slug', async (req, res) => {
  const tenant = await getDefaultTenant();
  const settings = await loadSettings(tenant.id);

  const post = await prisma.newsPost.findUnique({
    where: { tenantId_slug: { tenantId: tenant.id, slug: req.params.slug } },
    include: { images: { orderBy: { sortOrder: 'asc' } } },
  });

  if (!post || !post.publishedAt) {
    return res.status(404).render('404', { settings });
  }

  res.render('news-post', { pageTitle: post.title, settings, post });
});

module.exports = router;

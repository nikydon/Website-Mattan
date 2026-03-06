const express = require('express');
const prisma = require('../lib/prisma');
const { loadSettings, getDefaultTenant } = require('../lib/settings');

const router = express.Router();

// Wrap async route handlers so errors reach Express error handler
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// ─── Homepage ────────────────────────────────────────
router.get('/', wrap(async (req, res) => {
  const tenant = await getDefaultTenant();
  if (!tenant) return res.status(503).send('Site is starting up — please refresh in a moment.');
  const settings = await loadSettings(tenant.id);

  // Load layout config
  const DEFAULT_SECTIONS = ['hero', 'collections-grid', 'brand-story', 'newsletter'];
  let layoutSections = DEFAULT_SECTIONS;
  if (settings.layout_sections) {
    try { layoutSections = JSON.parse(settings.layout_sections); } catch (e) { /* fallback */ }
  }
  let sectionContent = {};
  if (settings.layout_content) {
    try { sectionContent = JSON.parse(settings.layout_content); } catch (e) { /* fallback */ }
  }
  let sectionStyles = {};
  if (settings.layout_styles) {
    try { sectionStyles = JSON.parse(settings.layout_styles); } catch (e) { /* fallback */ }
  }
  let sectionVisibility = {};
  if (settings.layout_visibility) {
    try { sectionVisibility = JSON.parse(settings.layout_visibility); } catch (e) { /* fallback */ }
  }

  const [collections, featuredProducts, recentPosts] = await Promise.all([
    prisma.collection.findMany({
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
    }),
    prisma.catalogItem.findMany({
      where: { tenantId: tenant.id, published: true },
      orderBy: { sortOrder: 'asc' },
      take: 8,
      include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 }, collection: true },
    }),
    prisma.newsPost.findMany({
      where: { tenantId: tenant.id, publishedAt: { not: null } },
      orderBy: { publishedAt: 'desc' },
      take: 3,
    }),
  ]);

  res.render('index', { settings, layoutSections, sectionContent, sectionStyles, sectionVisibility, collections, featuredProducts, recentPosts });
}));

// ─── Collections listing ─────────────────────────────
router.get('/collections', wrap(async (req, res) => {
  const tenant = await getDefaultTenant();
  if (!tenant) return res.status(503).send('Site is starting up — please refresh in a moment.');
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
}));

// ─── Single collection ───────────────────────────────
router.get('/collections/:slug', wrap(async (req, res) => {
  const tenant = await getDefaultTenant();
  if (!tenant) return res.status(503).send('Site is starting up — please refresh in a moment.');
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
}));

// ─── Single piece ────────────────────────────────────
router.get('/pieces/:slug', wrap(async (req, res) => {
  const tenant = await getDefaultTenant();
  if (!tenant) return res.status(503).send('Site is starting up — please refresh in a moment.');
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
}));

// ─── About ───────────────────────────────────────────
router.get('/about', wrap(async (req, res) => {
  const tenant = await getDefaultTenant();
  if (!tenant) return res.status(503).send('Site is starting up — please refresh in a moment.');
  const settings = await loadSettings(tenant.id);
  res.render('about', { pageTitle: 'About', settings });
}));

// ─── News listing ────────────────────────────────────
router.get('/news', wrap(async (req, res) => {
  const tenant = await getDefaultTenant();
  if (!tenant) return res.status(503).send('Site is starting up — please refresh in a moment.');
  const settings = await loadSettings(tenant.id);

  const posts = await prisma.newsPost.findMany({
    where: { tenantId: tenant.id, publishedAt: { not: null } },
    orderBy: { publishedAt: 'desc' },
  });

  res.render('news', { pageTitle: 'News', settings, posts });
}));

// ─── Single news post ────────────────────────────────
router.get('/news/:slug', wrap(async (req, res) => {
  const tenant = await getDefaultTenant();
  if (!tenant) return res.status(503).send('Site is starting up — please refresh in a moment.');
  const settings = await loadSettings(tenant.id);

  const post = await prisma.newsPost.findUnique({
    where: { tenantId_slug: { tenantId: tenant.id, slug: req.params.slug } },
    include: { images: { orderBy: { sortOrder: 'asc' } } },
  });

  if (!post || !post.publishedAt) {
    return res.status(404).render('404', { settings });
  }

  res.render('news-post', { pageTitle: post.title, settings, post });
}));

module.exports = router;

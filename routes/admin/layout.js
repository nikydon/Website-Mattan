const express = require('express');
const prisma = require('../../lib/prisma');
const { getDefaultTenant, loadSettings } = require('../../lib/settings');

const router = express.Router();

const DEFAULT_SECTIONS = ['hero', 'featured-products', 'collections-grid', 'brand-story', 'newsletter'];

router.get('/', async (req, res) => {
  const tenant = await getDefaultTenant();
  const settings = await loadSettings(tenant.id);

  // Load published layout
  let sections = DEFAULT_SECTIONS;
  if (settings.layout_sections) {
    try { sections = JSON.parse(settings.layout_sections); } catch (e) { /* fallback */ }
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

  // Load draft if exists
  let draftSections = null;
  let draftContent = null;
  let draftStyles = null;
  let draftVisibility = null;
  let hasDraft = false;

  if (settings.layout_draft_sections) {
    try {
      draftSections = JSON.parse(settings.layout_draft_sections);
      hasDraft = true;
    } catch (e) { /* ignore */ }
  }
  if (settings.layout_draft_content) {
    try { draftContent = JSON.parse(settings.layout_draft_content); } catch (e) { /* ignore */ }
  }
  if (settings.layout_draft_styles) {
    try { draftStyles = JSON.parse(settings.layout_draft_styles); } catch (e) { /* ignore */ }
  }
  if (settings.layout_draft_visibility) {
    try { draftVisibility = JSON.parse(settings.layout_draft_visibility); } catch (e) { /* ignore */ }
  }

  res.render('admin/layout-editor', {
    pageTitle: 'Layout Editor',
    activePage: 'layout',
    sections: hasDraft ? draftSections : sections,
    sectionContent: hasDraft ? (draftContent || sectionContent) : sectionContent,
    sectionStyles: hasDraft ? (draftStyles || sectionStyles) : sectionStyles,
    sectionVisibility: hasDraft ? (draftVisibility || sectionVisibility) : sectionVisibility,
    hasDraft,
    tenantId: tenant.id,
  });
});

// Save as draft
router.post('/save-draft', express.json(), async (req, res) => {
  const tenant = await getDefaultTenant();
  const { sections, content, styles, visibility } = req.body;

  if (!Array.isArray(sections)) {
    return res.json({ ok: false, error: 'Invalid sections' });
  }

  await Promise.all([
    prisma.siteSetting.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: 'layout_draft_sections' } },
      update: { value: JSON.stringify(sections) },
      create: { tenantId: tenant.id, key: 'layout_draft_sections', value: JSON.stringify(sections) },
    }),
    prisma.siteSetting.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: 'layout_draft_content' } },
      update: { value: JSON.stringify(content || {}) },
      create: { tenantId: tenant.id, key: 'layout_draft_content', value: JSON.stringify(content || {}) },
    }),
    prisma.siteSetting.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: 'layout_draft_styles' } },
      update: { value: JSON.stringify(styles || {}) },
      create: { tenantId: tenant.id, key: 'layout_draft_styles', value: JSON.stringify(styles || {}) },
    }),
    prisma.siteSetting.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: 'layout_draft_visibility' } },
      update: { value: JSON.stringify(visibility || {}) },
      create: { tenantId: tenant.id, key: 'layout_draft_visibility', value: JSON.stringify(visibility || {}) },
    }),
  ]);

  res.json({ ok: true });
});

// Publish (save to live + clear draft)
router.post('/publish', express.json(), async (req, res) => {
  const tenant = await getDefaultTenant();
  const { sections, content, styles, visibility } = req.body;

  if (!Array.isArray(sections)) {
    return res.json({ ok: false, error: 'Invalid sections' });
  }

  await Promise.all([
    // Update live settings
    prisma.siteSetting.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: 'layout_sections' } },
      update: { value: JSON.stringify(sections) },
      create: { tenantId: tenant.id, key: 'layout_sections', value: JSON.stringify(sections) },
    }),
    prisma.siteSetting.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: 'layout_content' } },
      update: { value: JSON.stringify(content || {}) },
      create: { tenantId: tenant.id, key: 'layout_content', value: JSON.stringify(content || {}) },
    }),
    prisma.siteSetting.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: 'layout_styles' } },
      update: { value: JSON.stringify(styles || {}) },
      create: { tenantId: tenant.id, key: 'layout_styles', value: JSON.stringify(styles || {}) },
    }),
    prisma.siteSetting.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: 'layout_visibility' } },
      update: { value: JSON.stringify(visibility || {}) },
      create: { tenantId: tenant.id, key: 'layout_visibility', value: JSON.stringify(visibility || {}) },
    }),
    // Clear drafts
    prisma.siteSetting.deleteMany({
      where: {
        tenantId: tenant.id,
        key: { in: ['layout_draft_sections', 'layout_draft_content', 'layout_draft_styles', 'layout_draft_visibility'] },
      },
    }),
  ]);

  res.json({ ok: true });
});

// Discard draft
router.post('/discard-draft', express.json(), async (req, res) => {
  const tenant = await getDefaultTenant();

  await prisma.siteSetting.deleteMany({
    where: {
      tenantId: tenant.id,
      key: { in: ['layout_draft_sections', 'layout_draft_content', 'layout_draft_styles', 'layout_draft_visibility'] },
    },
  });

  res.json({ ok: true });
});

// Live preview endpoint — renders the homepage with provided data (POST body)
router.post('/preview', express.json(), async (req, res, next) => {
  try {
  const tenant = await getDefaultTenant();
  const settings = await loadSettings(tenant.id);
  const { sections, content, styles, visibility } = req.body;

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

  res.render('preview', {
    settings,
    layoutSections: sections || [],
    sectionContent: content || {},
    sectionStyles: styles || {},
    sectionVisibility: visibility || {},
    collections,
    featuredProducts,
    recentPosts,
  });
  } catch (err) {
    next(err);
  }
});

// Keep backward compat
router.post('/save', express.json(), async (req, res) => {
  const tenant = await getDefaultTenant();
  const { sections, content, styles, visibility } = req.body;

  if (!Array.isArray(sections)) {
    return res.json({ ok: false, error: 'Invalid sections' });
  }

  await Promise.all([
    prisma.siteSetting.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: 'layout_sections' } },
      update: { value: JSON.stringify(sections) },
      create: { tenantId: tenant.id, key: 'layout_sections', value: JSON.stringify(sections) },
    }),
    prisma.siteSetting.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: 'layout_content' } },
      update: { value: JSON.stringify(content || {}) },
      create: { tenantId: tenant.id, key: 'layout_content', value: JSON.stringify(content || {}) },
    }),
    prisma.siteSetting.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: 'layout_styles' } },
      update: { value: JSON.stringify(styles || {}) },
      create: { tenantId: tenant.id, key: 'layout_styles', value: JSON.stringify(styles || {}) },
    }),
    prisma.siteSetting.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: 'layout_visibility' } },
      update: { value: JSON.stringify(visibility || {}) },
      create: { tenantId: tenant.id, key: 'layout_visibility', value: JSON.stringify(visibility || {}) },
    }),
  ]);

  res.json({ ok: true });
});

module.exports = router;

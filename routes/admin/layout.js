const express = require('express');
const prisma = require('../../lib/prisma');
const { getDefaultTenant, loadSettings } = require('../../lib/settings');

const router = express.Router();

const DEFAULT_SECTIONS = ['hero', 'featured-products', 'collections-grid', 'brand-story', 'newsletter'];

router.get('/', async (req, res) => {
  const tenant = await getDefaultTenant();
  const settings = await loadSettings(tenant.id);

  let sections = DEFAULT_SECTIONS;
  if (settings.layout_sections) {
    try {
      sections = JSON.parse(settings.layout_sections);
    } catch (e) {
      // fallback to default
    }
  }

  let sectionContent = {};
  if (settings.layout_content) {
    try {
      sectionContent = JSON.parse(settings.layout_content);
    } catch (e) {
      // fallback to empty
    }
  }

  res.render('admin/layout-editor', {
    pageTitle: 'Layout Editor',
    activePage: 'layout',
    sections,
    sectionContent,
  });
});

router.post('/save', express.json(), async (req, res) => {
  const tenant = await getDefaultTenant();
  const { sections, content } = req.body;

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
  ]);

  res.json({ ok: true });
});

module.exports = router;

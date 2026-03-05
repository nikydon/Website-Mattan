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

  res.render('admin/layout-editor', {
    pageTitle: 'Layout Editor',
    activePage: 'layout',
    sections,
  });
});

router.post('/save', express.json(), async (req, res) => {
  const tenant = await getDefaultTenant();
  const { sections } = req.body;

  if (!Array.isArray(sections)) {
    return res.json({ ok: false, error: 'Invalid sections' });
  }

  await prisma.siteSetting.upsert({
    where: { tenantId_key: { tenantId: tenant.id, key: 'layout_sections' } },
    update: { value: JSON.stringify(sections) },
    create: { tenantId: tenant.id, key: 'layout_sections', value: JSON.stringify(sections) },
  });

  res.json({ ok: true });
});

module.exports = router;

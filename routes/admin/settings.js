const express = require('express');
const prisma = require('../../lib/prisma');
const { loadSettings, getDefaultTenant } = require('../../lib/settings');

const router = express.Router();

const SETTING_KEYS = ['brand_name', 'tagline', 'about_text', 'brand_story', 'contact_email'];

// Show form
router.get('/', async (req, res) => {
  const tenant = await getDefaultTenant();
  const settings = await loadSettings(tenant.id);
  res.render('admin/settings', { pageTitle: 'Settings', settings, flash: req.query.msg });
});

// Save
router.post('/', async (req, res) => {
  const tenant = await getDefaultTenant();

  for (const key of SETTING_KEYS) {
    const value = req.body[key] || '';
    await prisma.siteSetting.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key } },
      update: { value },
      create: { tenantId: tenant.id, key, value },
    });
  }

  res.redirect('/admin/settings?msg=Settings saved.');
});

module.exports = router;

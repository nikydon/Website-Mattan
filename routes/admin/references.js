const express = require('express');
const prisma = require('../../lib/prisma');
const { getDefaultTenant } = require('../../lib/settings');
const { extractDesignTokens } = require('../../lib/styleExtractor');

const router = express.Router();

// List all reference sites
router.get('/', async (req, res) => {
  const tenant = await getDefaultTenant();
  const sites = await prisma.referenceSite.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json(sites.map(s => ({
    ...s,
    designTokens: s.designTokens ? JSON.parse(s.designTokens) : null,
  })));
});

// Add a reference site and trigger analysis
router.post('/', express.json(), async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required.' });

    // Validate URL
    try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL.' }); }

    const tenant = await getDefaultTenant();

    const site = await prisma.referenceSite.create({
      data: {
        tenantId: tenant.id,
        url,
        name: new URL(url).hostname,
        status: 'analyzing',
      },
    });

    // Analyze in background — don't block the response
    extractDesignTokens(url)
      .then(async (tokens) => {
        await prisma.referenceSite.update({
          where: { id: site.id },
          data: {
            designTokens: JSON.stringify(tokens),
            status: 'ready',
          },
        });
      })
      .catch(async (err) => {
        console.error('Style extraction error:', err.message);
        await prisma.referenceSite.update({
          where: { id: site.id },
          data: { status: 'error' },
        });
      });

    res.status(201).json({ id: site.id, url: site.url, name: site.name, status: 'analyzing' });
  } catch (err) {
    console.error('Reference site error:', err);
    res.status(500).json({ error: 'Failed to add reference site.' });
  }
});

// Update influence percentage
router.patch('/:id', express.json(), async (req, res) => {
  try {
    const { influence } = req.body;
    if (typeof influence !== 'number' || influence < 0 || influence > 100) {
      return res.status(400).json({ error: 'Influence must be 0-100.' });
    }

    const site = await prisma.referenceSite.update({
      where: { id: req.params.id },
      data: { influence },
    });

    res.json({
      ...site,
      designTokens: site.designTokens ? JSON.parse(site.designTokens) : null,
    });
  } catch (err) {
    console.error('Update reference error:', err);
    res.status(500).json({ error: 'Update failed.' });
  }
});

// Re-analyze a site
router.post('/:id/reanalyze', async (req, res) => {
  try {
    const site = await prisma.referenceSite.findUnique({ where: { id: req.params.id } });
    if (!site) return res.status(404).json({ error: 'Not found.' });

    await prisma.referenceSite.update({
      where: { id: site.id },
      data: { status: 'analyzing' },
    });

    extractDesignTokens(site.url)
      .then(async (tokens) => {
        await prisma.referenceSite.update({
          where: { id: site.id },
          data: { designTokens: JSON.stringify(tokens), status: 'ready' },
        });
      })
      .catch(async (err) => {
        console.error('Re-analyze error:', err.message);
        await prisma.referenceSite.update({
          where: { id: site.id },
          data: { status: 'error' },
        });
      });

    res.json({ status: 'analyzing' });
  } catch (err) {
    res.status(500).json({ error: 'Re-analyze failed.' });
  }
});

// Delete a reference site
router.delete('/:id', async (req, res) => {
  try {
    await prisma.referenceSite.delete({ where: { id: req.params.id } });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed.' });
  }
});

// Get blended design tokens based on all reference sites' influence percentages
router.get('/blend', async (req, res) => {
  const tenant = await getDefaultTenant();
  const sites = await prisma.referenceSite.findMany({
    where: { tenantId: tenant.id, status: 'ready' },
  });

  const activeSites = sites.filter(s => s.influence > 0 && s.designTokens);
  if (!activeSites.length) return res.json({ tokens: null });

  const totalInfluence = activeSites.reduce((sum, s) => sum + s.influence, 0);
  if (totalInfluence === 0) return res.json({ tokens: null });

  const blended = blendTokens(
    activeSites.map(s => ({
      tokens: JSON.parse(s.designTokens),
      weight: s.influence / totalInfluence,
    }))
  );

  res.json({ tokens: blended });
});

/**
 * Blend multiple design token sets based on weights.
 */
function blendTokens(entries) {
  if (entries.length === 0) return null;
  if (entries.length === 1) return entries[0].tokens;

  const result = {
    colors: {},
    typography: {},
    spacing: {},
    style: {},
  };

  // Blend colors by weighted RGB average
  const colorKeys = ['primary', 'secondary', 'accent', 'background', 'surface', 'text', 'textMuted', 'border'];
  colorKeys.forEach(key => {
    let r = 0, g = 0, b = 0;
    entries.forEach(({ tokens, weight }) => {
      const hex = tokens.colors && tokens.colors[key];
      if (hex) {
        const rgb = hexToRgb(hex);
        r += rgb.r * weight;
        g += rgb.g * weight;
        b += rgb.b * weight;
      }
    });
    result.colors[key] = rgbToHex(Math.round(r), Math.round(g), Math.round(b));
  });

  // Typography: use highest-weight site's fonts, blend numeric values
  const topEntry = entries.reduce((a, b) => a.weight > b.weight ? a : b);
  result.typography.headingFont = topEntry.tokens.typography?.headingFont || 'serif';
  result.typography.bodyFont = topEntry.tokens.typography?.bodyFont || 'sans-serif';
  result.typography.headingWeight = topEntry.tokens.typography?.headingWeight || '600';

  // Blend numeric typography values
  ['baseSize', 'lineHeight', 'letterSpacing', 'headingLetterSpacing'].forEach(key => {
    let val = 0;
    entries.forEach(({ tokens, weight }) => {
      const raw = tokens.typography && tokens.typography[key];
      val += (parseFloat(raw) || 0) * weight;
    });
    result.typography[key] = key === 'lineHeight' ? val.toFixed(2) : val.toFixed(1) + 'px';
  });

  // Blend spacing
  ['sectionPadding', 'elementGap'].forEach(key => {
    let val = 0;
    entries.forEach(({ tokens, weight }) => {
      const raw = tokens.spacing && tokens.spacing[key];
      val += (parseFloat(raw) || 0) * weight;
    });
    result.spacing[key] = Math.round(val) + 'px';
  });
  result.spacing.contentMaxWidth = topEntry.tokens.spacing?.contentMaxWidth || '1200px';

  // Style: use highest-weight values
  result.style.borderRadius = topEntry.tokens.style?.borderRadius || '0px';
  result.style.shadowStyle = topEntry.tokens.style?.shadowStyle || 'none';
  result.style.aesthetic = topEntry.tokens.style?.aesthetic || 'minimal';

  return result;
}

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  return {
    r: parseInt(hex.slice(0, 2), 16) || 0,
    g: parseInt(hex.slice(2, 4), 16) || 0,
    b: parseInt(hex.slice(4, 6), 16) || 0,
  };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}

module.exports = router;

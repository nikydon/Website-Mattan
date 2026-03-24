const express = require('express');
const fs = require('fs');
const path = require('path');
const prisma = require('../../lib/prisma');
const { getDefaultTenant } = require('../../lib/settings');
const { upload, generateThumbnail, detectMediaType, FULL_DIR, THUMB_DIR } = require('../../lib/upload');

const router = express.Router();

// List all media
router.get('/', async (req, res) => {
  const tenant = await getDefaultTenant();
  const filter = req.query.type; // 'image', 'video', or undefined for all
  const where = { tenantId: tenant.id };
  if (filter === 'image' || filter === 'video') {
    where.mediaType = filter;
  }

  const media = await prisma.image.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { catalogItem: true, newsPost: true },
  });
  res.render('admin/media', { pageTitle: 'Media Library', activePage: 'media', media, flash: req.query.msg, filter: filter || 'all' });
});

// Upload standalone media
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.redirect('/admin/media?msg=No file selected.');

  const tenant = await getDefaultTenant();
  const mediaType = detectMediaType(req.file.mimetype);
  await generateThumbnail(req.file.filename, req.file.mimetype);

  await prisma.image.create({
    data: {
      tenantId: tenant.id,
      filename: req.file.filename,
      originalName: req.file.originalname,
      altText: req.body.altText || null,
      mediaType,
      category: req.body.category || 'general',
    },
  });

  res.redirect('/admin/media?msg=File uploaded.');
});

// Upload media (JSON API for layout editor and other AJAX callers)
router.post('/upload-json', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No valid file provided.' });
    }

    const tenant = await getDefaultTenant();
    const mediaType = detectMediaType(req.file.mimetype);
    const thumbName = await generateThumbnail(req.file.filename, req.file.mimetype);

    const image = await prisma.image.create({
      data: {
        tenantId: tenant.id,
        filename: req.file.filename,
        originalName: req.file.originalname,
        altText: req.body.altText || null,
        mediaType,
        category: req.body.category || 'general',
      },
    });

    return res.status(201).json({
      id: image.id,
      filename: image.filename,
      thumbnail: thumbName,
      originalName: image.originalName,
      fullUrl: '/uploads/full/' + image.filename,
      thumbUrl: thumbName ? '/uploads/thumbs/' + thumbName : null,
    });
  } catch (err) {
    console.error('Upload JSON error:', err);
    return res.status(500).json({ error: 'Upload failed.' });
  }
});

// Delete media
router.post('/:id/delete', async (req, res) => {
  const image = await prisma.image.findUnique({ where: { id: req.params.id } });
  if (image) {
    const fullPath = path.join(FULL_DIR, image.filename);
    const thumbName = path.parse(image.filename).name + '.webp';
    const thumbPath = path.join(THUMB_DIR, thumbName);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
    await prisma.image.delete({ where: { id: image.id } });
  }
  res.redirect('/admin/media?msg=File deleted.');
});

module.exports = router;

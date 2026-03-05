const express = require('express');
const fs = require('fs');
const path = require('path');
const prisma = require('../lib/prisma');
const { upload, generateThumbnail, detectMediaType, FULL_DIR, THUMB_DIR } = require('../lib/upload');

const router = express.Router();

/**
 * POST /upload
 * Body (multipart/form-data):
 *   file       – the image file
 *   tenantId   – required
 *   category   – "catalog" | "news" | "general"  (default "catalog")
 *   catalogItemId – optional, links image to an item
 *   newsPostId    – optional, links image to a news post
 *   altText       – optional alt text
 */
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No valid image file provided.' });
    }

    const { tenantId, category, catalogItemId, newsPostId, altText } = req.body;
    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required.' });
    }

    const mediaType = detectMediaType(req.file.mimetype);
    const thumbName = await generateThumbnail(req.file.filename, req.file.mimetype);

    // Determine sort order (append to end)
    const lastImage = await prisma.image.findFirst({
      where: { tenantId, catalogItemId: catalogItemId || undefined },
      orderBy: { sortOrder: 'desc' },
    });
    const sortOrder = lastImage ? lastImage.sortOrder + 1 : 0;

    // Save to database
    const image = await prisma.image.create({
      data: {
        tenantId,
        filename: req.file.filename,
        originalName: req.file.originalname,
        altText: altText || null,
        mediaType,
        category: category || 'catalog',
        catalogItemId: catalogItemId || null,
        newsPostId: newsPostId || null,
        sortOrder,
      },
    });

    return res.status(201).json({
      id: image.id,
      filename: image.filename,
      thumbnail: thumbName,
      originalName: image.originalName,
      fullUrl: `/uploads/full/${image.filename}`,
      thumbUrl: `/uploads/thumbs/${thumbName}`,
    });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: 'Upload failed.' });
  }
});

/**
 * DELETE /upload/:id
 * Removes the image record and both full + thumb files.
 */
router.delete('/:id', async (req, res) => {
  try {
    const image = await prisma.image.findUnique({ where: { id: req.params.id } });
    if (!image) {
      return res.status(404).json({ error: 'Image not found.' });
    }

    // Delete files from disk
    const fullPath = path.join(FULL_DIR, image.filename);
    const thumbName = path.parse(image.filename).name + '.webp';
    const thumbPath = path.join(THUMB_DIR, thumbName);

    for (const p of [fullPath, thumbPath]) {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }

    // Delete database record
    await prisma.image.delete({ where: { id: image.id } });

    return res.json({ deleted: true, id: image.id });
  } catch (err) {
    console.error('Delete error:', err);
    return res.status(500).json({ error: 'Delete failed.' });
  }
});

module.exports = router;

const express = require('express');
const fs = require('fs');
const path = require('path');
const prisma = require('../../lib/prisma');
const { getDefaultTenant } = require('../../lib/settings');
const { upload, generateThumbnail, FULL_DIR, THUMB_DIR } = require('../../lib/upload');

const router = express.Router();

// List
router.get('/', async (req, res) => {
  const tenant = await getDefaultTenant();
  const items = await prisma.catalogItem.findMany({
    where: { tenantId: tenant.id },
    orderBy: { sortOrder: 'asc' },
    include: {
      collection: true,
      _count: { select: { images: true } },
    },
  });
  res.render('admin/items', { pageTitle: 'Catalog Items', items, flash: req.query.msg });
});

// New form
router.get('/new', async (req, res) => {
  const tenant = await getDefaultTenant();
  const collections = await prisma.collection.findMany({
    where: { tenantId: tenant.id },
    orderBy: { sortOrder: 'asc' },
  });
  res.render('admin/item-form', { pageTitle: 'New Item', isEdit: false, collections });
});

// Create
router.post('/new', async (req, res) => {
  const tenant = await getDefaultTenant();
  const { title, slug, collectionId, description, price, materials, sortOrder, published } = req.body;
  await prisma.catalogItem.create({
    data: {
      tenantId: tenant.id,
      title,
      slug,
      collectionId: collectionId || null,
      description: description || null,
      price: price || null,
      materials: materials || null,
      sortOrder: parseInt(sortOrder) || 0,
      published: published === 'true',
    },
  });
  res.redirect('/admin/items?msg=Item created.');
});

// Edit form
router.get('/:id/edit', async (req, res) => {
  const tenant = await getDefaultTenant();
  const [item, collections] = await Promise.all([
    prisma.catalogItem.findUnique({
      where: { id: req.params.id },
      include: { images: { orderBy: { sortOrder: 'asc' } } },
    }),
    prisma.collection.findMany({
      where: { tenantId: tenant.id },
      orderBy: { sortOrder: 'asc' },
    }),
  ]);
  if (!item) return res.redirect('/admin/items');
  res.render('admin/item-form', { pageTitle: 'Edit Item', isEdit: true, item, collections });
});

// Update
router.post('/:id/edit', async (req, res) => {
  const { title, slug, collectionId, description, price, materials, sortOrder, published } = req.body;
  await prisma.catalogItem.update({
    where: { id: req.params.id },
    data: {
      title,
      slug,
      collectionId: collectionId || null,
      description: description || null,
      price: price || null,
      materials: materials || null,
      sortOrder: parseInt(sortOrder) || 0,
      published: published === 'true',
    },
  });
  res.redirect(`/admin/items/${req.params.id}/edit`);
});

// Delete item
router.post('/:id/delete', async (req, res) => {
  // Delete associated images from disk first
  const images = await prisma.image.findMany({ where: { catalogItemId: req.params.id } });
  for (const img of images) {
    const fullPath = path.join(FULL_DIR, img.filename);
    const thumbName = path.parse(img.filename).name + '.webp';
    const thumbPath = path.join(THUMB_DIR, thumbName);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
  }
  await prisma.image.deleteMany({ where: { catalogItemId: req.params.id } });
  await prisma.catalogItem.delete({ where: { id: req.params.id } });
  res.redirect('/admin/items?msg=Item deleted.');
});

// ─── Image upload for an item ────────────────────────
router.post('/:id/images', upload.single('file'), async (req, res) => {
  if (!req.file) return res.redirect(`/admin/items/${req.params.id}/edit`);

  const item = await prisma.catalogItem.findUnique({ where: { id: req.params.id } });
  if (!item) return res.redirect('/admin/items');

  await generateThumbnail(req.file.filename);

  const lastImage = await prisma.image.findFirst({
    where: { catalogItemId: item.id },
    orderBy: { sortOrder: 'desc' },
  });

  await prisma.image.create({
    data: {
      tenantId: item.tenantId,
      catalogItemId: item.id,
      filename: req.file.filename,
      originalName: req.file.originalname,
      altText: req.body.altText || null,
      category: 'catalog',
      sortOrder: lastImage ? lastImage.sortOrder + 1 : 0,
    },
  });

  res.redirect(`/admin/items/${req.params.id}/edit`);
});

// Delete a single image from an item
router.post('/:id/images/:imageId/delete', async (req, res) => {
  const image = await prisma.image.findUnique({ where: { id: req.params.imageId } });
  if (image) {
    const fullPath = path.join(FULL_DIR, image.filename);
    const thumbName = path.parse(image.filename).name + '.webp';
    const thumbPath = path.join(THUMB_DIR, thumbName);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
    await prisma.image.delete({ where: { id: image.id } });
  }
  res.redirect(`/admin/items/${req.params.id}/edit`);
});

module.exports = router;

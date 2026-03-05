const express = require('express');
const fs = require('fs');
const path = require('path');
const prisma = require('../../lib/prisma');
const { getDefaultTenant } = require('../../lib/settings');
const { upload, generateThumbnail, detectMediaType, FULL_DIR, THUMB_DIR } = require('../../lib/upload');

const router = express.Router();

// List
router.get('/', async (req, res) => {
  const tenant = await getDefaultTenant();
  const posts = await prisma.newsPost.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: 'desc' },
  });
  res.render('admin/news', { pageTitle: 'News', activePage: 'news', posts, flash: req.query.msg });
});

// New form
router.get('/new', (req, res) => {
  res.render('admin/news-form', { pageTitle: 'New Post', activePage: 'news', isEdit: false });
});

// Create
router.post('/new', async (req, res) => {
  const tenant = await getDefaultTenant();
  const { title, slug, body, publish } = req.body;
  await prisma.newsPost.create({
    data: {
      tenantId: tenant.id,
      title,
      slug,
      body: body || '',
      publishedAt: publish === 'true' ? new Date() : null,
    },
  });
  res.redirect('/admin/news?msg=Post created.');
});

// Edit form
router.get('/:id/edit', async (req, res) => {
  const post = await prisma.newsPost.findUnique({
    where: { id: req.params.id },
    include: { images: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!post) return res.redirect('/admin/news');
  res.render('admin/news-form', { pageTitle: 'Edit Post', activePage: 'news', isEdit: true, post });
});

// Update
router.post('/:id/edit', async (req, res) => {
  const { title, slug, body, publish } = req.body;
  const existing = await prisma.newsPost.findUnique({ where: { id: req.params.id } });

  let publishedAt = existing.publishedAt;
  if (publish === 'true' && !existing.publishedAt) {
    publishedAt = new Date();
  } else if (publish !== 'true') {
    publishedAt = null;
  }

  await prisma.newsPost.update({
    where: { id: req.params.id },
    data: { title, slug, body: body || '', publishedAt },
  });
  res.redirect('/admin/news?msg=Post updated.');
});

// Delete
router.post('/:id/delete', async (req, res) => {
  const images = await prisma.image.findMany({ where: { newsPostId: req.params.id } });
  for (const img of images) {
    const fullPath = path.join(FULL_DIR, img.filename);
    const thumbName = path.parse(img.filename).name + '.webp';
    const thumbPath = path.join(THUMB_DIR, thumbName);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
  }
  await prisma.image.deleteMany({ where: { newsPostId: req.params.id } });
  await prisma.newsPost.delete({ where: { id: req.params.id } });
  res.redirect('/admin/news?msg=Post deleted.');
});

// ─── Media upload for a news post ────────────────────
router.post('/:id/media', upload.single('file'), async (req, res) => {
  if (!req.file) return res.redirect(`/admin/news/${req.params.id}/edit`);

  const post = await prisma.newsPost.findUnique({ where: { id: req.params.id } });
  if (!post) return res.redirect('/admin/news');

  const mediaType = detectMediaType(req.file.mimetype);
  await generateThumbnail(req.file.filename, req.file.mimetype);

  const lastImage = await prisma.image.findFirst({
    where: { newsPostId: post.id },
    orderBy: { sortOrder: 'desc' },
  });

  await prisma.image.create({
    data: {
      tenantId: post.tenantId,
      newsPostId: post.id,
      filename: req.file.filename,
      originalName: req.file.originalname,
      altText: req.body.altText || null,
      mediaType,
      category: 'news',
      sortOrder: lastImage ? lastImage.sortOrder + 1 : 0,
    },
  });

  res.redirect(`/admin/news/${req.params.id}/edit`);
});

// Delete media from a news post
router.post('/:id/media/:mediaId/delete', async (req, res) => {
  const image = await prisma.image.findUnique({ where: { id: req.params.mediaId } });
  if (image) {
    const fullPath = path.join(FULL_DIR, image.filename);
    const thumbName = path.parse(image.filename).name + '.webp';
    const thumbPath = path.join(THUMB_DIR, thumbName);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
    await prisma.image.delete({ where: { id: image.id } });
  }
  res.redirect(`/admin/news/${req.params.id}/edit`);
});

module.exports = router;

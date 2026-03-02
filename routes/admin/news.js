const express = require('express');
const prisma = require('../../lib/prisma');
const { getDefaultTenant } = require('../../lib/settings');

const router = express.Router();

// List
router.get('/', async (req, res) => {
  const tenant = await getDefaultTenant();
  const posts = await prisma.newsPost.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: 'desc' },
  });
  res.render('admin/news', { pageTitle: 'News', posts, flash: req.query.msg });
});

// New form
router.get('/new', (req, res) => {
  res.render('admin/news-form', { pageTitle: 'New Post', isEdit: false });
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
  const post = await prisma.newsPost.findUnique({ where: { id: req.params.id } });
  if (!post) return res.redirect('/admin/news');
  res.render('admin/news-form', { pageTitle: 'Edit Post', isEdit: true, post });
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
  await prisma.newsPost.delete({ where: { id: req.params.id } });
  res.redirect('/admin/news?msg=Post deleted.');
});

module.exports = router;

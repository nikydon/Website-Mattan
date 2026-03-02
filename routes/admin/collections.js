const express = require('express');
const prisma = require('../../lib/prisma');
const { getDefaultTenant } = require('../../lib/settings');

const router = express.Router();

// List
router.get('/', async (req, res) => {
  const tenant = await getDefaultTenant();
  const collections = await prisma.collection.findMany({
    where: { tenantId: tenant.id },
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { catalogItems: true } } },
  });
  res.render('admin/collections', { pageTitle: 'Collections', collections, flash: req.query.msg });
});

// New form
router.get('/new', (req, res) => {
  res.render('admin/collection-form', { pageTitle: 'New Collection', isEdit: false });
});

// Create
router.post('/new', async (req, res) => {
  const tenant = await getDefaultTenant();
  const { name, slug, description, sortOrder, published } = req.body;
  await prisma.collection.create({
    data: {
      tenantId: tenant.id,
      name,
      slug,
      description: description || null,
      sortOrder: parseInt(sortOrder) || 0,
      published: published === 'true',
    },
  });
  res.redirect('/admin/collections?msg=Collection created.');
});

// Edit form
router.get('/:id/edit', async (req, res) => {
  const collection = await prisma.collection.findUnique({ where: { id: req.params.id } });
  if (!collection) return res.redirect('/admin/collections');
  res.render('admin/collection-form', { pageTitle: 'Edit Collection', isEdit: true, collection });
});

// Update
router.post('/:id/edit', async (req, res) => {
  const { name, slug, description, sortOrder, published } = req.body;
  await prisma.collection.update({
    where: { id: req.params.id },
    data: {
      name,
      slug,
      description: description || null,
      sortOrder: parseInt(sortOrder) || 0,
      published: published === 'true',
    },
  });
  res.redirect('/admin/collections?msg=Collection updated.');
});

// Delete
router.post('/:id/delete', async (req, res) => {
  await prisma.collection.delete({ where: { id: req.params.id } });
  res.redirect('/admin/collections?msg=Collection deleted.');
});

module.exports = router;

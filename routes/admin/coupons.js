const express = require('express');
const prisma = require('../../lib/prisma');
const { getDefaultTenant } = require('../../lib/settings');

const router = express.Router();

router.get('/', async (req, res) => {
  const tenant = await getDefaultTenant();
  const coupons = await prisma.coupon.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: 'desc' },
  });

  res.render('admin/coupons', {
    pageTitle: 'Coupons',
    activePage: 'coupons',
    coupons,
    flash: req.query.msg,
  });
});

router.get('/new', (req, res) => {
  res.render('admin/coupon-form', {
    pageTitle: 'New Coupon',
    activePage: 'coupons',
    isEdit: false,
  });
});

router.post('/new', async (req, res) => {
  const tenant = await getDefaultTenant();
  const { code, discount, type, usageLimit, expiresAt, active } = req.body;

  await prisma.coupon.create({
    data: {
      tenantId: tenant.id,
      code: code.toUpperCase().trim(),
      discount,
      type: type || 'percentage',
      usageLimit: usageLimit ? parseInt(usageLimit) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      active: active === 'true',
    },
  });
  res.redirect('/admin/coupons?msg=Coupon created.');
});

router.get('/:id/edit', async (req, res) => {
  const coupon = await prisma.coupon.findUnique({ where: { id: req.params.id } });
  if (!coupon) return res.redirect('/admin/coupons');
  res.render('admin/coupon-form', {
    pageTitle: 'Edit Coupon',
    activePage: 'coupons',
    isEdit: true,
    coupon,
  });
});

router.post('/:id/edit', async (req, res) => {
  const { code, discount, type, usageLimit, expiresAt, active } = req.body;
  await prisma.coupon.update({
    where: { id: req.params.id },
    data: {
      code: code.toUpperCase().trim(),
      discount,
      type: type || 'percentage',
      usageLimit: usageLimit ? parseInt(usageLimit) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      active: active === 'true',
    },
  });
  res.redirect('/admin/coupons?msg=Coupon updated.');
});

router.post('/:id/delete', async (req, res) => {
  await prisma.coupon.delete({ where: { id: req.params.id } });
  res.redirect('/admin/coupons?msg=Coupon deleted.');
});

module.exports = router;

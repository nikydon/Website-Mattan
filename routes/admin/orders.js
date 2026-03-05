const express = require('express');
const prisma = require('../../lib/prisma');
const { getDefaultTenant } = require('../../lib/settings');

const router = express.Router();

router.get('/', async (req, res) => {
  const tenant = await getDefaultTenant();
  const statusFilter = req.query.status || '';
  const where = { tenantId: tenant.id };
  if (statusFilter) where.status = statusFilter;

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      customer: true,
      items: true,
    },
  });

  res.render('admin/orders', {
    pageTitle: 'Orders',
    activePage: 'orders',
    orders,
    statusFilter,
    flash: req.query.msg,
  });
});

router.post('/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!status) return res.redirect('/admin/orders');

  await prisma.order.update({
    where: { id: req.params.id },
    data: { status },
  });
  res.redirect('/admin/orders?msg=Order status updated.');
});

module.exports = router;

const express = require('express');
const prisma = require('../../lib/prisma');
const { getDefaultTenant } = require('../../lib/settings');

const router = express.Router();

router.get('/', async (req, res) => {
  const tenant = await getDefaultTenant();

  const [items, orders, customers] = await Promise.all([
    prisma.catalogItem.count({ where: { tenantId: tenant.id } }),
    prisma.order.count({ where: { tenantId: tenant.id } }),
    prisma.customer.count({ where: { tenantId: tenant.id } }),
  ]);

  const topProducts = await prisma.catalogItem.findMany({
    where: { tenantId: tenant.id, published: true },
    orderBy: { sortOrder: 'asc' },
    take: 10,
    include: { collection: true },
  });

  res.render('admin/analytics', {
    pageTitle: 'Analytics',
    activePage: 'analytics',
    counts: { items, orders, customers },
    topProducts,
  });
});

module.exports = router;

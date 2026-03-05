const express = require('express');
const prisma = require('../../lib/prisma');
const { getDefaultTenant } = require('../../lib/settings');

const router = express.Router();

router.get('/', async (req, res) => {
  const tenant = await getDefaultTenant();
  const customers = await prisma.customer.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { orders: true } } },
  });

  res.render('admin/customers', {
    pageTitle: 'Customers',
    activePage: 'customers',
    customers,
    flash: req.query.msg,
  });
});

router.post('/:id/toggle-flag', async (req, res) => {
  const customer = await prisma.customer.findUnique({ where: { id: req.params.id } });
  if (customer) {
    await prisma.customer.update({
      where: { id: req.params.id },
      data: { flagged: !customer.flagged },
    });
  }
  res.redirect('/admin/customers?msg=Customer updated.');
});

module.exports = router;

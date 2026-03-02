const prisma = require('./prisma');

/**
 * Load all site settings for a tenant and return them as a { key: value } object.
 */
async function loadSettings(tenantId) {
  const rows = await prisma.siteSetting.findMany({ where: { tenantId } });
  const map = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return map;
}

/**
 * Get the default tenant. For now we only have one.
 */
async function getDefaultTenant() {
  return prisma.tenant.findFirst();
}

module.exports = { loadSettings, getDefaultTenant };

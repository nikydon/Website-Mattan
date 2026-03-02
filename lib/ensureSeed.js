/**
 * Seed essential data if the database is empty (first deploy).
 * Called from server.js on startup — safe to call repeatedly.
 */
const prisma = require('./prisma');

async function ensureSeeded() {
  const existing = await prisma.tenant.findFirst();
  if (existing) return; // already seeded

  console.log('[seed] No tenant found — running initial seed…');

  const tenant = await prisma.tenant.create({
    data: { name: 'Mattan', slug: 'mattan' },
  });

  // Collections
  const collectionsData = [
    { name: 'Rings', slug: 'rings', description: 'Handcrafted rings in gold and silver.', sortOrder: 1 },
    { name: 'Earrings', slug: 'earrings', description: 'Statement earrings and subtle studs.', sortOrder: 2 },
    { name: 'Necklaces', slug: 'necklaces', description: 'Chains, pendants, and chokers.', sortOrder: 3 },
    { name: 'Bracelets', slug: 'bracelets', description: 'Cuffs, bangles, and delicate chains.', sortOrder: 4 },
  ];

  const collections = {};
  for (const c of collectionsData) {
    const col = await prisma.collection.create({
      data: { tenantId: tenant.id, name: c.name, slug: c.slug, description: c.description, sortOrder: c.sortOrder, published: true },
    });
    collections[c.slug] = col;
  }

  // Catalog items
  const itemsData = [
    { col: 'rings', title: 'Arc Ring', slug: 'arc-ring', description: 'A minimal curved band in polished gold.', price: '€320', materials: '18k gold', sortOrder: 1 },
    { col: 'rings', title: 'Signet Ring', slug: 'signet-ring', description: 'Classic signet with a modern flat face.', price: '€280', materials: 'Sterling silver', sortOrder: 2 },
    { col: 'earrings', title: 'Drop Earring', slug: 'drop-earring', description: 'A single elongated drop in brushed silver.', price: '€190', materials: 'Sterling silver', sortOrder: 1 },
    { col: 'earrings', title: 'Stud Earring', slug: 'stud-earring', description: 'Small geometric studs, sold as a pair.', price: '€150', materials: '18k gold', sortOrder: 2 },
    { col: 'necklaces', title: 'Chain Necklace', slug: 'chain-necklace', description: 'Fine-link chain, adjustable length.', price: '€260', materials: '18k gold', sortOrder: 1 },
    { col: 'necklaces', title: 'Pendant Necklace', slug: 'pendant-necklace', description: 'Oval pendant on a delicate chain.', price: '€340', materials: 'Sterling silver, onyx', sortOrder: 2 },
    { col: 'bracelets', title: 'Cuff Bracelet', slug: 'cuff-bracelet', description: 'Wide open cuff with a hammered finish.', price: '€290', materials: 'Sterling silver', sortOrder: 1 },
    { col: 'bracelets', title: 'Chain Bracelet', slug: 'chain-bracelet', description: 'Slim chain bracelet with a toggle clasp.', price: '€210', materials: '18k gold', sortOrder: 2 },
  ];

  for (const item of itemsData) {
    await prisma.catalogItem.create({
      data: {
        tenantId: tenant.id,
        collectionId: collections[item.col].id,
        title: item.title,
        slug: item.slug,
        description: item.description,
        price: item.price,
        materials: item.materials,
        sortOrder: item.sortOrder,
        published: true,
      },
    });
  }

  // Site settings
  const settings = [
    { key: 'brand_name', value: 'MATTAN' },
    { key: 'tagline', value: 'Quiet luxury, worn daily.' },
    { key: 'about_text', value: 'Mattan is a jewelry brand rooted in restraint. Each piece is designed to be lived in — minimal in form, lasting in material. We work with 18k gold and sterling silver, finished by hand in small batches.' },
    { key: 'brand_story', value: 'Founded on the belief that jewelry should be felt, not announced. Mattan draws from architectural geometry and the textures of everyday wear. No trends, no seasons — just pieces that stay.' },
    { key: 'contact_email', value: 'hello@mattan.com' },
  ];

  for (const s of settings) {
    await prisma.siteSetting.create({
      data: { tenantId: tenant.id, key: s.key, value: s.value },
    });
  }

  console.log('[seed] Initial seed complete.');
}

module.exports = { ensureSeeded };

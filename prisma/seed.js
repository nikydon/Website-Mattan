require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // ─── Tenant ────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'mattan' },
    update: {},
    create: { name: 'Mattan', slug: 'mattan' },
  });
  console.log('Tenant:', tenant.name, `(${tenant.id})`);

  // ─── Collections ───────────────────────────────────────
  const collectionsData = [
    { name: 'Rings', slug: 'rings', description: 'Handcrafted rings in gold and silver.', sortOrder: 1 },
    { name: 'Earrings', slug: 'earrings', description: 'Statement earrings and subtle studs.', sortOrder: 2 },
    { name: 'Necklaces', slug: 'necklaces', description: 'Chains, pendants, and chokers.', sortOrder: 3 },
    { name: 'Bracelets', slug: 'bracelets', description: 'Cuffs, bangles, and delicate chains.', sortOrder: 4 },
  ];

  const collections = {};
  for (const c of collectionsData) {
    const col = await prisma.collection.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: c.slug } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        sortOrder: c.sortOrder,
        published: true,
      },
    });
    collections[c.slug] = col;
    console.log('  Collection:', col.name);
  }

  // ─── Catalog Items ─────────────────────────────────────
  const itemsData = [
    { collectionSlug: 'rings', title: 'Arc Ring', slug: 'arc-ring', description: 'A minimal curved band in polished gold.', price: '€320', materials: '18k gold', sortOrder: 1 },
    { collectionSlug: 'rings', title: 'Signet Ring', slug: 'signet-ring', description: 'Classic signet with a modern flat face.', price: '€280', materials: 'Sterling silver', sortOrder: 2 },
    { collectionSlug: 'earrings', title: 'Drop Earring', slug: 'drop-earring', description: 'A single elongated drop in brushed silver.', price: '€190', materials: 'Sterling silver', sortOrder: 1 },
    { collectionSlug: 'earrings', title: 'Stud Earring', slug: 'stud-earring', description: 'Small geometric studs, sold as a pair.', price: '€150', materials: '18k gold', sortOrder: 2 },
    { collectionSlug: 'necklaces', title: 'Chain Necklace', slug: 'chain-necklace', description: 'Fine-link chain, adjustable length.', price: '€260', materials: '18k gold', sortOrder: 1 },
    { collectionSlug: 'necklaces', title: 'Pendant Necklace', slug: 'pendant-necklace', description: 'Oval pendant on a delicate chain.', price: '€340', materials: 'Sterling silver, onyx', sortOrder: 2 },
    { collectionSlug: 'bracelets', title: 'Cuff Bracelet', slug: 'cuff-bracelet', description: 'Wide open cuff with a hammered finish.', price: '€290', materials: 'Sterling silver', sortOrder: 1 },
    { collectionSlug: 'bracelets', title: 'Chain Bracelet', slug: 'chain-bracelet', description: 'Slim chain bracelet with a toggle clasp.', price: '€210', materials: '18k gold', sortOrder: 2 },
  ];

  for (const item of itemsData) {
    const created = await prisma.catalogItem.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: item.slug } },
      update: {},
      create: {
        tenantId: tenant.id,
        collectionId: collections[item.collectionSlug].id,
        title: item.title,
        slug: item.slug,
        description: item.description,
        price: item.price,
        materials: item.materials,
        sortOrder: item.sortOrder,
        published: true,
      },
    });
    console.log('    Item:', created.title);
  }

  // ─── Site Settings ─────────────────────────────────────
  const settingsData = [
    { key: 'brand_name', value: 'MATTAN' },
    { key: 'tagline', value: 'Quiet luxury, worn daily.' },
    { key: 'about_text', value: 'Mattan is a jewelry brand rooted in restraint. Each piece is designed to be lived in — minimal in form, lasting in material. We work with 18k gold and sterling silver, finished by hand in small batches.' },
    { key: 'brand_story', value: 'Founded on the belief that jewelry should be felt, not announced. Mattan draws from architectural geometry and the textures of everyday wear. No trends, no seasons — just pieces that stay.' },
    { key: 'contact_email', value: 'hello@mattan.com' },
  ];

  for (const s of settingsData) {
    await prisma.siteSetting.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: s.key } },
      update: { value: s.value },
      create: { tenantId: tenant.id, key: s.key, value: s.value },
    });
    console.log('  Setting:', s.key);
  }

  console.log('\nSeed complete.');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });

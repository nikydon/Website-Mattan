require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const { ensureSeeded } = require('./lib/ensureSeed');

const app = express();
const PORT = process.env.PORT || 3000;

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Parse form data and JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Sessions (for admin auth)
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }, // 7 days
}));

// Routes
app.use('/', require('./routes/index'));
app.use('/upload', require('./routes/upload'));
app.use('/admin', require('./routes/admin/index'));

// 404 catch-all
app.use(async (req, res) => {
  const { loadSettings, getDefaultTenant } = require('./lib/settings');
  try {
    const tenant = await getDefaultTenant();
    const settings = tenant ? await loadSettings(tenant.id) : {};
    res.status(404).render('404', { settings });
  } catch {
    res.status(404).send('Not found');
  }
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[error]', err.stack || err);
  res.status(500).send('Internal server error');
});

// Start: seed if empty, then listen
async function start() {
  try {
    await ensureSeeded();
  } catch (err) {
    console.error('[seed] Warning — could not auto-seed:', err.message);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[${new Date().toISOString()}] Server started on 0.0.0.0:${PORT}`);
  });
}

start();

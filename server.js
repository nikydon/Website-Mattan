require('dotenv').config();

const express = require('express');
const path = require('path');
const routes = require('./routes/index');
const uploadRoutes = require('./routes/upload');

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

// Routes
app.use('/', routes);
app.use('/upload', uploadRoutes);

// 404 catch-all
app.use(async (req, res) => {
  const { loadSettings, getDefaultTenant } = require('./lib/settings');
  const tenant = await getDefaultTenant();
  const settings = tenant ? await loadSettings(tenant.id) : {};
  res.status(404).render('404', { settings });
});

// Start server
app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Server started on port ${PORT}`);
});

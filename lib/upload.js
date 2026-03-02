const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const FULL_DIR = path.join(UPLOADS_DIR, 'full');
const THUMB_DIR = path.join(UPLOADS_DIR, 'thumbs');

// Ensure directories exist
for (const dir of [FULL_DIR, THUMB_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

// Multer storage: save with a unique filename
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, FULL_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = crypto.randomBytes(12).toString('hex') + ext;
    cb(null, name);
  },
});

// Only accept images
const fileFilter = (_req, file, cb) => {
  const allowed = /^image\/(jpeg|jpg|png|webp|avif)$/;
  cb(null, allowed.test(file.mimetype));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

/**
 * Generate a thumbnail from an uploaded image.
 * Saves a 600px-wide WebP thumbnail in uploads/thumbs/.
 * Returns the thumbnail filename.
 */
async function generateThumbnail(filename) {
  const inputPath = path.join(FULL_DIR, filename);
  const thumbName = path.parse(filename).name + '.webp';
  const outputPath = path.join(THUMB_DIR, thumbName);

  await sharp(inputPath)
    .resize(600, null, { withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(outputPath);

  return thumbName;
}

module.exports = { upload, generateThumbnail, UPLOADS_DIR, FULL_DIR, THUMB_DIR };

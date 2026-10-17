const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const authMiddleware = require('../middleware/auth');
const { isCloudinaryConfigured, uploadStream } = require('../config/cloudinary');

// In-memory buffer storage: eliminates permanent local disk storage on Render/servers
const storage = multer.memoryStorage();

// Supported image types: JPEG, PNG, WebP, SVG
const ALLOWED_EXTENSIONS = /^(jpeg|jpg|png|webp|svg)$/i;
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml'
];

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB maximum file size
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    const mime = (file.mimetype || '').toLowerCase();

    const isExtAllowed = ALLOWED_EXTENSIONS.test(ext);
    const isMimeAllowed = ALLOWED_MIME_TYPES.includes(mime);

    if (isExtAllowed && isMimeAllowed) {
      return cb(null, true);
    }

    cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and SVG images (up to 5MB) are supported.'));
  }
});

// POST /api/upload - Protected route for uploading player photos
router.post('/', authMiddleware, (req, res, next) => {
  // Wrap multer middleware to catch file-size and validation errors gracefully
  upload.single('image')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'File is too large. Maximum allowed size is 5MB.'
        });
      }
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file uploaded.'
      });
    }

    // Verify Cloudinary credentials exist on the server
    if (!isCloudinaryConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Cloudinary image storage is not configured on the server. Please define CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in server/.env.'
      });
    }

    // Stream image buffer directly to Cloudinary
    const result = await uploadStream(req.file.buffer, {
      folder: process.env.CLOUDINARY_FOLDER || 'hfpl_players',
      resource_type: 'image'
    });

    return res.status(200).json({
      success: true,
      url: result.secure_url,
      secure_url: result.secure_url,
      public_id: result.public_id,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes
    });
  } catch (error) {
    console.error('[Cloudinary Upload Error]:', error.message || error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload image to Cloudinary.'
    });
  }
});

module.exports = router;

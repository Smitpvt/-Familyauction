const cloudinary = require('cloudinary').v2;

/**
 * Checks if all required Cloudinary environment variables are present and non-empty.
 */
const isCloudinaryConfigured = () => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  return Boolean(
    cloudName && cloudName.trim() &&
    apiKey && apiKey.trim() &&
    apiSecret && apiSecret.trim()
  );
};

/**
 * Configures the Cloudinary instance with credentials from environment variables.
 */
const configureCloudinary = () => {
  if (isCloudinaryConfigured()) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME.trim(),
      api_key: process.env.CLOUDINARY_API_KEY.trim(),
      api_secret: process.env.CLOUDINARY_API_SECRET.trim(),
      secure: true
    });
  }
  return cloudinary;
};

// Initialize configuration if variables are present at module load
configureCloudinary();

/**
 * Uploads a file buffer directly to Cloudinary using upload_stream.
 *
 * @param {Buffer} buffer - File buffer from multer memoryStorage
 * @param {Object} options - Cloudinary upload options (folder, etc.)
 * @returns {Promise<Object>} Resolves with Cloudinary upload result object
 */
const uploadStream = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    if (!isCloudinaryConfigured()) {
      return reject(new Error('Cloudinary credentials are not configured on the server.'));
    }

    // Refresh configuration in case environment variables were loaded dynamically
    configureCloudinary();

    const uploadOptions = {
      folder: process.env.CLOUDINARY_FOLDER || 'hfpl_players',
      resource_type: 'image',
      ...options
    };

    const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) {
        return reject(error);
      }
      resolve(result);
    });

    stream.end(buffer);
  });
};

module.exports = {
  cloudinary,
  isCloudinaryConfigured,
  configureCloudinary,
  uploadStream
};

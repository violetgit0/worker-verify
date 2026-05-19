const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Document field names that may receive PDFs
const DOC_FIELDS = ['workerIdDoc', 'g1IdDoc', 'g2IdDoc'];

// Single smart storage: images get compressed, PDFs go as raw
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    if (file.mimetype === 'application/pdf') {
      return {
        folder:        'sage-worker-verify/documents',
        resource_type: 'raw'
      };
    }
    return {
      folder:          DOC_FIELDS.includes(file.fieldname)
                         ? 'sage-worker-verify/documents'
                         : 'sage-worker-verify/photos',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation:  [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto' }]
    };
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, fieldSize: 5 * 1024 * 1024 }, // 10 MB files, 5 MB text fields
  fileFilter: (req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
      'application/pdf'
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type "${file.mimetype}" is not allowed. Use JPG, PNG, WebP or PDF.`), false);
    }
  }
});

const workerUpload = upload.fields([
  { name: 'passportPhoto',    maxCount: 1 },
  { name: 'housePhoto',       maxCount: 1 },  // legacy compat
  { name: 'housePhotos',      maxCount: 5 },  // multiple house photos
  { name: 'streetPhotos',     maxCount: 5 },  // street / environment photos
  { name: 'workerIdDoc',      maxCount: 1 },
  { name: 'g1PassportPhoto',  maxCount: 1 },
  { name: 'g1HousePhoto',     maxCount: 1 },  // legacy compat
  { name: 'g1HousePhotos',    maxCount: 5 },
  { name: 'g1StreetPhotos',   maxCount: 5 },
  { name: 'g1IdDoc',          maxCount: 1 },
  { name: 'g2PassportPhoto',  maxCount: 1 },
  { name: 'g2HousePhoto',     maxCount: 1 },  // legacy compat
  { name: 'g2HousePhotos',    maxCount: 5 },
  { name: 'g2StreetPhotos',   maxCount: 5 },
  { name: 'g2IdDoc',          maxCount: 1 }
]);

const singleUpload = upload.single('passportPhoto');

// Selfie upload for attendance anti-spoofing (smaller, face-cropped)
const selfieStorage = new CloudinaryStorage({
  cloudinary,
  params: async () => ({
    folder: 'sage-worker-verify/selfies',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 500, height: 500, crop: 'fill', gravity: 'face', quality: 'auto:good' }]
  })
});

const selfieUpload = multer({
  storage: selfieStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for attendance selfie'), false);
    }
  }
}).single('selfie');

// Upload a base64 data URL directly to Cloudinary (used for drawn/uploaded signatures)
const uploadDataUrl = (dataUrl, folder = 'sage-worker-verify/signatures') => {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return Promise.resolve(null);
  return cloudinary.uploader.upload(dataUrl, {
    folder,
    resource_type: 'image',
    transformation: [{ width: 900, height: 400, crop: 'limit', quality: 'auto' }]
  });
};

module.exports = { cloudinary, upload, workerUpload, singleUpload, selfieUpload, uploadDataUrl };

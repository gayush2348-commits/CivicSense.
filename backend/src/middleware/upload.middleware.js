import multer from "multer";

const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];

const fileFilter = (_req, file, callback) => {
  if (!allowedMimeTypes.includes(file.mimetype)) {
    const error = new Error("Only JPEG, PNG and WebP images are allowed");

    error.statusCode = 400;
    return callback(error);
  }

  callback(null, true);
};

const storage = multer.memoryStorage();

export const uploadComplaintImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
});

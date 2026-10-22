import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";

export const uploadImageToCloudinary = (file) => {
  if (!file?.buffer) {
    throw new Error("Image buffer is missing");
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "civicsense/complaints",
        resource_type: "image",
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result?.secure_url) {
          return reject(new Error("Cloudinary returned no image URL"));
        }

        resolve(result.secure_url);
      },
    );

    Readable.from(file.buffer).pipe(uploadStream);
  });
};

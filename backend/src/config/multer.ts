import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

// ensure uploads folder exists
const uploadPath = path.join(__dirname, "../../uploads");

if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

// `file.mimetype` is whatever the client declared in the multipart headers, so it
// cannot be trusted on its own: a browser-executable payload sent as
// `Content-Type: image/png` used to be stored as `.html` and later served back from
// /uploads as text/html — stored XSS on the API origin. Gate on the extension we are
// willing to write, and derive the stored name ourselves.
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".m4v", ".webm", ".qt"]);

const rejection = (message: string) => Object.assign(new Error(message), { isUploadRejection: true });

const extensionOf = (file: Express.Multer.File) => path.extname(file.originalname).toLowerCase();

const makeFilter = (allowed: Set<string>, mimePrefixes: string[], label: string): multer.Options["fileFilter"] =>
  (_req, file, cb) => {
    const ext = extensionOf(file);
    const mimeOk = mimePrefixes.some(p => file.mimetype.startsWith(p));

    if (!allowed.has(ext) || !mimeOk) {
      return cb(rejection(`Only ${label} files are allowed`));
    }
    cb(null, true);
  };

// Random stored name: never derived from client input, and always carries a
// known-safe extension. Also stops one upload from guessing/overwriting another.
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadPath),
  filename: (_req, file, cb) => {
    const ext = extensionOf(file);
    cb(null, `${Date.now()}-${crypto.randomBytes(12).toString("hex")}${ext}`);
  },
});

const imageFilter = makeFilter(IMAGE_EXTENSIONS, ["image/"], "image");
const mediaFilter = makeFilter(
  new Set([...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS]),
  ["image/", "video/"],
  "image and video",
);

// profile / cover images
export const upload = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 2 },
});

// photos + videos, larger limit
export const uploadMedia = multer({
  storage,
  fileFilter: mediaFilter,
  limits: { fileSize: 60 * 1024 * 1024, files: 1 },
});

// message image (images only, generous limit for full-res phone photos)
export const uploadMessageImage = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
});

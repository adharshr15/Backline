import { Router } from 'express';
import path from 'path';

const router = Router();

// Resolve absolute path to uploads folder
// __dirname = ...\backend\src\routes  ->  ../../uploads = backend/uploads
const uploadsPath = path.resolve(__dirname, '../../uploads');

router.get('/:filename', (req, res) => {
  const { filename } = req.params;

  // `root` makes send() resolve and contain the path itself, and reject anything
  // that escapes the directory. Belt-and-braces with the basename below.
  const safeName = path.basename(filename);

  // Uploaded files are user content: never let a browser sniff or execute them.
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");

  res.sendFile(safeName, { root: uploadsPath, dotfiles: 'deny' }, (err: NodeJS.ErrnoException | undefined) => {
    if (!err) return;

    // Client aborted mid-stream (common with video seeking / player teardown) —
    // headers are already sent, so don't try to respond again.
    if (res.headersSent || req.aborted || (err as any).code === 'ECONNABORTED') {
      return;
    }

    console.error('Error sending file:', err.message);
    res.status(404).json({ error: 'File not found' });
  });
});

export default router;

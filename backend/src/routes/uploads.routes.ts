import { Router } from 'express';
import path from 'path';

const router = Router();

// Resolve absolute path to uploads folder
const uploadsPath = path.resolve(__dirname, '../../uploads'); 
// __dirname = ...\backend\src\routes
// ../../uploads moves up to backend/uploads

router.get('/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(uploadsPath, filename);

  res.sendFile(filePath, (err: NodeJS.ErrnoException | undefined) => {
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
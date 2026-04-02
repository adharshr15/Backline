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

  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error sending file:', err);
      res.status(404).json({ error: 'File not found' });
    }
  });
});

export default router;
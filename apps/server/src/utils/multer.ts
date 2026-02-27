import multer from 'multer'

// Multer config for memory storage (processing files in memory without saving to disk first)
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
})

import { Request, Response, NextFunction } from "express"
import multer from "multer"

/**
 * Controllers previously answered failures with `res.status(500).json({ error: error.message })`,
 * which forwards Prisma/driver internals (table names, column names, connection strings) to the
 * client. `fail` keeps the detail in the server log and returns a generic message.
 */
export const fail = (res: Response, error: unknown, context: string) => {
  console.error(`${context}:`, error)
  return res.status(500).json({ error: "Internal server error" })
}

export const notFound = (_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" })
}

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  if (res.headersSent) return next(err)

  // Multer surfaces upload problems (size limit, unexpected field) as MulterError,
  // and our fileFilter rejections as a plain Error. Both are client mistakes, not 500s.
  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE"
      ? "File is too large"
      : `Upload error: ${err.code}`
    return res.status(400).json({ error: message })
  }

  if (err?.isUploadRejection) {
    return res.status(400).json({ error: err.message })
  }

  console.error("Unhandled error:", err)
  res.status(500).json({ error: "Internal server error" })
}

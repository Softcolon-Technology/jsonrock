import mongoose from 'mongoose'
import logger from '../config/logger'

export const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI
    if (!uri) {
      throw new Error('MONGODB_URI is not defined in environment variables')
    }
    await mongoose.connect(uri)
    logger.info('mongodb database connected successfully')
  } catch (err) {
    logger.error('Database connection error:', err)
    throw err
  }
}

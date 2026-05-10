import mongoose from 'mongoose';
import { env } from './env';

const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY_MS = 2000;

export async function connectDatabase() {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Add connection options for better reliability
      await mongoose.connect(env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
        socketTimeoutMS: 45000,
        family: 4, // Use IPv4, skip trying IPv6
      });
      console.log('✅ Connected to MongoDB');
      return; // Success — exit the retry loop
    } catch (error: any) {
      lastError = error;
      const isLastAttempt = attempt === MAX_RETRIES;

      if (isLastAttempt) {
        console.error(`❌ MongoDB connection failed after ${MAX_RETRIES} attempts`);
        console.error('💡 Troubleshooting tips:');
        console.error('   1. Check if MongoDB Atlas cluster is running (not paused)');
        console.error('   2. Whitelist your IP in MongoDB Atlas Network Access');
        console.error('   3. Verify credentials in .env file');
        console.error('   4. Test connection with your MongoDB URI from .env');
        throw error;
      }

      // Exponential backoff: 2s, 4s, 8s, 16s
      const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      console.warn(
        `⚠️  MongoDB connection attempt ${attempt}/${MAX_RETRIES} failed. Retrying in ${delay / 1000}s...`
      );
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

mongoose.connection.on('disconnected', () => {
  console.log('⚠️  MongoDB disconnected');
});

mongoose.connection.on('error', (error) => {
  console.error('❌ MongoDB error:', error);
});

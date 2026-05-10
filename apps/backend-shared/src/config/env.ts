import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  PORT: z.string().default('3001'),
  MONGODB_URI: z.string(),
  BACKEND_WALLET_PUBLIC_KEY: z.string(),
  BACKEND_WALLET_PRIVATE_KEY: z.string(),
  SOLANA_RPC_URL: z.string().default('https://api.devnet.solana.com'),
  JUPITER_API_KEYS: z.string(),
  ADMIN_SECRET: z.string().default('dev-admin-secret-change-me'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables');
}

export const env = {
  ...parsed.data,
  PORT: parseInt(parsed.data.PORT),
  BACKEND_WALLET_PRIVATE_KEY_ARRAY: JSON.parse(parsed.data.BACKEND_WALLET_PRIVATE_KEY),
  JUPITER_API_KEYS_ARRAY: parsed.data.JUPITER_API_KEYS.split(',').map(k => k.trim()),
};

export type Env = typeof env;

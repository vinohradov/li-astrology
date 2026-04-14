import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string().min(1),
  ADMIN_IDS: z.string().transform(s => s.split(',').map(Number)),
  MEDIA_CHANNEL_ID: z.string().optional(),
  PORT: z.string().default('3000').transform(Number),
});

export const config = envSchema.parse(process.env);
export type Config = z.infer<typeof envSchema>;

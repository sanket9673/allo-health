import { Redis } from '@upstash/redis';

// Only instantiate Redis if the environment variables are present
export const redis = process.env.UPSTASH_REDIS_REST_URL 
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

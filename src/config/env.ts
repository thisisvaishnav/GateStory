import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

// Load .env then .env.local
const envLocalPath = path.resolve(process.cwd(), ".env.local");
const envPath = path.resolve(process.cwd(), ".env");

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true });
}

const envSchema = z.object({
  PORT: z.coerce.number().default(4321),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Ring Credentials
  RING_CLIENT_ID: z.string().optional().default(""),
  RING_CLIENT_SECRET: z.string().optional().default(""),
  RING_HMAC_KEY: z.string().optional().default(""),
  RING_PLAYGROUND_TOKEN: z.string().optional().default(""),
  RING_DEVICE_ID: z.string().optional().default(""),

  // AWS Configuration
  AWS_REGION: z.string().default("us-east-1"),
  AWS_ACCESS_KEY_ID: z.string().optional().default(""),
  AWS_SECRET_ACCESS_KEY: z.string().optional().default(""),
  DYNAMODB_TABLE_NAME: z.string().default("gatestory-main"),

  // Feature Flags
  NOVA_ENRICHMENT_FLAG: z
    .preprocess((val) => val === "true" || val === true || val === "1", z.boolean())
    .default(false),
});

export type Config = z.infer<typeof envSchema>;

export const config: Config = envSchema.parse(process.env);

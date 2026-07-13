/// <reference types="astro/client" />

type Env = {
  DB: D1Database;
  FILES: R2Bucket;
  RESEND_API_KEY: string;
  CSRF_SECRET: string;
  EMAIL_FROM: string;
  EMAIL_REPLY_TO: string;
  CONTACT_TO: string;
};

declare namespace App {
  interface Locals {
    runtime: { env: Env };
    adminEmail?: string;
  }
}

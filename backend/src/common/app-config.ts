/** Environment-backed config (replaces @nestjs/config ConfigService). */
export type KnownAppEnv = {
  NEXT_PUBLIC_APP_URL?: string;
  PUBLIC_APP_URL?: string;
  PAYMENTS_WEBHOOK_SECRET?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  SES_SMTP_HOST?: string;
  SES_SMTP_PORT?: string;
  SES_SMTP_USERNAME?: string;
  SES_SMTP_PASSWORD?: string;
  BUNNY_STREAM_LIBRARY_ID?: string;
  BUNNY_STREAM_EMBED_TOKEN_KEY?: string;
  BUNNY_STREAM_EMBED_HOST?: string;
  BUNNY_STREAM_EMBED_TTL_SECONDS?: string;
  /** Bunny Stream video GUID for the public website homepage hero player. */
  WEBSITE_HERO_BUNNY_VIDEO_ID?: string;
};

export type AppConfig = {
  get<K extends keyof KnownAppEnv>(key: K, defaultValue?: KnownAppEnv[K]): KnownAppEnv[K] | undefined;
  get<T = string>(key: string, defaultValue?: T): T | undefined;
};

export const appConfig: AppConfig = {
  get<T = string>(key: string, defaultValue?: T): T | undefined {
    const v = process.env[key];
    if (v === undefined || v === "") {
      return defaultValue;
    }
    return v as T;
  }
};

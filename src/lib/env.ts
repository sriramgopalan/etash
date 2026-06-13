import { z } from "zod";

const schema = z
  .object({
    DATABASE_URL: z.string().min(1),
    AUTH_SECRET: z.string().min(1),
    AUTH_URL: z.string().url().optional(),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    GITHUB_CLIENT_ID: z.string().min(1),
    GITHUB_CLIENT_SECRET: z.string().min(1),
    RESEND_API_KEY: z.string().min(1),
    RESEND_FROM: z.string().email(),
    REDIS_URL: z.string().min(1),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace"])
      .default("info"),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  })
  .superRefine((data, ctx) => {
    if (
      data.NODE_ENV === "production" &&
      data.AUTH_URL &&
      !data.AUTH_URL.startsWith("https://")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["AUTH_URL"],
        message: "AUTH_URL must use HTTPS in production",
      });
    }
  });

const result = schema.safeParse(process.env);

if (!result.success) {
  if (process.env["NODE_ENV"] !== "test") {
    throw new Error(
      `Invalid environment variables:\n${result.error.flatten().fieldErrors
        ? JSON.stringify(result.error.flatten().fieldErrors, null, 2)
        : result.error.message}`,
    );
  }
}

export const env = result.success
  ? result.data
  : ({
      DATABASE_URL:
        process.env["DATABASE_URL"] ??
        "postgresql://postgres:postgres@localhost:5432/etash_test",
      AUTH_SECRET: process.env["AUTH_SECRET"] ?? "test-secret-32-chars-min!!",
      AUTH_URL: process.env["AUTH_URL"],
      GOOGLE_CLIENT_ID: process.env["GOOGLE_CLIENT_ID"] ?? "test-gid",
      GOOGLE_CLIENT_SECRET: process.env["GOOGLE_CLIENT_SECRET"] ?? "test-gsec",
      GITHUB_CLIENT_ID: process.env["GITHUB_CLIENT_ID"] ?? "test-ghid",
      GITHUB_CLIENT_SECRET:
        process.env["GITHUB_CLIENT_SECRET"] ?? "test-ghsec",
      RESEND_API_KEY: process.env["RESEND_API_KEY"] ?? "re_test",
      RESEND_FROM: process.env["RESEND_FROM"] ?? "noreply@etash.com",
      REDIS_URL: process.env["REDIS_URL"] ?? "redis://localhost:6379",
      LOG_LEVEL: "error" as const,
      NODE_ENV: "test" as const,
    } satisfies z.infer<typeof schema>);

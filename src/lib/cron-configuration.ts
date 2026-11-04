/** Server-side, read-only configuration. Never returns any secret or calls a job. */
export const CRON_JOBS = [
  { name: "Inventory and prices", path: "/api/cron/refresh-prices", schedule: "0 6 * * *", timeUtc: "06:00 UTC daily" },
  { name: "Newsletter eligibility check", path: "/api/cron/newsletter", schedule: "0 7 * * *", timeUtc: "07:00 UTC daily" },
] as const;

export function getCronConfiguration() {
  const value = process.env.VERCEL_ENV;
  const environment = value === "production" || value === "preview" || value === "development"
    ? value
    : process.env.VERCEL ? "unknown" : "sandbox";

  return {
    cronSecretConfigured: Boolean(process.env.CRON_SECRET?.trim()),
    environment,
    vercelProductionDeployment: Boolean(process.env.VERCEL) && environment === "production",
    jobs: CRON_JOBS,
    configurationOnly: true as const,
  };
}

export type CronConfiguration = ReturnType<typeof getCronConfiguration>;

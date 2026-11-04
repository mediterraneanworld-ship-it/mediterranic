import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getCronConfiguration } from "@/lib/cron-configuration";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store" };

/** Authentication + environment inspection only: no database or mailer imports. */
export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized." }, { status: 401, headers });
  }
  return Response.json(getCronConfiguration(), { headers });
}

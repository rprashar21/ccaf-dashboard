import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Deploy and CI smoke check: the process is up and the database answers. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "degraded", database: "unreachable" }, { status: 503 });
  }
}

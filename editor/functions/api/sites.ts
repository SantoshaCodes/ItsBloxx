/**
 * GET /api/sites — List all unique site names from R2
 * Returns: { sites: ["goforma", "my-yoga-studio", ...] }
 */

interface Env {
  BLOXX_SITES: R2Bucket;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const listed = await context.env.BLOXX_SITES.list({ delimiter: '/' });

  // R2 list with delimiter='/' returns common prefixes as "delimitedPrefixes"
  const sites: string[] = (listed.delimitedPrefixes || []).map((prefix: string) =>
    prefix.replace(/\/$/, '')
  );

  return Response.json({ sites });
};

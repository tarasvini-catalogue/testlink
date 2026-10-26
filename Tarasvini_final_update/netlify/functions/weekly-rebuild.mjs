// Rebuilds the site once a week so product pages and the Google Shopping feed
// pick up changes made in the Google Sheet. The home page catalogue is always live.
// Setup: Netlify > Site configuration > Build & deploy > Build hooks > Add build hook,
// then Site configuration > Environment variables > add BUILD_HOOK_URL with that link.
export default async () => {
  const url = process.env.BUILD_HOOK_URL;
  if (!url) { console.log("BUILD_HOOK_URL is not set, skipping weekly rebuild"); return new Response("not set"); }
  const r = await fetch(url, { method: "POST" });
  console.log("Weekly rebuild requested:", r.status);
  return new Response("ok");
};
export const config = { schedule: "0 2 * * 1" }; // Mondays 02:00 UTC (07:30 in India)

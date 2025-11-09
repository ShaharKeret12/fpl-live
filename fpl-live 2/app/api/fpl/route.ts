export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path");
  if (!path) return new Response("Missing path", { status: 400 });

  const upstream = await fetch(`https://fantasy.premierleague.com/api/${path}`, {
    headers: { "User-Agent": "Mozilla/5.0 FPL-Live-Tracker" },
    cache: "no-store",
  });

  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") || "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

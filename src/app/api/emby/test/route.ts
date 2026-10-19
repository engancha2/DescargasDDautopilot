export async function POST(request: Request) {
  const { url, apiKey } = await request.json();

  try {
    const res = await fetch(`${url}/System/Info?api_key=${apiKey}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Response.json({
      success: true,
      serverName: data.ServerName,
      version: data.Version,
      os: data.OperatingSystemDisplayName,
    });
  } catch (e) {
    return Response.json({ success: false, error: (e as Error).message });
  }
}

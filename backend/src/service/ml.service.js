const ML_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8001";

export async function analyzeComplaint(payload) {
  const response = await fetch(`${ML_SERVICE_URL}/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "bypass-tunnel-reminder": "true",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`ML analysis failed with status ${response.status}`);
  }

  return response.json();
}

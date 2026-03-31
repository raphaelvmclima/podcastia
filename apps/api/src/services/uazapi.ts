// Send text via UAZAPI using user's instance token
export async function sendWhatsAppText(number: string, text: string, token: string, baseUrl: string = "https://loumarturismo.uazapi.com") {
  const res = await fetch(`${baseUrl}/send/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json", token },
    body: JSON.stringify({ number, text }),
  });
  return res.json();
}

// Send audio via UAZAPI (base64) using user's instance token
export async function sendWhatsAppAudio(number: string, audioBase64: string, token: string, baseUrl: string = "https://loumarturismo.uazapi.com") {
  const res = await fetch(`${baseUrl}/send/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", token },
    body: JSON.stringify({ number, type: "audio", file: audioBase64 }),
  });
  return res.json();
}

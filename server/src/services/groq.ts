import { config } from "../config/env";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

/**
 * Llama a la API de Groq (compatible con el formato de OpenAI Chat Completions)
 * usando un modelo open-source gratuito (Llama 3.3 70B).
 * Pide la respuesta en JSON estricto.
 */
export async function askGroqJson(
  systemPrompt: string,
  userPrompt: string
): Promise<unknown> {
  if (!config.groqApiKey) {
    throw new Error(
      "GROQ_API_KEY no configurada. Agrega tu clave gratuita de https://console.groq.com en server/.env"
    );
  }

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.groqApiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Error de Groq (${response.status}): ${text}`);
  }

  const body = await response.json();
  const content = body?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Groq no devolvio contenido");
  }

  try {
    return JSON.parse(content);
  } catch {
    throw new Error("Groq no devolvio un JSON valido");
  }
}

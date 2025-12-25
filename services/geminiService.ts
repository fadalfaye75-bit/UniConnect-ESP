
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { API } from "./api";

export async function* generateAIResponseStream(prompt: string, context: string) {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Récupérer les réglages configurés par l'admin
    const settings = await API.settings.getAI();
    
    if (!settings.isActive) {
      yield "Le service d'assistance IA est actuellement désactivé par l'administrateur.";
      return;
    }

    const verbosityInstruction = settings.verbosity === 'low' 
      ? "Sois très bref, limite-toi à une phrase si possible." 
      : settings.verbosity === 'high' 
      ? "Fournis des explications détaillées et complètes." 
      : "Réponds de manière équilibrée.";

    const toneInstruction = settings.tone === 'academic'
      ? "Utilise un ton formel et académique."
      : settings.tone === 'friendly'
      ? "Sois amical et encourageant, utilise des émojis pertinents."
      : settings.tone === 'concise'
      ? "Va droit au but, sans fioritures."
      : "Sois poli et serviable.";

    const systemInstruction = `
      ${settings.customInstructions}
      Ton ton : ${toneInstruction}
      Niveau de détail : ${verbosityInstruction}
      Réponds toujours en français.
      Tu es l'assistant officiel de la plateforme JangHup pour l'ESP Dakar.
    `;

    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: `Context: ${context}\n\nUser Question: ${prompt}`,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      },
    });

    for await (const chunk of responseStream) {
      const part = chunk as GenerateContentResponse;
      // S'assurer de toujours renvoyer une chaîne de caractères
      const text = part.text;
      if (typeof text === 'string') {
        yield text;
      } else if (text !== undefined) {
        yield String(text);
      }
    }
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    const errorMessage = error?.message || "Désolé, une erreur technique est survenue avec l'IA.";
    yield typeof errorMessage === 'string' ? errorMessage : "Erreur inconnue de l'IA.";
  }
}

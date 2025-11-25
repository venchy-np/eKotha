import { GoogleGenAI, Type } from "@google/genai";
import { Room } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- AI Search Feature ---
export const searchRoomsWithAI = async (query: string, availableRooms: Room[]): Promise<string[]> => {
  if (!query) return availableRooms.map(r => r.id);

  try {
    const roomsContext = availableRooms.map(r => ({
      id: r.id,
      description: `${r.title} in ${r.location}. Features: ${r.features.join(', ')}. Price: ${r.price}. Description: ${r.description}`
    }));

    const prompt = `
      You are a real estate assistant for Nepal.
      User Query: "${query}"
      
      Here is the list of available rooms in JSON format:
      ${JSON.stringify(roomsContext)}
      
      Return a JSON array of room IDs that best match the user's query, ordered by relevance.
      Only return the JSON array of strings. Example: ["1", "3"]
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text);
  } catch (error) {
    console.error("AI Search Error:", error);
    // Fallback: simple text match
    return availableRooms
      .filter(r => r.title.toLowerCase().includes(query.toLowerCase()) || r.location.toLowerCase().includes(query.toLowerCase()))
      .map(r => r.id);
  }
};

// --- AI KYC Verification ---
export const verifyKYCWithAI = async (idImageBase64: string, selfieImageBase64: string): Promise<{ verified: boolean; reason: string }> => {
  try {
    const prompt = `
      Analyze these two images. 
      Image 1 is a Government ID card (possibly from Nepal, like Citizenship or License).
      Image 2 is a Selfie.
      
      Task:
      1. Verify if Image 1 looks like a valid ID document.
      2. Verify if the person in the Selfie (Image 2) appears to be the same person as in the ID photo (Image 1).
      
      Be strict but reasonable. 
      Return JSON: { "verified": boolean, "reason": "string explaining the decision" }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', // Multimodal model
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: 'image/jpeg', data: idImageBase64 } },
          { inlineData: { mimeType: 'image/jpeg', data: selfieImageBase64 } }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                verified: { type: Type.BOOLEAN },
                reason: { type: Type.STRING }
            }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    return JSON.parse(text);

  } catch (error) {
    console.error("KYC Error:", error);
    return { verified: false, reason: "AI Service unavailable. Please try again later." };
  }
};

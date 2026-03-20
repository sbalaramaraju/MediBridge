import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface EmergencyCardData {
  patientSummary: {
    age: string;
    conditions: string[];
    medications: string[];
  };
  situation: string;
  actions: string[];
  warnings: string[];
  language: string;
}

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    patientSummary: {
      type: Type.OBJECT,
      properties: {
        age: { type: Type.STRING, description: "Estimated age or 'Unknown'" },
        conditions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Known medical conditions" },
        medications: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Current medications" }
      },
      required: ["age", "conditions", "medications"]
    },
    situation: { type: Type.STRING, description: "Brief classification of the medical situation" },
    actions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Numbered, prioritized immediate actions" },
    warnings: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Red flag warnings or drug interactions" },
    language: { type: Type.STRING, description: "Detected language of the input" }
  },
  required: ["patientSummary", "situation", "actions", "warnings", "language"]
};

export async function processMedicalInput(
  input: string | { data: string; mimeType: string },
  isMultimodal: boolean = false
): Promise<EmergencyCardData> {
  const model = "gemini-3-flash-preview";
  
  const systemInstruction = `
    You are an emergency medical context translator. 
    Your goal is to extract critical medical information from unstructured input (text, voice transcript, or images of medical documents/prescriptions).
    Output a structured Emergency Action Card.
    Be concise, accurate, and prioritize life-saving actions.
    If information is missing, use "Unknown" or "Not specified".
    Always detect the input language and provide the output in English, but note the original language.
  `;

  const contents = isMultimodal && typeof input !== 'string'
    ? { parts: [{ inlineData: input }, { text: "Analyze this medical information and generate an emergency action card." }] }
    : typeof input === 'string' 
      ? input 
      : "";

  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema
    }
  });

  if (!response.text) {
    throw new Error("No response from Gemini");
  }

  return JSON.parse(response.text) as EmergencyCardData;
}

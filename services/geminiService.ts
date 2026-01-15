import { GoogleGenAI } from "@google/genai";

const SYSTEM_INSTRUCTION_CHAT = `You are the intelligent assistant for the "CollegeBus Tracker" app. 
Your goal is to help students, parents, and admins with transport-related queries.
You can answer questions about bus schedules (assume standard 8 AM - 4 PM college timing), safety protocols, and general college transport FAQs.
Keep answers concise, friendly, and helpful. Tone should be professional yet accessible.`;

const SYSTEM_INSTRUCTION_IMAGE = `You are a visual assistant for the "CollegeBus Tracker" app.
Analyze the image provided. 
If it looks like a lost item, describe it in detail for the "Lost & Found" system.
If it looks like a printed bus schedule or notice, extract the key dates and times.
If it looks like a maintenance issue, describe the condition.
Keep the response structured and actionable.`;

/**
 * Helper to determine if an error is an AbortError/Network interruption
 */
const isNetworkError = (error: any): boolean => {
  const message = error?.message?.toLowerCase() || '';
  return (
    message.includes('aborted') || 
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('signal is aborted') || 
    message.includes('without reason') || 
    error?.name === 'AbortError'
  );
};

export const sendChatMessage = async (message: string, history: { sender: 'user' | 'bot', text: string }[]): Promise<string> => {
  try {
    // ALWAYS use process.env.API_KEY directly for initialization
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    
    const contents = history.slice(-6).map(h => ({
      role: h.sender === 'user' ? 'user' : 'model',
      parts: [{ text: h.text }]
    }));

    contents.push({ role: 'user', parts: [{ text: message }] });

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION_CHAT,
        temperature: 0.7,
      }
    });
    return response.text || "I couldn't generate a response.";
  } catch (error: any) {
    if (isNetworkError(error)) {
      console.warn("Gemini Network/Abort Error detected. Likely transient.");
      return "I'm having a bit of trouble connecting to the network. Please try your message again in a moment.";
    }
    console.error("Gemini Chat Error:", error);
    return "Sorry, I'm having trouble connecting to my brain. Please try again later.";
  }
};

export const analyzeImage = async (base64Image: string, prompt: string): Promise<string> => {
  try {
    // Fix: Re-initialize client to ensure latest API context is used
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      // Fix: Follow strictly defined contents structure for multi-part vision prompts
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image
            }
          },
          { text: prompt || "Analyze this image for the college transport system." }
        ]
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION_IMAGE
      }
    });
    return response.text || "Analysis complete, but no description generated.";
  } catch (error: any) {
    if (isNetworkError(error)) {
      console.warn("Gemini Image Analysis Network Error detected.");
      return "The image analysis failed due to a connection issue. Please check your internet and try again.";
    }
    console.error("Gemini Image Error:", error);
    return "Failed to analyze the image. Please ensure it's a clear photo.";
  }
};
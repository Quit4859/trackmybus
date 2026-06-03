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
    const response = await fetch("/api/gemini/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, history }),
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.text || "I couldn't generate a response.";
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
    const response = await fetch("/api/gemini/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ base64Image, prompt }),
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.text || "Analysis complete, but no description generated.";
  } catch (error: any) {
    if (isNetworkError(error)) {
      console.warn("Gemini Image Analysis Network Error detected.");
      return "The image analysis failed due to a connection issue. Please check your internet and try again.";
    }
    console.error("Gemini Image Error:", error);
    return "Failed to analyze the image. Please ensure it's a clear photo.";
  }
};
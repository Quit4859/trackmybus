import express from "express";
import { GoogleGenAI } from "@google/genai";

const app = express();

// Crucial: Use standard body-parsers for API routes with proper limit for images
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// SEO Redirection Middleware: 301 Redirect non-www (bustracker.tech) to canonical www (www.bustracker.tech)
app.use((req, res, next) => {
  const host = req.headers.host || "";
  const hostname = host.split(":")[0].toLowerCase();
  if (hostname === "bustracker.tech") {
    return res.redirect(301, `https://www.bustracker.tech${req.originalUrl}`);
  }
  next();
});

// Initialize secure Gemini API via lazy initialization on the server side
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY or API_KEY environment variable is required to use the Gemini features.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

const SYSTEM_INSTRUCTION_CHAT = `You are the intelligent assistant for the "College Bus Tracker" app. 
Your goal is to help students, parents, and admins with transport-related queries.
Your answers can reference bus schedules (assume standard 8 AM - 4 PM college timing), safety protocols, and general college transport FAQs.
Keep answers concise, friendly, and helpful. Tone should be professional yet accessible.`;

const SYSTEM_INSTRUCTION_IMAGE = `You are a visual assistant for the "College Bus Tracker" app.
Analyze the image provided. 
If it looks like a lost item, describe it in detail for the "Lost & Found" system.
If it looks like a printed bus schedule or notice, extract the key dates and times.
If it looks like a maintenance issue, describe the condition.
Keep the response structured and actionable.`;

// API Endpoints
app.post("/api/gemini/chat", async (req, res) => {
  try {
    const { message, history, appContext } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    // Reformat history to what @google/genai expects
    const contents = (history || []).slice(-6).map((h: any) => ({
      role: h.sender === "user" ? "user" : "model",
      parts: [{ text: h.text }],
    }));

    contents.push({ role: "user", parts: [{ text: message }] });

    // Compile rich system instructions with dynamic state from appContext if available
    let systemInstruction = SYSTEM_INSTRUCTION_CHAT;
    if (appContext && appContext.routes && Array.isArray(appContext.routes)) {
      let routeCtx = "\n\n----- REAL-TIME COLLEGE BUSES STATE -----\n";
      appContext.routes.forEach((r: any) => {
        routeCtx += `Route: "${r.name}" (ID: ${r.id})\n`;
        routeCtx += `- Driver: ${r.driver || "N/A"} (${r.driverPhone || "N/A"})\n`;
        routeCtx += `- Bus Plate: ${r.numberPlate || "N/A"}\n`;
        routeCtx += `- Tracking Status: ${r.isLive ? "ONLINE (Live Tracking Active)" : "OFFLINE / STATIONARY"}\n`;
        routeCtx += `- Current Route Direction Mode: Traveling in "${r.direction || "morning"}" direction\n`;
        routeCtx += `- Current Bus Location ETA: ${r.eta || "N/A"}\n`;
        routeCtx += `- Stops along this route (in travel order):\n`;
        
        const stopsToPrint = r.stops || [];
        stopsToPrint.forEach((s: any) => {
          const morningTime = s.time || "N/A";
          const eveningTime = r.eveningTimes?.[s.id] || "N/A";
          routeCtx += `  * Stop ID ${s.id}: "${s.name}" -> Morning Pick-up: ${morningTime} | Evening Drop-off: ${eveningTime} | Current Stop Status: ${s.status || "N/A"}\n`;
        });
        routeCtx += "\n";
      });
      routeCtx += "-----------------------------------------\n";
      systemInstruction = `${SYSTEM_INSTRUCTION_CHAT}\n${routeCtx}\nIMPORTANT: Reference specific stop names, pick-up/drop-off schedules, driver contacts, and tracking statistics from the above lists when responding to queries. Keep responses helpful and clear.`;
    }

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      },
    });

    return res.json({ text: response.text || "I couldn't generate a response." });
  } catch (error: any) {
    console.error("Server-side Gemini Chat Error:", error);
    return res.status(500).json({
      error: "Failed to communicate with Gemini API.",
      details: error.message,
    });
  }
});

app.post("/api/gemini/analyze", async (req, res) => {
  try {
    const { base64Image, prompt } = req.body;
    if (!base64Image) {
      return res.status(400).json({ error: "base64Image is required." });
    }

    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image,
            },
          },
          { text: prompt || "Analyze this image for the college transport system." },
        ],
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION_IMAGE,
      },
    });

    return res.json({ text: response.text || "Analysis complete, but no description generated." });
  } catch (error: any) {
    console.error("Server-side Gemini Image Error:", error);
    return res.status(500).json({
      error: "Failed to analyze image with Gemini API.",
      details: error.message,
    });
  }
});

export default app;

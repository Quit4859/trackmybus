import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Crucial: Use standard body-parsers for API routes with proper limit for images
  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ extended: true, limit: "15mb" }));

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
You can answer questions about bus schedules (assume standard 8 AM - 4 PM college timing), safety protocols, and general college transport FAQs.
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
      const { message, history } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Message is required." });
      }

      // Reformat history to what @google/genai expects
      const contents = (history || []).slice(-6).map((h: any) => ({
        role: h.sender === "user" ? "user" : "model",
        parts: [{ text: h.text }],
      }));

      contents.push({ role: "user", parts: [{ text: message }] });

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION_CHAT,
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

  // Vite Middleware Setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // Support React Router index fallback in v4/v5 (use '*all' for standard fallback in Express v5)
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

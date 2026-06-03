import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

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
You can answer questions about bus schedules, routes, stops, active safety/emergency alerts, and helper contacts.
Keep answers concise, friendly, helpful, and highly accurate. Tone should be professional yet accessible.`;

  const SYSTEM_INSTRUCTION_IMAGE = `You are a visual assistant for the "College Bus Tracker" app.
Analyze the image provided. 
If it looks like a lost item, describe it in detail for the "Lost & Found" system.
If it looks like a printed bus schedule or notice, extract the key dates and times.
If it looks like a maintenance issue, describe the condition.
Keep the response structured and actionable.`;

  // Helper for cascading model fallback to handle temporary 503 high-demand errors gracefully
  async function generateContentWithFallback(ai: any, params: any) {
    const models = ["gemini-2.5-flash", "gemini-3.5-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
    let lastError: any = null;

    for (const modelName of models) {
      try {
        const response = await ai.models.generateContent({
          ...params,
          model: modelName,
        });
        return response;
      } catch (err: any) {
        console.warn(`Gemini Model ${modelName} failed or returned high-demand error. Retrying next model. Error details:`, err.message || err);
        lastError = err;
        const errStr = String(err.message || "").toLowerCase();
        // Do not fallback on terminal errors like invalid API keys or bad requests
        if (errStr.includes("api_key_invalid") || errStr.includes("not valid") || errStr.includes("403") || errStr.includes("400")) {
          throw err;
        }
      }
    }
    throw lastError;
  }

  // API Endpoints
  app.post("/api/gemini/chat", async (req, res) => {
    try {
      const { message, history, systemContext } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Message is required." });
      }

      // Reformat history to what @google/genai expects
      const contents = (history || []).slice(-6).map((h: any) => ({
        role: h.sender === "user" ? "user" : "model",
        parts: [{ text: h.text }],
      }));

      contents.push({ role: "user", parts: [{ text: message }] });

      let dynamicSystemInstruction = SYSTEM_INSTRUCTION_CHAT;
      if (systemContext) {
        dynamicSystemInstruction = `${SYSTEM_INSTRUCTION_CHAT}

LIVE SYSTEM DATA & CURRENT CONTEXT:
The following is the 100% accurate, live database snapshot of routes, stops, buses, drivers, and active alerts from the platform, which may have been customized or updated:
${JSON.stringify(systemContext, null, 2)}

Instructions for live data usage:
1. When asked about a specific route, search inside the live "routes" array. Answer with the exact stops, direction, scheduled times, and ETA.
2. If the user asks about driver names or contacts (such as Rajesh Kumar's phone number), use the live info (e.g. Rajesh Kumar: +91 98765 43210).
3. If asked about active SOS or emergency status, note any reports under "activeEmergencyAlerts".
4. Refer to this live context as the ultimate source of truth. Do not make up mock schedules or default to outdated placeholders.`;
      }

      const ai = getGeminiClient();
      const response = await generateContentWithFallback(ai, {
        contents: contents,
        config: {
          systemInstruction: dynamicSystemInstruction,
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
      const response = await generateContentWithFallback(ai, {
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

  // Self-healing asset copy: ensure public/srcimg and dist/srcimg exist and contain screenshot assets for SEO
  try {
    const screenshotsDir = path.join(process.cwd(), "screenshots");
    if (fs.existsSync(screenshotsDir)) {
      const files = fs.readdirSync(screenshotsDir);
      
      // Copy to public/srcimg
      const publicSrcimgDir = path.join(process.cwd(), "public", "srcimg");
      if (!fs.existsSync(publicSrcimgDir)) {
        fs.mkdirSync(publicSrcimgDir, { recursive: true });
      }
      
      // Copy to dist/srcimg (exists if build has run)
      const distPath = path.join(process.cwd(), "dist");
      const distSrcimgDir = path.join(distPath, "srcimg");
      if (fs.existsSync(distPath) && !fs.existsSync(distSrcimgDir)) {
        fs.mkdirSync(distSrcimgDir, { recursive: true });
      }

      for (const file of files) {
        if (file.endsWith(".jpeg") || file.endsWith(".jpg") || file.endsWith(".png")) {
          // Sync public
          fs.copyFileSync(path.join(screenshotsDir, file), path.join(publicSrcimgDir, file));
          // Sync dist
          if (fs.existsSync(distPath)) {
            fs.copyFileSync(path.join(screenshotsDir, file), path.join(distSrcimgDir, file));
          }
        }
      }
      console.log("Successfully synchronised SEO screenshots/srcimg assets.");
    }
  } catch (err) {
    console.warn("Asset sync warning:", err);
  }

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

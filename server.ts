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

  const SYSTEM_INSTRUCTION_CHAT = `You are the intelligent, helpful assistant for the "College Bus Tracker" app.
Your goal is to assist students, parents, and administrators with exact transport schedule details, active routes, driver info, safety guidelines, and application features.

### MANDATORY KNOWLEDGE:
1. **Application Features**:
   - Live Map Tracking with real-time GPS coordinates.
   - Smart Chat Assistant for transport queries.
   - Dedicated Admin Dashboard (for route creation, driver dispatch, and system monitoring).
   - Driver Dashboard (for location publishing and status management).
   - Profile view (student route details and registration).
   - Quick Scan QR-Code system for attendance.
   - Emergency SOS Alert System broadcasts instantaneous help alerts to all admins and riders.

2. **Active Route Details (Tiptur Campus Route / R-101)**:
   - **Route Name**: Tiptur Campus Express (ID: R-101)
   - **Bus Plate**: KA-01-CB-1234
   - **Driver**: Rajesh Kumar (Phone: +91 98765 43210)
   - **Current Tracking Status**: **ONLINE and active**! Students can track this live in real-time.
   - **Current Direction**: Morning pick-up route (traveling in the morning direction).
   - **Stops & Scheduled Pick-Up Timings**:
     * Stop 1 (Tiptur Railway Station): 08:30 AM
     * Stop 2 (KSRTC Bus Stand): 08:40 AM
     * Stop 3 (Koppa Circle): 08:50 AM
     * Stop 4 (Post Office Junction): 09:00 AM
     * Stop 5 (Gandhi Nagar Main): 09:10 AM
     * Hassan circle: 09:15 AM
     * Stop 7 (Main Campus Terminal): 09:20 AM

### RESPONSE GUIDELINES:
- When asked about route R-101 or the live Tiptur Campus route, provide the active driver, bus plate, status, and precise scheduled times cleanly.
- Encourage users that they can monitor the live location directly through the dedicated map interface inside the application.
- **Strict Formatting Rule**: You MUST output elegant, highly scannable Markdown. Use bullet points (e.g. "* Item") for lists and bold headers (e.g. "**Header**") for subtitles. Never clump text in unformatted paragraphs or output raw inline text structures. Your responses are rendered directly in a rich React-Markdown widget, so structured markdown renders perfectly.
- Keep responses warm, helpful, concise, and professional.`;

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

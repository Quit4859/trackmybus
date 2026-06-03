import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import app from "./app.ts";

async function startServer() {
  const PORT = 3000;

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
    // Support React Router/View state fallback
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // AI Pipeline
  app.post("/api/ai", async (req, res) => {
    const { messages, systemInstruction } = req.body;
    const AI_TIMEOUT = 60000; // 60s for AI stability
    
    try {
      const openRouterKey = process.env.OPENROUTER_API_KEY;
      
      if (openRouterKey && openRouterKey !== "") {
        console.log("[AI] Attempting OpenRouter Pipeline...");
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT);

        try {
          const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${openRouterKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://crisis-sync-applet.local", 
              "X-Title": "CrisisSync"
            },
            body: JSON.stringify({
              model: "google/gemini-2.0-flash-001",
              messages: [
                { role: "system", content: systemInstruction },
                ...messages.map((m: any) => ({
                  role: m.role === 'ai' ? 'assistant' : 'user',
                  content: m.content
                }))
              ]
            }),
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`OpenRouter Error (${response.status}): ${errorData.error?.message || response.statusText}`);
          }

          const data = await response.json();
          const aiText = data.choices[0].message.content;
          return res.json({ text: aiText });
        } catch (innerError: any) {
          clearTimeout(timeoutId);
          console.warn("[AI] OpenRouter failed, falling back to Gemini Direct:", innerError.message);
          // Fall through to Gemini Direct
        }
      }

      // Gemini Direct Pipeline (Default or Fallback)
      console.log("[AI] Using Gemini Direct Pipeline");
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
      
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: messages.map((m: any) => ({
          role: m.role === 'ai' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        config: {
          systemInstruction: systemInstruction
        }
      });

      const aiText = response.text || "I am unable to process your request right now.";
      return res.json({ text: aiText });

    } catch (error: any) {
      console.error("[AI Final Error]", error);
      res.status(500).json({ error: error.message || "Failed to generate protocols." });
    }
  });

  // Tactical Routing Pipeline
  app.get("/api/route", async (req, res) => {
    const { start, end } = req.query; // Format: "lng,lat"
    if (!start || !end) return res.status(400).json({ error: "Missing coordinates" });

    const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
    
    try {
      if (mapboxToken) {
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${start};${end}?geometries=geojson&overview=full&access_token=${mapboxToken}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          return res.json({
            distance: +(route.distance / 1000).toFixed(2),
            duration: +(route.duration / 60).toFixed(0),
            coordinates: route.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]),
            trafficAware: true
          });
        }
      }

      // Fallback to OSRM (Backend-to-Backend for reliability)
      const osrmResponse = await fetch(`https://router.project-osrm.org/route/v1/driving/${start};${end}?overview=full&geometries=geojson`);
      const data = await osrmResponse.json();
      
      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        return res.status(404).json({ error: "No route found" });
      }
      
      const route = data.routes[0];
      return res.json({
        distance: +(route.distance / 1000).toFixed(2),
        duration: +(route.duration / 60).toFixed(0),
        coordinates: route.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]),
        trafficAware: false
      });
    } catch (error: any) {
      console.error("[Route Error]", error);
      res.status(500).json({ error: "Failed to sync tactical route." });
    }
  });

  // Vite Integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In Vercel, static files are served by the platform
    // but we keep this as fallback for other environments
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  return app;
}

const appPromise = startServer();

// For local development
if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  appPromise.then(app => {
    app.listen(3000, "0.0.0.0", () => {
      console.log(`Tactical Hub running on http://localhost:3000`);
    });
  });
}

export default async (req: any, res: any) => {
  const app = await appPromise;
  return app(req, res);
};

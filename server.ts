import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import * as dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Set large payload limit to support large base64 photograph uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API router point for AI parsing
  app.post("/api/parse-receipt", async (req, res) => {
    try {
      const { image, mimeType, brands } = req.body;

      if (!image) {
        return res.status(400).json({ error: "No image content provided." });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(400).json({
          error: "GEMINI_API_KEY is not configured on this server. Please set it in the Settings secrets panel.",
          isMissingKey: true
        });
      }

      const clientBrands = Array.isArray(brands) ? brands : [];
      
      // Clean target base64 string
      let rawBase64 = image;
      let targetMimeType = mimeType || "image/jpeg";
      if (image.startsWith("data:")) {
        const parts = image.split(";base64,");
        if (parts.length === 2) {
          const match = parts[0].match(/data:(.*?)$/);
          if (match) {
            targetMimeType = match[1];
          }
          rawBase64 = parts[1];
        }
      }

      console.log(`Sending image data to Gemini for receipt extraction... MIME Type: ${targetMimeType}`);

      // Initialize Google GenAI SDK
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          }
        }
      });

      // Construct rich system prompt matching our dynamic brand taxonomy list
      const brandReferenceString = clientBrands.length > 0 
        ? clientBrands.join(", ") 
        : "Casio, Bigotti, Bonia, Caesar, Chronotech, Digitec, Naviforce, Submarine, service";

      const promptText = `Analyze this daily retail sales list, checkout journal, hand-written receipt, or register paper. Your objective is to extract the cumulative Sales Amount (in RM) and total Quantity Sold for each brand.

Here is the list of official brand names to look up and map sales to:
[ ${brandReferenceString} ]

Extremely Crucial Instructions:
1. Map items read in the receipt to the brand reference list above (case insensitive, close variations or abbreviations like 'clock bat' to 'BATTERY (CLOCK)', 'rewards' to 'REWARDS WATCH', etc.).
2. Extract the absolute total RM sales amount and quantity sold. Total sales values must be numeric (e.g. 150 or 49.90), strictly excluding the currency prefix RM.
3. If a brand name from the reference list has zero sales or is not present, either map it with sales_amount = 0 and quantity_sold = 0, or omit it.
4. Total values on receipt can serve as sanity checks if listed.
5. Return JSON matching the schema outlined.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          {
            inlineData: {
              mimeType: targetMimeType,
              data: rawBase64
            }
          },
          {
            text: promptText
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              sales: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    brand: { 
                      type: Type.STRING, 
                      description: "The brand name from the official list that matched" 
                    },
                    sales_amount: { 
                      type: Type.NUMBER, 
                      description: "The calculated sum of RM sale amounts for this brand" 
                    },
                    quantity_sold: { 
                      type: Type.INTEGER, 
                      description: "The total quantity units sold for this brand" 
                    }
                  },
                  required: ["brand", "sales_amount", "quantity_sold"]
                }
              }
            },
            required: ["sales"]
          }
        }
      });

      const textResponse = response.text;
      if (!textResponse) {
        throw new Error("Empty text response returned from the vision AI parsing model.");
      }

      console.log("Raw Gemini JSON response received:", textResponse);
      const parsedData = JSON.parse(textResponse.trim());
      return res.json(parsedData);

    } catch (error: any) {
      console.error("Receipt parsing controller exception:", error);
      return res.status(500).json({ 
        error: error.message || "An error occurred while parsing the receipt using Gemini AI." 
      });
    }
  });

  // Serving web front-end files
  if (process.env.NODE_ENV !== "production") {
    console.log("Running in development mode; launching Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Running in production mode; serving compiled SPA files...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express container server is running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

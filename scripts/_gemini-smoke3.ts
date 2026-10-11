import "./load-env";
import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY!, httpOptions: { retryOptions: { attempts: 1 } } });
async function main() {
  for (const model of (process.argv[2] ?? "").split(",")) {
    for (let i = 0; i < 3; i++) {
      const t = Date.now();
      try {
        const r = await ai.models.generateContent({ model, contents: "Reply with the word ok." });
        console.log(model, "OK", r.modelVersion, `${Date.now() - t}ms`);
      } catch (e: any) { console.log(model, "ERR", e.status ?? e.name, `${Date.now() - t}ms`); }
    }
  }
}
main();

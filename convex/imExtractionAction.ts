"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";
import Anthropic from "@anthropic-ai/sdk";
import { EXTRACTION_SYSTEM, EXTRACTION_USER } from "./extractionPrompt";
import { DEFAULT_ORACLE_MODEL } from "./settings";

/**
 * Fetch the uploaded PDF from Convex storage, call the Claude extraction API,
 * and persist the structured result. Called client-side as a fire-and-forget;
 * status is tracked via the imExtractions record (reactive query picks it up).
 */
export const extractIM = action({
  args: {
    extractionId: v.id("imExtractions"),
    storageId: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      await ctx.runMutation(internal.imExtraction.markFailed, {
        id: args.extractionId,
        error: "ANTHROPIC_API_KEY is not set in Convex environment variables. Add it in the Convex dashboard → Settings → Environment Variables.",
      });
      return;
    }

    const t0 = Date.now();

    try {
      // Fetch the PDF from Convex storage
      const url = await ctx.storage.getUrl(args.storageId as any);
      if (!url) throw new Error("Uploaded file not found in Convex storage.");

      const fileResponse = await fetch(url);
      if (!fileResponse.ok) {
        throw new Error(`Failed to fetch file from storage: HTTP ${fileResponse.status}`);
      }

      const buffer = await fileResponse.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");

      // Read model preference from DB settings, fall back to env var then default
      const modelFromDb = await ctx.runQuery(api.settings.getOracleModel, {});
      const model = modelFromDb || process.env.CLAUDE_MODEL || DEFAULT_ORACLE_MODEL;

      // Call Claude
      const anthropic = new Anthropic({ apiKey });
      const response = await anthropic.messages.create({
        model,
        max_tokens: 8192,
        system: EXTRACTION_SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: base64,
                },
              },
              { type: "text", text: EXTRACTION_USER },
            ],
          },
        ],
      });

      const latencyMs = Date.now() - t0;
      const text = response.content.find((c) => c.type === "text")?.text ?? "";

      // Strip code fences if the model wrapped JSON despite instructions
      let jsonText = text.trim();
      const fence = jsonText.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
      if (fence) jsonText = fence[1].trim();

      const parsed = JSON.parse(jsonText);

      await ctx.runMutation(internal.imExtraction.markComplete, {
        id: args.extractionId,
        result: JSON.stringify(parsed),
        model: response.model,
        latencyMs,
      });
    } catch (err: any) {
      await ctx.runMutation(internal.imExtraction.markFailed, {
        id: args.extractionId,
        error: err.message ?? "Unknown error during extraction",
      });
    }
  },
});

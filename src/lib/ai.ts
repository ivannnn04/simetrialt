import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

/**
 * Optional AI assistance for the catalogue import. Everything here is skipped when
 * ANTHROPIC_API_KEY is not set, and the rule-based parser output is used as is.
 */

const MODEL = "claude-opus-5-5";

export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

const ProductFields = z.object({
  sku: z.string(),
  name: z.string().describe("Product name as the supplier writes it, without the SKU and without the category"),
  description: z.string().describe("One or two sentences for a product page, in the language of the catalogue; empty if nothing useful"),
  typology: z.string().describe("Product type, e.g. 'Armchair', 'Pendant lamp'; empty if unknown"),
  colour: z.string(),
  dimensions: z.string().describe("Dimensions exactly as printed, e.g. 'W 228 × D 95 × H 83 cm'"),
  weight: z.string(),
  material: z.string().describe("Materials / finish exactly as printed"),
  category: z.string().describe("Catalogue section such as 'Sofas', 'Lighting', 'Tables'; empty if unknown"),
});
const Extraction = z.object({ products: z.array(ProductFields) });
export type AiProductFields = z.infer<typeof ProductFields>;

export type ProductBlock = { sku: string; heading: string; text: string };

/** Reads the raw text of each product block into structured fields. */
export async function structureProducts(blocks: ProductBlock[], brand: string): Promise<Map<string, AiProductFields>> {
  const out = new Map<string, AiProductFields>();
  if (!aiEnabled() || blocks.length === 0) return out;
  const BATCH = 25;
  for (let i = 0; i < blocks.length; i += BATCH) {
    const batch = blocks.slice(i, i + BATCH);
    const input = batch
      .map((b) => `### SKU ${b.sku}${b.heading ? ` (section: ${b.heading})` : ""}\n${b.text}`)
      .join("\n\n");
    const response = await getClient().messages.parse({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: "low", format: zodOutputFormat(Extraction) },
      system:
        "You turn blocks of text copied from a furniture supplier's PDF catalogue into structured product data. " +
        "Each block starts with '### SKU'. Return one entry per block with the same SKU. Copy values as printed; never invent " +
        `specifications. The brand is ${brand || "unknown"}; do not repeat it in the name.`,
      messages: [{ role: "user", content: input }],
    });
    for (const p of response.parsed_output?.products ?? []) out.set(p.sku, p);
  }
  return out;
}

export type ImageCandidate = { src: string; thumb: string; source: string; title: string };

/**
 * Looks at the catalogue photo and the search results and keeps the ones showing the same product.
 * Returns candidate indexes in order of confidence.
 */
export async function rankImageCandidates(reference: string, candidates: ImageCandidate[], label: string): Promise<number[]> {
  if (!aiEnabled() || candidates.length === 0) return candidates.map((_, i) => i);
  const Ranking = z.object({ matching: z.array(z.number().int()).describe("Indexes of candidates that show the same product, best first") });
  const content: Anthropic.ContentBlockParam[] = [{ type: "text", text: `Reference photo of "${label}" from the supplier catalogue:` }];
  content.push(toImageBlock(reference));
  for (const [i, c] of candidates.entries()) {
    content.push({ type: "text", text: `Candidate ${i} (${c.source}): ${c.title}` });
    content.push({ type: "image", source: { type: "url", url: c.thumb || c.src } });
  }
  content.push({ type: "text", text: "Which candidates show the same product (same model, any colour or angle)? Exclude other products, room scenes with several items, and drawings." });
  const response = await getClient().messages.parse({
    model: MODEL,
    max_tokens: 2000,
    output_config: { effort: "low", format: zodOutputFormat(Ranking) },
    messages: [{ role: "user", content }],
  });
  const idx = (response.parsed_output?.matching ?? []).filter((i) => i >= 0 && i < candidates.length);
  return idx;
}

function toImageBlock(src: string): Anthropic.ImageBlockParam {
  const m = src.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/);
  if (m) return { type: "image", source: { type: "base64", media_type: m[1] as "image/jpeg", data: m[2] } };
  return { type: "image", source: { type: "url", url: src } };
}

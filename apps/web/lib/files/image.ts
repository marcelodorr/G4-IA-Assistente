import sharp from "sharp";

const MAX_RENDER_PIXELS = 40_000_000;
const MAX_IMAGE_SIDE = 2_048;
const UNSAFE_SVG_CONTENT = /<!doctype|<!entity|<script\b|<foreignObject\b|\b(?:href|xlink:href)\s*=\s*["']\s*(?:https?:|file:|\/\/)|\burl\(\s*["']?\s*(?:https?:|file:|\/\/)/i;

/** Converte SVG em uma imagem segura e compatível com modelos multimodais. */
export async function rasterizeSvg(buf: Buffer): Promise<Buffer> {
  try {
    if (UNSAFE_SVG_CONTENT.test(buf.toString("utf8"))) {
      throw new Error("o arquivo contém scripts ou recursos externos não permitidos");
    }
    return await sharp(buf, {
      density: 144,
      failOn: "error",
      limitInputPixels: MAX_RENDER_PIXELS,
    })
      .flatten({ background: "#ffffff" })
      .resize({
        width: MAX_IMAGE_SIDE,
        height: MAX_IMAGE_SIDE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`SVG inválido ou complexo demais para processar: ${detail}`);
  }
}

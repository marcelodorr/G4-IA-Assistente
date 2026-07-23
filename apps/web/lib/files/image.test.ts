import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { rasterizeSvg } from "./image";

describe("rasterizeSvg", () => {
  it("converte um SVG visual em PNG", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="#00b8a9"/></svg>');
    const png = await rasterizeSvg(svg);
    const metadata = await sharp(png).metadata();

    expect(metadata.format).toBe("png");
    expect(metadata.width).toBe(240);
    expect(metadata.height).toBe(160);
  });

  it("retorna uma mensagem compreensível para SVG inválido", async () => {
    await expect(rasterizeSvg(Buffer.from("não é um svg"))).rejects.toThrow(/SVG inválido/i);
  });

  it("bloqueia recursos externos dentro do SVG", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><image href="https://exemplo.com/imagem.png"/></svg>');
    await expect(rasterizeSvg(svg)).rejects.toThrow(/recursos externos não permitidos/i);
  });
});

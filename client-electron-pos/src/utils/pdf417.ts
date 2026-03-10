import bwipjs from "bwip-js/browser";

const PDF417_OPTIONS = {
  bcid: "pdf417",
  scale: 2,
  height: 10,
  includetext: false,
} as const;

export function renderPdf417ToCanvas(canvas: HTMLCanvasElement, tedXml: string) {
  const text = tedXml.trim();
  if (!text) return undefined;

  bwipjs.toCanvas(canvas, {
    ...PDF417_OPTIONS,
    text,
  });

  return canvas.toDataURL("image/png");
}

export function buildPdf417DataUrl(tedXml?: string | null) {
  const text = tedXml?.trim();
  if (!text || typeof document === "undefined") return undefined;

  try {
    const canvas = document.createElement("canvas");
    return renderPdf417ToCanvas(canvas, text);
  } catch (err) {
    console.error("PDF417 render error:", err);
    return undefined;
  }
}

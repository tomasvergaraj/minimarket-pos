import { useEffect, useRef } from "react";
import bwipjs from "bwip-js/browser";

interface Props {
  tedXml: string;
  className?: string;
  /** Llamado con el data URL (PNG) después de renderizar — para impresión térmica */
  onDataUrl?: (dataUrl: string) => void;
}

/**
 * Renderiza el TED (Timbre Electrónico Digital) como código PDF417.
 * El contenido codificado es el XML <TED>...</TED> firmado, tal como
 * lo exige el SII para boletas electrónicas Tipo 39.
 */
export default function PDF417Barcode({ tedXml, className, onDataUrl }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !tedXml) return;
    try {
      bwipjs.toCanvas(canvasRef.current, {
        bcid: "pdf417",
        text: tedXml,
        scale: 2,
        height: 10,
        includetext: false,
      });
      if (onDataUrl) {
        onDataUrl(canvasRef.current.toDataURL("image/png"));
      }
    } catch (err) {
      console.error("PDF417 render error:", err);
    }
  }, [tedXml, onDataUrl]);

  return <canvas ref={canvasRef} className={className} />;
}

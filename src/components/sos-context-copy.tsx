"use client";

import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";

export function SosContextCopy({ context }: { context: string }) {
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(context);
      setCopied(true);
      setMessage("Contexto copiado. Cola-o como primeira mensagem do novo chat.");
    } catch {
      setMessage("Não foi possível copiar automaticamente. Descarrega o texto ou selecciona-o abaixo.");
    }
  }
  return (
    <div className="mt-6 space-y-3">
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => void copy()} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-ink px-6 text-sm text-parchment transition hover:bg-sea focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sea">
          {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />} Copiar contexto completo
        </button>
        <a href="/api/sos-context" download className="inline-flex min-h-12 items-center gap-2 rounded-full border border-ink/20 px-6 text-sm text-ink hover:border-sea">
          <Download size={16} aria-hidden="true" /> Descarregar instruções
        </a>
      </div>
      <p role="status" className="text-sm text-sea">{message}</p>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { SosContextCopy } from "@/components/sos-context-copy";
import { buildSosContext } from "@/lib/sos-context";
import { CODE_VERSION } from "@/lib/version";
import { PUBLIC_SITE_URL } from "@/lib/site-url";
import { RELEASE_SANDBOX_URL, RELEASE_ZIP_URL } from "@/lib/release-info";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Project SOS · New chat", robots: { index: false, follow: false } };

/** Owner handover, intentionally public and secret-free so a new chat can read it. */
export default function SosPage() {
  const context = buildSosContext();
  return (
    <div lang="pt-PT" className="mx-auto max-w-5xl px-5 py-12 sm:py-16 lg:px-8">
      <p className="text-xs uppercase tracking-[0.25em] text-brass">Mediterranic · Continuidade do projecto</p>
      <h1 className="mt-4 font-display text-4xl leading-tight text-ink sm:text-6xl">SOS — abrir um novo chat</h1>
      <p className="mt-5 max-w-3xl text-base leading-relaxed text-ink/70">Se o chat bloquear ou ficar demasiado longo, copia o contexto abaixo para um novo chat. O código publicado e o conteúdo guardado no admin não desaparecem por esse motivo.</p>
      <p className="mt-3 text-sm text-ink/65">Versão destas instruções: <strong>{CODE_VERSION}</strong>. Página pública, sem palavras-passe, chaves ou dados de clientes.</p>
      <SosContextCopy context={context} />
      <nav aria-label="Project links" className="my-7 flex flex-wrap gap-x-5 gap-y-3 rounded-sm border border-ink/10 bg-white/70 p-5 text-sm">
        <a href={PUBLIC_SITE_URL} className="underline underline-offset-4">Produção</a>
        <a href={`${PUBLIC_SITE_URL}/admin`} className="underline underline-offset-4">Admin produção</a>
        <a href={`${PUBLIC_SITE_URL}/api/version`} className="underline underline-offset-4">Versão publicada</a>
        <a href={RELEASE_SANDBOX_URL} className="underline underline-offset-4">Sandbox</a>
        <a href={`${RELEASE_SANDBOX_URL}/admin`} className="underline underline-offset-4">Admin sandbox</a>
        <a href={`${RELEASE_SANDBOX_URL}/api/version`} className="underline underline-offset-4">Versão sandbox</a>
        <a href={RELEASE_ZIP_URL} className="font-medium text-sea underline underline-offset-4">ZIP completo</a>
        <a href="https://github.com/mediterraneanworld-ship-it/mediterranic" className="underline underline-offset-4">GitHub · master</a>
      </nav>
      <div className="rounded-sm border-l-4 border-brass bg-brass/10 p-5 text-sm leading-relaxed text-ink/80">Antes de um push grande: <strong>Download backup</strong> no admin de produção. O ZIP é código; não contém nem substitui o conteúdo do Neon. Os links de sandbox podem expirar.</div>
      <pre tabIndex={0} aria-label="Contexto completo para o novo chat" className="mt-8 whitespace-pre-wrap break-words rounded-sm border border-ink/15 bg-white/80 p-5 font-mono text-[13px] leading-7 text-ink/80 focus-visible:outline-2 focus-visible:outline-sea sm:p-8">{context}</pre>
      <Link href="/admin" className="mt-7 inline-block text-sm text-sea underline underline-offset-4">Voltar ao admin deste ambiente</Link>
    </div>
  );
}

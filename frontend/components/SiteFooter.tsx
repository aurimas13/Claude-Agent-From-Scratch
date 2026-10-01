import { REPO_URL } from "@/lib/api";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-slate-200/70 bg-white/60">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          Built by{" "}
          <a className="font-medium text-slate-700 hover:text-brand-600" href="https://aurimas.io" target="_blank" rel="noopener noreferrer">
            Aurimas
          </a>{" "}
          with the Claude API, FastAPI, Next.js and Supabase.
        </p>
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          <a className="hover:text-brand-600" href={REPO_URL} target="_blank" rel="noopener noreferrer">Source code</a>
          <a className="hover:text-brand-600" href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Weather data by Open-Meteo.com</a>
        </p>
      </div>
    </footer>
  );
}

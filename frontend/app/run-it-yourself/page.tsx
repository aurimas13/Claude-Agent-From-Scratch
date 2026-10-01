import type { Metadata } from "next";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { REPO_URL } from "@/lib/api";

export const metadata: Metadata = {
  title: "Run it yourself",
  description: "Run the agent locally in 5 minutes, then deploy it to Railway, Vercel and Supabase.",
};

type Block = { code: string; where?: "terminal" | "file" | "notebook"; path?: string };
type Step = { title: string; time: string; body: string; blocks: Block[]; note?: string };

const LOCAL: Step[] = [
  {
    title: "Get the code",
    time: "1 min",
    body: "You need Python 3.12+ and Node 20+. Check with python3 --version and node --version.",
    blocks: [{ code: `git clone ${REPO_URL}.git\ncd Claude-Agent-From-Scratch` }],
  },
  {
    title: "Install the agent (backend)",
    time: "2 min",
    body: "Create a private Python box for this project and install what it needs. Then copy the example settings file.",
    blocks: [
      { code: "cd backend\npython3 -m venv .venv\nsource .venv/bin/activate        # Windows: .venv\\Scripts\\activate\npython -m pip install -r requirements.txt\ncp .env.example .env", path: "Claude-Agent-From-Scratch/" },
      { code: "ANTHROPIC_API_KEY=sk-ant-...      # console.anthropic.com -> API keys", where: "file", path: "backend/.env" },
    ],
    note: "That's the only setting you need locally. Without Supabase, the app keeps memory in RAM.",
  },
  {
    title: "Talk to it in the terminal",
    time: "30 sec",
    body: "The quickest test. This is the same agent as the website, minus the website.",
    blocks: [{ code: "python -m app.cli", path: "backend/  (with .venv active)" }],
  },
  {
    title: "Start the API",
    time: "30 sec",
    body: "Leave this running in its own terminal tab. Open http://localhost:8000/docs to see and try every endpoint.",
    blocks: [{ code: "uvicorn app.main:app --reload --port 8000", path: "backend/  (with .venv active)" }],
  },
  {
    title: "Start the website",
    time: "1 min",
    body: "In a second terminal tab. Then open http://localhost:3000.",
    blocks: [{ code: "cd frontend\nnpm install\ncp .env.example .env.local\nnpm run dev", path: "Claude-Agent-From-Scratch/" }],
  },
];

const DEPLOY: Step[] = [
  {
    title: "Database: Supabase",
    time: "3 min",
    body: "Create a project. Open SQL Editor, paste supabase/migrations/20261001000000_init.sql, and click Run. Then go to Project Settings → API Keys and copy the project URL and a Secret key (sb_secret_…).",
    blocks: [{ code: "SUPABASE_URL=https://<ref>.supabase.co\nSUPABASE_SECRET_KEY=sb_secret_...", where: "file", path: "Railway → Variables (never in the frontend)" }],
    note: "Every table has Row Level Security switched on with no public rules, so only the API can read or write.",
  },
  {
    title: "Agent API: Railway",
    time: "4 min",
    body: "New Project → Deploy from GitHub repo → set Root Directory to /backend. Railway finds the Dockerfile and railway.json (with a health check). Add these variables, then Settings → Networking → Generate Domain (or add agent-api.aurimas.io).",
    blocks: [
      {
        code:
          "ENVIRONMENT=production\nANTHROPIC_API_KEY=sk-ant-...\nMODEL=claude-sonnet-5\nSUPABASE_URL=...\nSUPABASE_SECRET_KEY=...\nALLOWED_ORIGINS=https://agent.aurimas.io\nTURNSTILE_SECRET_KEY=...\nIP_HASH_SALT=<python -c \"import secrets;print(secrets.token_hex(32))\">\nDAILY_BUDGET_USD=3",
        where: "file",
        path: "Railway → backend service → Variables",
      },
    ],
  },
  {
    title: "Bot check: Cloudflare Turnstile",
    time: "2 min",
    body: "Cloudflare dashboard → Turnstile → Add widget for agent.aurimas.io (Managed mode). The site key goes to Vercel and the secret key goes to Railway.",
    blocks: [],
  },
  {
    title: "Website: Vercel",
    time: "3 min",
    body: "Add New Project → import the repo → set Root Directory to frontend. Add the variables, deploy, then add the custom domain agent.aurimas.io.",
    blocks: [
      {
        code: "NEXT_PUBLIC_API_URL=https://<your-railway-domain>\nNEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4AAAA...\nNEXT_PUBLIC_REPO_URL=" + REPO_URL,
        where: "file",
        path: "Vercel → Project → Settings → Environment Variables",
      },
    ],
    note: "NEXT_PUBLIC_ values are visible to everyone, so only public values go here. Secrets stay on Railway.",
  },
];

function StepList({ steps, start = 1 }: { steps: Step[]; start?: number }) {
  return (
    <ol className="mt-6 space-y-5">
      {steps.map((step, i) => (
        <li key={step.title} className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-lg bg-brand-50 font-semibold text-brand-700 ring-1 ring-brand-200">{start + i}</span>
            <h3 className="font-semibold">{step.title}</h3>
            <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{step.time}</span>
          </div>
          <p className="mt-3 text-[15px] text-slate-600">{step.body}</p>
          {step.blocks.length > 0 && (
            <div className="mt-4 space-y-3">
              {step.blocks.map((b) => (
                <CodeBlock key={b.code} code={b.code} where={b.where ?? "terminal"} path={b.path} />
              ))}
            </div>
          )}
          {step.note && <p className="mt-3 rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-800 ring-1 ring-sky-100">{step.note}</p>}
        </li>
      ))}
    </ol>
  );
}

export default function RunItYourself() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-10 sm:px-6 sm:pt-14">
      <header>
        <h1 className="text-4xl font-semibold tracking-tight">Run it yourself</h1>
        <p className="mt-3 text-lg text-slate-600">
          Five minutes on your laptop, then about fifteen to put it online. Every code box tells you <em>where</em> it goes.
        </p>
      </header>

      <section className="mt-10" aria-labelledby="local">
        <h2 id="local" className="text-2xl font-semibold tracking-tight">
          On your computer
        </h2>
        <StepList steps={LOCAL} />
      </section>

      <section className="mt-14" aria-labelledby="deploy">
        <h2 id="deploy" className="text-2xl font-semibold tracking-tight">
          Put it online
        </h2>
        <p className="mt-1 text-slate-600">Supabase stores the data, Railway runs the Python agent, and Vercel serves the website.</p>
        <StepList steps={DEPLOY} start={LOCAL.length + 1} />
      </section>

      <section className="mt-14 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm" aria-labelledby="checks">
        <h2 id="checks" className="text-xl font-semibold tracking-tight">
          Check everything works
        </h2>
        <div className="mt-4 space-y-3">
          <CodeBlock code={"cd backend\npip install -e \".[dev]\"\npytest -q          # 37 tests, no API key or network needed"} path="Claude-Agent-From-Scratch/" />
          <CodeBlock code={"cd frontend\nnpm run lint && npm run typecheck && npm run build"} path="Claude-Agent-From-Scratch/" />
        </div>
      </section>
    </div>
  );
}

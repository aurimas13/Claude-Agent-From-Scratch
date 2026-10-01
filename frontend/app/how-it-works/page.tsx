import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  Calculator,
  Database,
  Eye,
  Hand,
  KeyRound,
  Lock,
  NotebookPen,
  ShieldCheck,
  Sparkles,
  Timer,
  Wallet,
  Bot,
} from "lucide-react";
import { LoopDiagram } from "@/components/LoopDiagram";
import { CodeBlock, WhereBadge, type Where } from "@/components/ui/CodeBlock";

export const metadata: Metadata = {
  title: "How it works",
  description: "The 'build an AI agent from scratch with the Claude API' guide, explained like you're five, with pictures.",
};

const GUIDE_URL = "https://dev.to/dextralabs/how-to-build-an-ai-agent-from-scratch-using-claude-api-with-full-code-4b40";

const PARTS = [
  {
    icon: Brain,
    tint: "bg-brand-50 text-brand-600 ring-brand-200",
    title: "A brain",
    who: "Claude (the AI model)",
    text: "Reads your question and decides what to do next. Great with words, but it can slip on exact maths, and it can't know today's weather by itself.",
  },
  {
    icon: Hand,
    tint: "bg-emerald-50 text-emerald-600 ring-emerald-200",
    title: "Hands",
    who: "Tools",
    text: "A calculator, a weather checker, a world clock and web search. The brain can't press buttons, so it asks the hands, and our Python code does the work.",
  },
  {
    icon: NotebookPen,
    tint: "bg-amber-50 text-amber-600 ring-amber-200",
    title: "A notebook",
    who: "Memory",
    text: "A list of everything said so far. We send the whole list to Claude every time, which is how it remembers the “$50,000” you mentioned earlier.",
  },
  {
    icon: Database,
    tint: "bg-sky-50 text-sky-600 ring-sky-200",
    title: "A filing cabinet",
    who: "Database (Supabase)",
    text: "Keeps the notebook safe when you close the tab, remembers answers to repeat questions, and counts the cost of every question.",
  },
];

const STORY = [
  { icon: Brain, label: "Think", tint: "bg-brand-50 text-brand-700 ring-brand-200", says: "“That's maths. I'll use the calculator.”", code: 'stop_reason = "tool_use"' },
  { icon: Calculator, label: "Act", tint: "bg-emerald-50 text-emerald-700 ring-emerald-200", says: "Uses the calculator with 10000 * 1.07 ** 10", code: 'calculator(expression="10000 * 1.07 ** 10")' },
  { icon: Eye, label: "Observe", tint: "bg-sky-50 text-sky-700 ring-sky-200", says: "Reads the result: 19671.51", code: '{"type": "tool_result", "content": "19671.51"}' },
  { icon: Brain, label: "Think", tint: "bg-brand-50 text-brand-700 ring-brand-200", says: "“I have what I need.”", code: 'stop_reason = "end_turn"' },
  { icon: Sparkles, label: "Answer", tint: "bg-amber-50 text-amber-700 ring-amber-200", says: "“After 10 years you'd have about $19,671.51.”", code: "return final_answer" },
];

type Step = {
  n: string;
  title: string;
  eli5: string;
  where: Where[];
  file: string;
  code?: { code: string; where: Where; path?: string };
  see: string;
  gotcha?: { problem: string; fix: string };
};

const STEPS: Step[] = [
  {
    n: "0",
    title: "Prerequisites",
    eli5: "Set up your kitchen before you cook: one clean box (a virtual environment) holding exactly the ingredients this project needs.",
    where: ["terminal"],
    file: "backend/requirements.txt",
    code: { code: "cd backend\npython -m venv .venv\nsource .venv/bin/activate\npython -m pip install -r requirements.txt", where: "terminal", path: "Claude-Agent-From-Scratch/" },
    see: "“Successfully installed anthropic … fastapi …”, and your prompt starts with (.venv).",
    gotcha: {
      problem: "ModuleNotFoundError: No module named 'anthropic', even after installing it.",
      fix: "The package went into one Python (conda's base) while the script ran with another. Make a .venv and always use “python -m pip”, so pip installs into the same Python that runs your code.",
    },
  },
  {
    n: "1",
    title: "Basic Claude API setup",
    eli5: "Run a phone line to the brain and say hello. If Claude answers “Four” to “What is 2 + 2?”, the line works.",
    where: ["terminal", "notebook"],
    file: "backend/app/llm.py",
    code: {
      code: 'import anthropic\nfrom dotenv import load_dotenv\n\nload_dotenv("../backend/.env")    # puts ANTHROPIC_API_KEY in the environment\nclient = anthropic.Anthropic()    # reads ANTHROPIC_API_KEY\nmsg = client.messages.create(\n    model="claude-sonnet-5", max_tokens=100,\n    messages=[{"role": "user", "content": "What is 2 + 2? One word."}],\n)\nprint(msg.content[0].text)',
      where: "notebook",
      path: "notebooks/walkthrough.ipynb · cell 2",
    },
    see: "Four",
    gotcha: {
      problem: "TypeError: Anthropic.__init__() got an unexpected keyword argument 'workspace_id'",
      fix: "The client has no workspace_id argument. A normal API key already belongs to one workspace. If yours needs it, send it as the anthropic-workspace-id header.",
    },
  },
  {
    n: "2",
    title: "Define your tools",
    eli5: "Give the brain a toolbox, and put a clear label on every tool: what it does and what to hand it. Claude only ever reads the labels. Your Python does the real work.",
    where: ["file"],
    file: "backend/app/tools/",
    see: "Nothing yet! This file is a toolbox that the loop opens later. You don't run it on its own.",
    gotcha: {
      problem: "400 error: “tools: Input should be a valid array”. Also, eval() runs any code it's given.",
      fix: "tools.json had wrapped the list in {\"tools\": [...]}, so we pass the list itself. eval() was replaced with a calculator that only understands maths.",
    },
  },
  {
    n: "3",
    title: "Build the ReAct loop",
    eli5: "Brain and hands take turns. Brain: “use the calculator”. Hands: “here's 19671.51”. Brain: “thanks, here's your answer.” Repeat until the brain says it's done.",
    where: ["file"],
    file: "backend/app/agent.py",
    code: {
      code: 'for step in range(max_iterations):\n    response = claude(messages, tools)\n    if response.stop_reason == "end_turn":\n        return answer            # done!\n    elif response.stop_reason == "tool_use":\n        results = run_tools(response)\n        messages += [response, results]   # feed results back\n    else:\n        return "stopped"         # never loop forever',
      where: "file",
      path: "backend/app/agent.py (simplified)",
    },
    see: "Again nothing on its own. The terminal chat and the website both use this loop.",
    gotcha: {
      problem: "The agent quit on step 1 whenever Claude said a sentence before using a tool.",
      fix: "An “else: return” was inside the wrong loop. It belongs on the stop_reason check, not on each block of Claude's reply.",
    },
  },
  {
    n: "4",
    title: "Run it",
    eli5: "Press play! Ask a question and watch each step print: the tool it picks, what it sends, and what comes back.",
    where: ["terminal", "notebook"],
    file: "backend/app/cli.py",
    code: { code: "cd backend\npython -m app.cli", where: "terminal", path: "Claude-Agent-From-Scratch/" },
    see: "You: What is sqrt(144) * 366?\n  -> calculator({\"expression\": \"sqrt(144) * 366\"})\n  <- 4392\nAgent: The answer is 4392.",
  },
  {
    n: "5",
    title: "Adding memory",
    eli5: "Give the agent a notebook so the second question can build on the first. We keep the notebook in a database, so it survives a page refresh.",
    where: ["file"],
    file: "backend/app/main.py + supabase/migrations/",
    see: "Ask “My budget is $50,000. 7% for 5 years?”, then “Now for 10 years”. It still remembers the $50,000.",
    gotcha: {
      problem: "The guide's memory class calls itself with an empty message after using tools, and the API rejects empty messages.",
      fix: "We swapped the recursion for the same bounded loop as step 3. History is saved to Supabase after every answer.",
    },
  },
];

const UPGRADES = [
  ["Simulated web search", "Real web search (Anthropic's server tool), with sources"],
  ["eval() calculator", "Calculator that only understands maths, with limits"],
  ["—", "Real weather and world time (Open-Meteo, no key needed)"],
  ["save_to_file on your disk", "save_note to the database, downloadable in the browser"],
  ["Prints at the end", "Every step streams live to the page"],
  ["Memory in a Python list", "Memory in Supabase, plus an answer cache and a usage log"],
  ["Runs on your laptop", "FastAPI on Railway + Next.js on Vercel, with tests and CI"],
];

const SAFETY = [
  { icon: KeyRound, title: "Keys stay on the server", text: "The Anthropic and Supabase secret keys live only on Railway. The browser never sees them." },
  { icon: Lock, title: "Database locked by default", text: "Row Level Security is on for every table, with no public rules, so only our API can read or write." },
  { icon: Timer, title: "Rate limits", text: "Each visitor gets a few questions a minute and a daily allowance. Visitor IPs are stored only as anonymous hashes." },
  { icon: Bot, title: "One human check per visit", text: "Cloudflare Turnstile checks you once before the site opens. After that, a signed 12-hour session cookie means no more checks." },
  { icon: Wallet, title: "Daily budget cap", text: "Every question's cost is logged. Past the daily limit, the demo pauses until tomorrow." },
  { icon: ShieldCheck, title: "Untrusted text stays harmless", text: "Web pages are treated as data, never as instructions. Answers are shown as text, not HTML, so injected code can't run." },
];

export default function HowItWorks() {
  return (
    <div className="mx-auto max-w-5xl px-4 pt-10 sm:px-6 sm:pt-14">
      <header className="text-center">
        <p className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
          <Sparkles className="size-3.5" aria-hidden /> Explained like you&apos;re five
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">How an AI agent works</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
          <a href={GUIDE_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-600 underline underline-offset-2">
            The guide
          </a>{" "}
          teaches this with code. Here are the same ideas as pictures, plus exactly <em>where</em> each piece of code runs.
        </p>
      </header>

      {/* 1. Parts */}
      <section className="mt-14" aria-labelledby="parts">
        <h2 id="parts" className="text-2xl font-semibold tracking-tight">
          1 · An agent has four parts
        </h2>
        <p className="mt-1 text-slate-600">Think of a clever kid with a toolbox, a notebook and a filing cabinet.</p>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PARTS.map(({ icon: Icon, tint, title, who, text }) => (
            <div key={title} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <span className={`grid size-11 place-items-center rounded-xl ring-1 ${tint}`}>
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="text-sm font-medium text-slate-500">= {who}</p>
              <p className="mt-2 text-sm text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Loop */}
      <section className="mt-16" aria-labelledby="loop">
        <h2 id="loop" className="text-2xl font-semibold tracking-tight">
          2 · It works in a loop: Think → Act → Observe
        </h2>
        <p className="mt-1 text-slate-600">
          This loop is called <strong className="font-semibold">ReAct</strong> (<em>Re</em>asoning + <em>Act</em>ing). It&apos;s the
          heart of the whole guide.
        </p>
        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] items-center gap-8 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6 lg:grid-cols-2">
          <LoopDiagram />
          <ol className="space-y-3">
            <li className="text-sm font-medium text-slate-500">
              Example: “How much is $10,000 after 10 years at 7%?”
            </li>
            {STORY.map(({ icon: Icon, label, tint, says, code }, i) => (
              <li key={i} className="flex gap-3">
                <span className={`mt-0.5 inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-semibold ring-1 ${tint}`}>
                  <Icon className="size-3.5" aria-hidden /> {label}
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] text-slate-700">{says}</p>
                  <code className="mt-0.5 block truncate font-mono text-xs text-slate-400">{code}</code>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 3. Guide steps */}
      <section className="mt-16" aria-labelledby="steps">
        <h2 id="steps" className="text-2xl font-semibold tracking-tight">
          3 · The guide, step by step, and where each piece runs
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
          Labels: <WhereBadge where="terminal" /> type it in the terminal · <WhereBadge where="file" /> save as a .py file (other code
          imports it) · <WhereBadge where="notebook" /> run it one cell at a time in Jupyter or VS Code
        </div>
        <ol className="mt-8 space-y-6">
          {STEPS.map((step) => (
            <li key={step.n} className="relative rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-sky-400 font-semibold text-white">
                  {step.n}
                </span>
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {step.where.map((w) => (
                    <WhereBadge key={w} where={w} />
                  ))}
                </div>
              </div>
              <p className="mt-3 text-[15px] text-slate-700">{step.eli5}</p>
              <p className="mt-2 text-sm text-slate-500">
                In this repo: <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">{step.file}</code>
              </p>
              {step.code && (
                <div className="mt-4">
                  <CodeBlock {...step.code} />
                </div>
              )}
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-xl bg-emerald-50/70 p-3 ring-1 ring-emerald-100">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">What you should see</p>
                  <p className="mt-1 whitespace-pre-wrap font-mono text-xs text-slate-700">{step.see}</p>
                </div>
                {step.gotcha && (
                  <div className="rounded-xl bg-amber-50/70 p-3 ring-1 ring-amber-100">
                    <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
                      <AlertTriangle className="size-3.5" aria-hidden /> Gotcha we hit
                    </p>
                    <p className="mt-1 font-mono text-xs text-slate-700">{step.gotcha.problem}</p>
                    <p className="mt-1.5 text-sm text-slate-600">{step.gotcha.fix}</p>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* 4. Terminal vs notebook */}
      <section className="mt-16" aria-labelledby="where">
        <h2 id="where" className="text-2xl font-semibold tracking-tight">
          4 · Terminal or notebook? Both work.
        </h2>
        <p className="mt-1 text-slate-600">The guide doesn&apos;t say which to use. Here&apos;s the simple rule.</p>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <WhereBadge where="terminal" />
            <h3 className="mt-3 font-semibold">Like pressing play on a whole song</h3>
            <p className="mt-1 text-sm text-slate-600">
              Save code in <code className="font-mono">.py</code> files and run them with <code className="font-mono">python file.py</code>. Use this
              for real apps: servers, files that import each other, anything you deploy.
            </p>
            <div className="mt-3">
              <CodeBlock code={"cd backend\npython -m app.cli"} where="terminal" />
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <WhereBadge where="notebook" />
            <h3 className="mt-3 font-semibold">Like cooking one step at a time, tasting as you go</h3>
            <p className="mt-1 text-sm text-slate-600">
              Open <code className="font-mono">notebooks/walkthrough.ipynb</code> in VS Code or Jupyter and press Shift+Enter on each cell. Use this to
              learn, to experiment, and to see each result.
            </p>
            <div className="mt-3">
              <CodeBlock code={"cd backend && pip install -e \".[notebook]\"\ncd .. && jupyter notebook notebooks/walkthrough.ipynb"} where="terminal" />
            </div>
          </div>
        </div>
      </section>

      {/* 5. Architecture */}
      <section className="mt-16" aria-labelledby="product">
        <h2 id="product" className="text-2xl font-semibold tracking-tight">
          5 · From a script to a real product
        </h2>
        <div className="mt-6 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-8">
          <div className="grid grid-cols-1 items-stretch gap-3 text-sm md:grid-cols-[1fr_auto_1fr_auto_1fr]">
            <div className="rounded-2xl bg-brand-50 p-4 ring-1 ring-brand-100">
              <p className="font-semibold text-brand-700">Website</p>
              <p className="text-slate-600">Next.js on Vercel</p>
              <p className="mt-2 text-xs text-slate-500">You type a question and watch the steps arrive.</p>
            </div>
            <ArrowRight className="mx-auto hidden size-5 self-center text-slate-300 md:block" aria-hidden />
            <div className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
              <p className="font-semibold text-emerald-700">Agent API</p>
              <p className="text-slate-600">Python FastAPI on Railway</p>
              <p className="mt-2 text-xs text-slate-500">Runs the ReAct loop and the tools, then streams each step back.</p>
            </div>
            <ArrowRight className="mx-auto hidden size-5 self-center text-slate-300 md:block" aria-hidden />
            <div className="space-y-2">
              <div className="rounded-xl bg-amber-50 px-3 py-2 ring-1 ring-amber-100">
                <span className="font-semibold text-amber-700">Claude API</span> <span className="text-slate-500">· the brain</span>
              </div>
              <div className="rounded-xl bg-sky-50 px-3 py-2 ring-1 ring-sky-100">
                <span className="font-semibold text-sky-700">Open-Meteo</span> <span className="text-slate-500">· weather + time zones</span>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                <span className="font-semibold text-slate-700">Supabase</span> <span className="text-slate-500">· memory, cache, usage</span>
              </div>
            </div>
          </div>

          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4 font-medium">In the guide</th>
                  <th className="py-2 font-medium">In this project</th>
                </tr>
              </thead>
              <tbody>
                {UPGRADES.map(([from, to]) => (
                  <tr key={to} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5 pr-4 text-slate-500">{from}</td>
                    <td className="py-2.5 text-slate-800">{to}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 6. Safety */}
      <section className="mt-16" aria-labelledby="safety">
        <h2 id="safety" className="text-2xl font-semibold tracking-tight">
          6 · Keeping it safe
        </h2>
        <p className="mt-1 text-slate-600">A public AI demo spends real money and talks to strangers. Here is how it&apos;s protected.</p>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SAFETY.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <Icon className="size-5 text-brand-600" aria-hidden />
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-16 flex flex-col items-center gap-3 rounded-3xl bg-gradient-to-br from-brand-600 to-sky-500 p-8 text-center text-white shadow-lg shadow-brand-600/20">
        <h2 className="text-2xl font-semibold">Now watch it happen</h2>
        <p className="max-w-xl text-white/85">Every question in the playground shows these exact steps, live.</p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <Link href="/" className="rounded-xl bg-white px-4 py-2 font-medium text-brand-700 shadow-sm transition hover:bg-brand-50">
            Open the playground
          </Link>
          <Link href="/run-it-yourself" className="rounded-xl bg-white/15 px-4 py-2 font-medium text-white ring-1 ring-white/40 transition hover:bg-white/25">
            Run it yourself
          </Link>
        </div>
      </div>
    </div>
  );
}

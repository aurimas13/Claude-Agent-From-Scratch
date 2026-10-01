/** The ReAct loop as a picture: Think -> Act -> Observe -> back to Think, until it can Answer. */
export function LoopDiagram() {
  const loop = "M 200 50 A 120 120 0 1 1 199.9 50";
  return (
    <figure className="mx-auto w-full max-w-md">
      <svg viewBox="0 0 460 330" className="h-auto w-full" role="img" aria-labelledby="loop-title loop-desc">
        <title id="loop-title">The ReAct loop</title>
        <desc id="loop-desc">
          A circle with three stops - Think, Act, Observe - that repeats. When Claude has enough information it leaves the circle to Answer.
        </desc>
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#c7cbe0" />
          </marker>
        </defs>
        <path d={loop} fill="none" stroke="#e4e6f2" strokeWidth="14" />
        <path d={loop} fill="none" stroke="#d4c8ff" strokeWidth="2" strokeDasharray="6 8" />
        <circle r="7" fill="#7550ff" className="animate-orbit" style={{ offsetPath: `path("${loop}")` }} />

        {/* stops */}
        <g>
          <circle cx="200" cy="50" r="38" fill="#f3f0ff" stroke="#b5a1ff" strokeWidth="2" />
          <text x="200" y="47" textAnchor="middle" className="fill-[#5226d6] text-[15px] font-semibold">Think</text>
          <text x="200" y="64" textAnchor="middle" className="fill-slate-500 text-[10px]">Claude</text>
        </g>
        <g>
          <circle cx="304" cy="230" r="38" fill="#ecfdf5" stroke="#6ee7b7" strokeWidth="2" />
          <text x="304" y="227" textAnchor="middle" className="fill-emerald-700 text-[15px] font-semibold">Act</text>
          <text x="304" y="244" textAnchor="middle" className="fill-slate-500 text-[10px]">use a tool</text>
        </g>
        <g>
          <circle cx="96" cy="230" r="38" fill="#f0f9ff" stroke="#7dd3fc" strokeWidth="2" />
          <text x="96" y="227" textAnchor="middle" className="fill-sky-700 text-[15px] font-semibold">Observe</text>
          <text x="96" y="244" textAnchor="middle" className="fill-slate-500 text-[10px]">read result</text>
        </g>

        {/* exit to answer */}
        <path d="M 240 52 C 330 30, 360 60, 372 96" fill="none" stroke="#c7cbe0" strokeWidth="2" markerEnd="url(#arrow)" />
        <text x="318" y="36" className="fill-slate-500 text-[10px]">end_turn</text>
        <rect x="330" y="104" width="112" height="44" rx="14" fill="#fffbeb" stroke="#fcd34d" strokeWidth="2" />
        <text x="386" y="131" textAnchor="middle" className="fill-amber-700 text-[15px] font-semibold">Answer</text>
        <text x="258" y="126" className="fill-slate-500 text-[10px]">tool_use</text>
      </svg>
      <figcaption className="mt-2 text-center text-sm text-slate-500">
        The purple dot is the agent going around the loop. It leaves only when Claude says <code className="font-mono text-xs">end_turn</code>.
      </figcaption>
    </figure>
  );
}

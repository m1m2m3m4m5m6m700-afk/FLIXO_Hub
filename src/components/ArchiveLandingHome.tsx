import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  ArrowRight, ArrowUpRight, Check, Gauge, KeyRound, Layers, Lightbulb,
  Loader2, Menu, Moon, ShieldCheck, Sparkles, Sun, Wand2, X,
} from 'lucide-react';
import { TOOL_CATALOG } from '../config/registry';
import { ROADMAP_CATEGORIES } from '../data/roadmap-categories';
import { LOCALES } from '../lib/i18n';
import { classifyHomeIntent, type AssistantResult } from '../lib/home-intent-classifier';

type Tool = (typeof TOOL_CATALOG.all)[number];

const reasons = [
  ['speed', Gauge, 'Fast by default', 'Browser-first workflows that keep the common path quick and direct.'],
  ['consistency', Layers, 'One consistent surface', 'Every tool follows the same calm interaction model instead of feeling like a separate product.'],
  ['privacy', ShieldCheck, 'Private by design', 'Direct browser processing keeps the user in control of their files and actions.'],
  ['access', KeyRound, 'Open to everyone', 'No account wall for the core experience. Pick a tool and start working.'],
] as const;

const examples = ['Translate a PDF to Arabic', 'Remove image background', 'Format messy JSON'];

function toolRoute(tool: Tool) { return tool.routes.ar ?? tool.routes.en ?? tool.path; }
function categoryMatch(tool: Tool, id: string) {
  const c = String(tool.category ?? '').toLowerCase();
  const f = String(tool.family ?? '').toLowerCase();
  if (id === 'translation') return c.includes('translation') || f.includes('translation');
  if (id === 'images') return c.includes('image') || f === 'image' || f === 'images';
  if (id === 'pdf') return c.includes('pdf');
  if (id === 'writing') return c.includes('writing');
  if (id === 'video') return c.includes('video') || f === 'video';
  if (id === 'audio') return c.includes('audio') || f === 'audio';
  if (id === 'files') return c.includes('file');
  if (id === 'utilities') return c.includes('utilit');
  if (id === 'converters') return c.includes('convert');
  if (id === 'calculators') return c.includes('calcul');
  if (id === 'web') return c.includes('web');
  if (id === 'developer') return c.includes('developer');
  if (id === 'ai') return c === 'ai' || f === 'ai';
  if (id === 'future') return c.includes('future') || f.includes('future');
  return false;
}
function statusOf(tool: Tool) {
  if (tool.isReady) return ['Ready','bg-primary/12 text-primary'];
  return tool.capability.state === 'UNAVAILABLE'
    ? ['Idea','bg-muted text-muted-foreground']
    : ['Planned','bg-accent/15 text-accent-foreground'];
}
function assistantCopy(r: AssistantResult) {
  if (r.kind === 'fallback') return 'No match yet. Tell us what you need and we will build it.';
  return r.toolTitle ? `Looks like ${r.category.name} — try ${r.toolTitle}.` : `Looks like ${r.category.name}.`;
}

export function ArchiveLandingHome() {
  const [prompt, setPrompt] = useState('');
  const [assistant, setAssistant] = useState<AssistantResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestText, setRequestText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem('flixo-archive-theme') !== 'light';
    } catch {
      return true;
    }
  });
  const navigate = useNavigate();
  const translator = TOOL_CATALOG.ready.find((t) => t.id === 'translator') ?? TOOL_CATALOG.ready[0];
  const translatorPath = translator ? toolRoute(translator) : '/';

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem('flixo-archive-theme', dark ? 'dark' : 'light');
    } catch {
      return;
    }
  }, [dark]);

  const openRequest = (text = prompt) => {
    setRequestText(text);
    setSubmitted(false);
    setRequestOpen(true);
  };
  const runAssistant = (text: string) => {
    if (!text.trim()) return;
    setLoading(true); setAssistant(null);
    window.setTimeout(() => { setAssistant(classifyHomeIntent(text)); setLoading(false); }, 450);
  };
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMenuOpen(false);
  };
  const submitRequest = (e: FormEvent) => { e.preventDefault(); if (requestText.trim()) setSubmitted(true); };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><Sparkles className="size-4" /></span>
            <span className="font-display text-lg font-bold tracking-tight">Flixo</span>
          </Link>
          <nav className="ms-4 hidden items-center gap-1 md:flex">
            <button onClick={() => scrollTo('categories')} className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground">Tools</button>
            <button onClick={() => scrollTo('why')} className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground">Why Flixo</button>
            <button onClick={() => scrollTo('faq')} className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface hover:text-foreground">FAQ</button>
          </nav>
          <div className="ms-auto flex shrink-0 items-center gap-1.5">
            <label htmlFor="flixo-language" className="sr-only">Language</label>
            <select id="flixo-language" defaultValue="en" onChange={(e) => navigate(e.target.value === 'en' ? { to: '/' } : { to: '/$locale', params: { locale: e.target.value } })} className="rounded-xl border border-border bg-transparent px-2 py-2 text-xs text-muted-foreground outline-none">
              {LOCALES.map((locale) => <option key={locale} value={locale}>{locale}</option>)}
            </select>
            <button type="button" aria-label="Toggle theme" onClick={() => setDark((v) => !v)} className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-surface hover:text-foreground">
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
            <Link to={translatorPath} className="hidden rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground sm:inline-flex">Open translator</Link>
            <button type="button" aria-label="Toggle menu" onClick={() => setMenuOpen((v) => !v)} className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-surface hover:text-foreground md:hidden">
              {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="border-t border-border/60 px-5 py-3 md:hidden">
            <div className="mx-auto flex max-w-6xl flex-col gap-1">
              <button onClick={() => scrollTo('categories')} className="rounded-lg px-3 py-2 text-start text-sm text-muted-foreground hover:bg-surface hover:text-foreground">Tools</button>
              <button onClick={() => scrollTo('why')} className="rounded-lg px-3 py-2 text-start text-sm text-muted-foreground hover:bg-surface hover:text-foreground">Why Flixo</button>
              <button onClick={() => scrollTo('faq')} className="rounded-lg px-3 py-2 text-start text-sm text-muted-foreground hover:bg-surface hover:text-foreground">FAQ</button>
              <Link to={translatorPath} onClick={() => setMenuOpen(false)} className="mt-2 rounded-xl bg-primary px-4 py-2 text-center text-sm font-semibold text-primary-foreground">Open translator</Link>
            </div>
          </nav>
        )}
      </header>

      <main>
        <section className="relative overflow-hidden bg-hero-glow">
          <div className="pointer-events-none absolute inset-0 grid-lines opacity-40 [mask-image:radial-gradient(70%_60%_at_50%_0%,black,transparent)]" />
          <div className="pointer-events-none absolute -top-24 left-1/2 size-[420px] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl animate-float" />
          <div className="relative mx-auto max-w-3xl px-5 pb-20 pt-20 text-center md:pb-28 md:pt-32">
            <span className="inline-flex animate-rise items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
              <Sparkles className="size-3.5 text-primary" /> One workspace for every AI tool
            </span>
            <h1 className="mt-6 animate-rise bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text font-display text-5xl font-bold leading-[1.02] tracking-tight text-transparent md:text-7xl">Flixo</h1>
            <p className="mx-auto mt-5 max-w-xl animate-rise text-base leading-relaxed text-muted-foreground md:text-lg" style={{ animationDelay: '160ms' }}>
              A growing directory of fast, private AI tools — translation, images, PDF, writing, audio, video and more. Describe your task and Flixo points you to the right one.
            </p>

            <div className="mx-auto mt-10 max-w-2xl animate-rise" style={{ animationDelay: '300ms' }}>
              <div className="rounded-3xl border border-border bg-card/80 p-2 shadow-lift backdrop-blur-xl">
                <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 sm:flex">
                  <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><Wand2 className="size-5" /></span>
                  <label htmlFor="assistant-input" className="sr-only">Describe what you want to do</label>
                  <input id="assistant-input" value={prompt} onChange={(e) => { setPrompt(e.target.value); setAssistant(null); }} onKeyDown={(e) => e.key === 'Enter' && runAssistant(prompt)} placeholder="Describe what you need — Flixo finds the tool" className="col-span-2 min-w-0 flex-1 bg-transparent px-2 py-3 text-base outline-none placeholder:text-muted-foreground sm:col-span-1" />
                  <button type="button" onClick={() => runAssistant(prompt)} disabled={loading || !prompt.trim()} className="col-span-2 inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50 sm:col-span-1">
                    {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{loading ? 'Thinking' : 'Find tool'}
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {examples.map((example) => <button key={example} type="button" onClick={() => { setPrompt(example); runAssistant(example); }} className="rounded-full border border-border bg-surface/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">{example}</button>)}
              </div>

              {loading && <div className="mt-5 rounded-2xl border border-dashed border-border bg-surface/40 p-8 text-center"><Loader2 className="mx-auto size-5 animate-spin text-primary" /></div>}

              {assistant && !loading && (
                <div className="mt-5 animate-rise rounded-2xl border border-border bg-surface/60 p-5 text-start backdrop-blur">
                  <div className="flex items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent-foreground"><Lightbulb className="size-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-relaxed">{assistantCopy(assistant)}</p>
                      {assistant.kind === 'match' && <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-muted-foreground"><Check className="size-3.5" />{assistant.category.name}</span>
                        {assistant.matchedKeywords.length > 0 && <span className="rounded-full border border-border px-2.5 py-1 text-muted-foreground">Matched: {assistant.matchedKeywords.slice(0, 3).join(', ')}</span>}
                      </div>}
                      {assistant.kind === 'match' && assistant.toolPath
                        ? <div className="mt-4"><Link to={assistant.toolPath} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">{assistant.toolTitle ?? 'Open tool'}<ArrowRight className="size-4" /></Link></div>
                        : <button type="button" onClick={() => openRequest(prompt)} className="mt-4 rounded-xl border border-border px-3 py-2 text-sm font-medium hover:text-foreground">Not built yet — request it</button>}
                    </div>
                  </div>
                  <button type="button" onClick={() => { setAssistant(null); setPrompt(''); }} className="mt-4 text-xs text-muted-foreground hover:text-foreground">Clear result</button>
                </div>
              )}

              {!assistant && !loading && <div className="mt-4 rounded-2xl border border-dashed border-border bg-surface/40 p-8 text-center"><Sparkles className="mx-auto size-5 text-muted-foreground/60" /><p className="mt-2 text-sm font-medium text-muted-foreground">Start by describing what you want to do.</p><p className="mt-1 text-xs text-muted-foreground/80">Flixo will point you to the closest available tool.</p></div>}
            </div>

            <dl className="mx-auto mt-10 grid max-w-md animate-rise grid-cols-3 gap-3" style={{ animationDelay: '440ms' }}>
              {[['Categories', ROADMAP_CATEGORIES.length], ['Tools mapped', TOOL_CATALOG.all.length], ['Live now', TOOL_CATALOG.ready.length]].map(([label, value]) =>
                <div key={String(label)} className="rounded-2xl border border-border bg-card/60 px-3 py-4 backdrop-blur"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-display text-2xl font-bold">{value}</dd></div>
              )}
            </dl>
          </div>
        </section>

        <section id="categories" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20 md:py-28">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <span className="inline-flex rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Categories</span>
            <h2 className="mt-4 text-3xl font-bold text-balance md:text-4xl">Every tool has a home</h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">Fourteen hubs cover the work people actually bring to Flixo. Jump straight to a hub or scroll the full directory below.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ROADMAP_CATEGORIES.map((category) => {
              const Icon = category.icon;
              const tools = TOOL_CATALOG.all.filter((tool) => categoryMatch(tool, category.id));
              const ready = tools.filter((tool) => tool.isReady).length;
              return <a key={category.id} href={`#cat-${category.anchor}`} className="group flex h-full flex-col rounded-2xl border border-border bg-card/70 p-6 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lift">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span>
                  <span className={ready > 0 ? 'rounded-full bg-primary/12 px-2.5 py-1 text-[11px] font-medium text-primary' : 'rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground'}>{ready > 0 ? `${ready} live` : 'Coming soon'}</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold">{category.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{category.description}</p>
                <p className="mt-auto pt-5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground/60">{tools.length} tools</p>
              </a>;
            })}
          </div>
        </section>

        <section id="tools" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20 md:py-28">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <span className="inline-flex rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Directory</span>
            <h2 className="mt-4 text-3xl font-bold text-balance md:text-4xl">All Flixo tools</h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">Everything on the roadmap, grouped by hub. Ready tools open instantly; anything else can be nudged up the queue with a request.</p>
          </div>
          <div className="space-y-14">
            {ROADMAP_CATEGORIES.map((category) => {
              const Icon = category.icon;
              const tools = TOOL_CATALOG.all.filter((tool) => categoryMatch(tool, category.id));
              if (!tools.length) return null;
              return <div key={category.id} id={`cat-${category.anchor}`} className="scroll-mt-24">
                <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span>
                  <div className="min-w-0"><h3 className="truncate text-lg font-semibold">{category.name}</h3><p className="truncate text-xs text-muted-foreground">{category.description}</p></div>
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {tools.map((tool) => {
                    const [status, style] = statusOf(tool);
                    const route = tool.isReady ? toolRoute(tool) : undefined;
                    const card = <div className="flex h-full flex-col rounded-2xl border border-border bg-card/60 p-5 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lift">
                      <div className="flex items-start justify-between gap-3"><h4 className="min-w-0 text-sm font-semibold">{tool.title}</h4><span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${style}`}>{status}</span></div>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{tool.description}</p>
                      {route && <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary">Open tool<ArrowUpRight className="size-3.5" /></span>}
                    </div>;
                    return route ? <Link key={tool.id} to={route} className="block h-full">{card}</Link> : <button key={tool.id} type="button" onClick={() => openRequest(tool.title)} className="block h-full w-full text-start">{card}</button>;
                  })}
                </div>
              </div>;
            })}
          </div>
          <div className="mt-16 rounded-3xl border border-border bg-card/60 p-8 text-center backdrop-blur">
            <h3 className="text-xl font-semibold">Missing something?</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Tell us the tool you wish existed — requests shape what we ship next.</p>
            <button type="button" className="mt-5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" onClick={() => openRequest()}>Request a tool</button>
          </div>
        </section>

        <section id="why" className="border-y border-border/60 bg-surface/40">
          <div className="mx-auto max-w-6xl px-5 py-20 md:py-24">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <span className="inline-flex rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Why Flixo</span>
              <h2 className="mt-4 text-3xl font-bold md:text-4xl">A calmer toolkit for real work.</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {reasons.map(([id, Icon, title, body]) => <div key={id} className="flex gap-4 rounded-2xl border border-border bg-card p-6">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent-foreground"><Icon className="size-5" /></span>
                <div><h3 className="text-base font-semibold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p></div>
              </div>)}
            </div>
          </div>
        </section>

        <section id="stats" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20 md:py-24">
          <div className="grid gap-px overflow-hidden rounded-3xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Live tools', TOOL_CATALOG.ready.length],
              ['Tool hubs', ROADMAP_CATEGORIES.length],
              ['Mapped tools', TOOL_CATALOG.all.length],
              ['Private', 'Browser-first'],
            ].map(([label, value]) => <div key={String(label)} className="bg-card px-6 py-10 text-center"><p className="font-display text-4xl font-bold text-gradient-brand">{value}</p><p className="mt-2 text-sm text-muted-foreground">{label}</p></div>)}
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20 md:py-28">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <span className="inline-flex rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">FAQ</span>
            <h2 className="mt-4 text-3xl font-bold md:text-4xl">Questions, answered.</h2>
          </div>
          <div className="mx-auto max-w-2xl">
            {[
              ['Are these real tools?','Ready entries are connected to the current FLIXO tool registry and open their real routes.'],
              ['Did the architecture change?','No. This page uses the existing FLIXO registry, routes, execution contracts, and runtime.'],
              ['Does the assistant execute work?','No. It classifies the request locally and points to an available tool.'],
              ['What happens to unavailable tools?','They remain visible as planned or idea entries and can be requested without fabricating an execution route.'],
              ['Can I use the page on mobile?','Yes. The same component hierarchy collapses responsively for narrow screens.'],
            ].map(([q,a]) => <details key={q} className="border-b border-border py-4"><summary className="cursor-pointer font-medium">{q}</summary><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a}</p></details>)}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 bg-surface/60">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
          <div><div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground"><Sparkles className="size-4" /></span><span className="font-display text-lg font-bold">Flixo</span></div><p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">A calm browser-first home for practical AI and digital tools.</p></div>
          <div><h3 className="text-sm font-semibold">Product</h3><ul className="mt-4 space-y-2.5"><li><a href="#tools" className="text-sm text-muted-foreground hover:text-foreground">Tools</a></li><li><a href="#why" className="text-sm text-muted-foreground hover:text-foreground">Why Flixo</a></li><li><a href="#stats" className="text-sm text-muted-foreground hover:text-foreground">Numbers</a></li><li><a href="#faq" className="text-sm text-muted-foreground hover:text-foreground">FAQ</a></li><li><button type="button" onClick={() => openRequest()} className="text-sm text-muted-foreground hover:text-foreground">Request a tool</button></li></ul></div>
          <div><h3 className="text-sm font-semibold">Featured tools</h3><ul className="mt-4 space-y-2.5">{TOOL_CATALOG.ready.slice(0,8).map((tool) => <li key={tool.id}><Link to={toolRoute(tool)} className="text-sm text-muted-foreground hover:text-foreground">{tool.title}</Link></li>)}</ul></div>
        </div>
        <div className="border-t border-border/60"><div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><p>© {new Date().getFullYear()} Flixo</p><p>One workspace for every AI tool.</p></div></div>
      </footer>

      {requestOpen && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/55 p-5" onMouseDown={(e) => { if (e.target === e.currentTarget) setRequestOpen(false); }}>
        <div role="dialog" aria-modal="true" aria-labelledby="request-title" className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-lift">
          <button type="button" onClick={() => setRequestOpen(false)} aria-label="Close" className="float-end grid size-9 place-items-center rounded-xl text-muted-foreground hover:bg-surface"><X className="size-4" /></button>
          {submitted ? <div className="flex flex-col items-center py-6 text-center"><span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Check className="size-6" /></span><h2 className="mt-4 text-lg font-semibold">Request received</h2><p className="mt-2 max-w-xs text-sm text-muted-foreground">Thanks. Your request has been captured for the current FLIXO product queue.</p><button type="button" onClick={() => setRequestOpen(false)} className="mt-6 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Done</button></div>
          : <form onSubmit={submitRequest}><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-xl bg-accent/15 text-accent-foreground"><Lightbulb className="size-4" /></span><h2 id="request-title" className="text-lg font-semibold">Request a tool</h2></div><p className="mt-2 text-sm text-muted-foreground">Tell us what you wish existed.</p><label htmlFor="request-description" className="mt-6 block text-sm font-medium">What should the tool do?</label><textarea id="request-description" rows={4} value={requestText} onChange={(e) => setRequestText(e.target.value)} className="mt-2 w-full resize-none rounded-2xl border border-border bg-background/50 p-3 text-sm outline-none focus:border-primary" placeholder="Describe the tool you want…" /><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setRequestOpen(false)} className="rounded-xl px-4 py-2 text-sm text-muted-foreground hover:bg-surface">Cancel</button><button type="submit" disabled={!requestText.trim()} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Submit</button></div></form>}
        </div>
      </div>}
    </div>
  );
}

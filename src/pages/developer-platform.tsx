import { Link } from '@tanstack/react-router';
import { PROGRAMMING_PLATFORM_CAPABILITIES } from '../lib/developer-platform/platform-registry';
import type { PlatformCapabilityState } from '../lib/developer-platform/platform-contract';
import '../developer-platform.css';

type Locale = 'ar' | 'en';

const COPY = {
  ar: {
    eyebrow: 'FLIXO HUB · DEVELOPER PLATFORM',
    title: 'منصة برمجة عامة، موحّدة وحاكمة.',
    lead: 'مساحة واحدة للمشاريع والكود والتنفيذ والاختبارات والوكلاء وGitHub والمساهمات — مع بقاء كل تنفيذ حقيقي خلف حدود الصلاحية والتحقق وExact-SHA.',
    back: 'العودة إلى FLIXO Hub',
    project: 'المشروع الحالي',
    projectName: 'FLIXO Hub',
    branch: 'execution',
    source: 'هوية المصدر',
    sourceValue: 'Exact-SHA',
    nav: ['Workspace', 'Repository', 'Execution', 'Verification', 'Agents', 'Contributions'],
    foundation: 'طبقة أساس',
    integrated: 'مُدمج',
    external: 'خارجي',
    blocked: 'محجوز',
    capabilities: 'مصفوفة القدرات',
    trustTitle: 'قواعد التنفيذ',
    trust: [
      ['هوية المصدر', 'كل مهمة تنفيذية مرتبطة بـ SHA حالي؛ تغيّر SHA يبطل الدليل.'],
      ['العزل', 'التنفيذ العام مستهدف لسandbox مؤقت بموارد وحدود شبكة صريحة.'],
      ['الأسرار', 'المتغيرات تُمرّر كأسماء مفحوصة، لا كقيم خام إلى الواجهة أو الـagent.'],
      ['التحقق', 'النجاح يحتاج اختبارًا وأدلة؛ الـmock لا يتحول إلى Green.'],
    ],
    contributionTitle: 'حلقة الفائدة المتبادلة',
    contributionText: 'المستخدم ينشئ مشروعًا أو أداة أو Agent أو Skill؛ المنصة تتحقق منها؛ المجتمع يستفيد منها؛ والنتائج الموثوقة تصبح خبرة قابلة لإعادة الاستخدام دون منح سلطة جديدة للوكلاء.',
    currentBoundary: 'الحالة الحالية',
    currentBoundaryText: 'هذه الواجهة هي shell حقيقي لعقد المنصة وليست terminal وهميًا. موفّر التنفيذ العام لم يُعتبر متصلًا حتى يقدم evidence مستقلًا.',
    open: 'فتح الـHub المحلي',
    workspace: 'فتح مساحة المشروع المحلية',
  },
  en: {
    eyebrow: 'FLIXO HUB · DEVELOPER PLATFORM',
    title: 'A governed general-purpose programming platform.',
    lead: 'One surface for projects, code, execution, verification, agents, GitHub, and contributions — with every real mutation behind capability, scope, and exact-SHA controls.',
    back: 'Back to FLIXO Hub',
    project: 'Current project',
    projectName: 'FLIXO Hub',
    branch: 'execution',
    source: 'Source identity',
    sourceValue: 'Exact-SHA',
    nav: ['Workspace', 'Repository', 'Execution', 'Verification', 'Agents', 'Contributions'],
    foundation: 'Foundation',
    integrated: 'Integrated',
    external: 'External',
    blocked: 'Blocked',
    capabilities: 'Capability matrix',
    trustTitle: 'Execution rules',
    trust: [
      ['Source identity', 'Every execution request binds to the current SHA; SHA drift invalidates evidence.'],
      ['Isolation', 'General execution targets an ephemeral sandbox with explicit resource and network limits.'],
      ['Secrets', 'Environment values are brokered by name and policy, never exposed as raw browser or agent state.'],
      ['Verification', 'Green requires evidence; a mock result never becomes Green.'],
    ],
    contributionTitle: 'Mutual value loop',
    contributionText: 'People publish projects, tools, agents, and skills; the platform verifies them; others reuse trusted results; learning becomes reusable evidence without granting new authority to agents.',
    currentBoundary: 'Current boundary',
    currentBoundaryText: 'This is a real platform shell backed by the canonical contract, not a fake terminal. General execution stays unconnected until an independent provider proof exists.',
    open: 'Open local Hub',
    workspace: 'Open local project workspace',
  },
} as const;

function stateLabel(state: PlatformCapabilityState, locale: Locale): string {
  const copy = COPY[locale];
  if (state === 'INTEGRATED') return copy.integrated;
  if (state === 'EXTERNAL') return copy.external;
  if (state === 'BLOCKED') return copy.blocked;
  return copy.foundation;
}

export function DeveloperPlatform({ locale }: { locale: Locale }) {
  const copy = COPY[locale];

  return (
    <main className="developer-platform" lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div className="developer-platform-shell">
        <header className="developer-platform-header">
          <div>
            <Link to={locale === 'ar' ? '/hub' : '/en/hub'} className="developer-platform-back">← {copy.back}</Link>
            <p className="developer-platform-eyebrow">{copy.eyebrow}</p>
            <h1>{copy.title}</h1>
            <p className="developer-platform-lead">{copy.lead}</p>
          </div>
          <div className="developer-platform-project-card">
            <span>{copy.project}</span>
            <strong>{copy.projectName}</strong>
            <small>{copy.branch} · {copy.sourceValue}</small>
          </div>
        </header>

        <nav className="developer-platform-tabs" aria-label={locale === 'ar' ? 'أقسام المنصة' : 'Platform sections'}>
          {copy.nav.map((item, index) => (
            <button key={item} type="button" className={index === 0 ? 'is-active' : ''} aria-pressed={index === 0}>
              {item}
            </button>
          ))}
        </nav>

        <section className="developer-platform-grid" aria-labelledby="platform-capabilities-title">
          <div className="developer-platform-main-card">
            <div className="developer-platform-card-heading">
              <div>
                <span className="developer-platform-kicker">01</span>
                <h2 id="platform-capabilities-title">{copy.capabilities}</h2>
              </div>
              <span className="developer-platform-source">{copy.source}: {copy.sourceValue}</span>
            </div>
            <div className="developer-platform-capabilities">
              {PROGRAMMING_PLATFORM_CAPABILITIES.map((capability) => (
                <article key={capability.id} className="developer-platform-capability">
                  <div className="developer-platform-capability-top">
                    <span className="developer-platform-family">{capability.family}</span>
                    <span className={'developer-platform-state state-' + capability.state.toLowerCase()}>{stateLabel(capability.state, locale)}</span>
                  </div>
                  <h3>{capability.id}</h3>
                  <p>{capability.description}</p>
                  <small>{capability.authority} · {capability.executionMode}</small>
                </article>
              ))}
            </div>
          </div>

          <aside className="developer-platform-side">
            <section className="developer-platform-side-card">
              <span className="developer-platform-kicker">02</span>
              <h2>{copy.trustTitle}</h2>
              <div className="developer-platform-trust-list">
                {copy.trust.map(([title, text]) => (
                  <div key={title}>
                    <strong>{title}</strong>
                    <p>{text}</p>
                  </div>
                ))}
              </div>
            </section>
            <section className="developer-platform-side-card developer-platform-boundary">
              <span className="developer-platform-kicker">03</span>
              <h2>{copy.currentBoundary}</h2>
              <p>{copy.currentBoundaryText}</p>
              <div className="developer-platform-actions">
                <Link to={locale === 'ar' ? '/developer/workspace' : '/en/developer/workspace'} className="developer-platform-button">
                  {copy.workspace}
                </Link>
                <Link to={locale === 'ar' ? '/hub' : '/en/hub'} className="developer-platform-secondary-button">
                  {copy.open}
                </Link>
              </div>
            </section>
          </aside>
        </section>

        <section className="developer-platform-contribution" aria-labelledby="contribution-title">
          <div>
            <span className="developer-platform-kicker">04</span>
            <h2 id="contribution-title">{copy.contributionTitle}</h2>
          </div>
          <p>{copy.contributionText}</p>
        </section>
      </div>
    </main>
  );
}

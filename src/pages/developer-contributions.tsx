import { useMemo, useState } from 'react';
import { BookOpen, ExternalLink, GitPullRequest, PackageCheck, ShieldCheck, Users } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import {
  CONTRIBUTION_REGISTRY,
  CONTRIBUTION_REGISTRY_VERSION,
  contributionKinds,
  getPublishedContributions,
  type ContributionKind,
  type ContributionStatus,
} from '../lib/developer-platform/contribution-registry';
import '../developer-contributions.css';

type Locale = 'ar' | 'en';

const COPY = {
  ar: {
    back: 'العودة إلى منصة البرمجة',
    eyebrow: 'DEVELOPER PLATFORM · CONTRIBUTIONS',
    title: 'مركز المساهمات القابلة لإعادة الاستخدام.',
    lead: 'تستضيف FLIXO المساهمات داخل Git، وتفهرسها هنا، ولا تعتبرها قابلة لإعادة الاستخدام العام إلا بعد تحقق مستقل وأدلة Exact-SHA.',
    submit: 'اقتراح مساهمة',
    docs: 'دليل المساهمات',
    published: 'منشورة',
    references: 'مراجع أساسية',
    kinds: 'أنواع',
    lifecycleTitle: 'دورة حياة المساهمة',
    lifecycle: ['PROPOSED', 'VALIDATING', 'VERIFIED', 'PUBLISHED', 'DEPRECATED'],
    catalogTitle: 'فهرس المساهمات',
    all: 'الكل',
    publishedOnly: 'المنشورة فقط',
    referencesOnly: 'مراجع FLIXO',
    contributor: 'المساهم',
    version: 'الإصدار',
    reuse: 'إعادة الاستخدام',
    evidence: 'الدليل',
    source: 'المصدر',
    emptyPublished: 'لا توجد مساهمات مجتمعية منشورة بعد. البنية جاهزة، ولا حاجة لاختراع محتوى كي يبدو الفهرس مزدحمًا.',
    packageTitle: 'حزمة المساهمة',
    packageText: 'المساهمة الجديدة تُستضاف كسطح Git مستقل تحت contributions/ مع manifest ووثائق واختبارات. الفهرس لا يمنحها سلطة تنفيذية.',
    packageCode: 'contributions/<slug>/\n  contribution.json\n  README.md\n  src/\n  tests/',
    trustTitle: 'قواعد النشر',
    trust: [
      ['Exact-SHA', 'التحقق مرتبط بالـSHA المرشح؛ أي انجراف يعيد المساهمة إلى التحقق.'],
      ['Attribution', 'المساهم والإصدار والترخيص ومسارات المصدر جزء من السجل.'],
      ['Evidence', 'حالتا Verified وPublished تعتمدان على دليل صالح، لا على رأي في PR.'],
      ['Authority', 'المساهمة لا تنشئ Registry أو Executor أو Verifier أو Certification Authority جديدة.'],
    ],
    referenceLabel: 'مكوّن مرجعي',
    publishedLabel: 'منشورة',
    proposedLabel: 'مقترحة',
    validatingLabel: 'قيد التحقق',
    verifiedLabel: 'متحقق منها',
    deprecatedLabel: 'متقاعدة',
  },
  en: {
    back: 'Back to Developer Platform',
    eyebrow: 'DEVELOPER PLATFORM · CONTRIBUTIONS',
    title: 'Reusable contribution center.',
    lead: 'FLIXO hosts contributions in Git, indexes them here, and treats them as reusable only after independent verification and Exact-SHA evidence.',
    submit: 'Propose a contribution',
    docs: 'Contribution guide',
    published: 'Published',
    references: 'Core references',
    kinds: 'Kinds',
    lifecycleTitle: 'Contribution lifecycle',
    lifecycle: ['PROPOSED', 'VALIDATING', 'VERIFIED', 'PUBLISHED', 'DEPRECATED'],
    catalogTitle: 'Contribution catalog',
    all: 'All',
    publishedOnly: 'Published only',
    referencesOnly: 'FLIXO references',
    contributor: 'Contributor',
    version: 'Version',
    reuse: 'Reuse',
    evidence: 'Evidence',
    source: 'Source',
    emptyPublished: 'No community contributions are published yet. The structure is ready; inventing entries would only make the catalog look busy.',
    packageTitle: 'Contribution package',
    packageText: 'A new contribution is hosted as a self-contained Git surface under contributions/, with a manifest, docs, and tests. Registry admission never grants execution authority.',
    packageCode: 'contributions/<slug>/\n  contribution.json\n  README.md\n  src/\n  tests/',
    trustTitle: 'Publication rules',
    trust: [
      ['Exact-SHA', 'Verification binds to the candidate SHA; drift returns the contribution to verification.'],
      ['Attribution', 'Contributor, version, license, and source paths are part of the registry.'],
      ['Evidence', 'Verified and Published are evidence-backed states, not PR opinions.'],
      ['Authority', 'A contribution cannot create a second registry, executor, verifier, or certification authority.'],
    ],
    referenceLabel: 'Core reference',
    publishedLabel: 'Published',
    proposedLabel: 'Proposed',
    validatingLabel: 'Validating',
    verifiedLabel: 'Verified',
    deprecatedLabel: 'Deprecated',
  },
} as const;

function statusLabel(status: ContributionStatus, locale: Locale): string {
  const c = COPY[locale];
  if (status === 'CORE_REFERENCE') return c.referenceLabel;
  if (status === 'PUBLISHED') return c.publishedLabel;
  if (status === 'PROPOSED') return c.proposedLabel;
  if (status === 'VALIDATING') return c.validatingLabel;
  if (status === 'VERIFIED') return c.verifiedLabel;
  return c.deprecatedLabel;
}

function kindLabel(kind: ContributionKind): string {
  return kind.replaceAll('_', ' ');
}

export function DeveloperContributions({ locale }: { locale: Locale }) {
  const c = COPY[locale];
  const [filter, setFilter] = useState<'ALL' | 'PUBLISHED' | 'CORE_REFERENCE'>('ALL');
  const records = useMemo(() => {
    if (filter === 'PUBLISHED') return getPublishedContributions();
    if (filter === 'CORE_REFERENCE') return CONTRIBUTION_REGISTRY.filter((record) => record.status === 'CORE_REFERENCE');
    return CONTRIBUTION_REGISTRY;
  }, [filter]);
  const publishedCount = getPublishedContributions().length;
  const referencesCount = CONTRIBUTION_REGISTRY.filter((record) => record.status === 'CORE_REFERENCE').length;

  return (
    <main className="developer-contributions" lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div className="developer-contributions-shell">
        <header className="developer-contributions-header">
          <div>
            <Link to={locale === 'ar' ? '/developer' : '/en/developer'} className="developer-contributions-back">← {c.back}</Link>
            <p className="developer-contributions-eyebrow">{c.eyebrow}</p>
            <h1>{c.title}</h1>
            <p className="developer-contributions-lead">{c.lead}</p>
          </div>
          <div className="developer-contributions-actions">
            <Link to="/developer/contribute" className="developer-contributions-primary"><GitPullRequest size={17} /> {c.submit}</Link>
            <a href="https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub/blob/execution/docs/CONTRIBUTIONS.md" target="_blank" rel="noreferrer" className="developer-contributions-secondary"><BookOpen size={17} /> {c.docs}</a>
          </div>
        </header>
        <section className="developer-contributions-stats" aria-label="Contribution statistics">
          <div><PackageCheck size={18} /><strong>{publishedCount}</strong><span>{c.published}</span></div>
          <div><ShieldCheck size={18} /><strong>{referencesCount}</strong><span>{c.references}</span></div>
          <div><Users size={18} /><strong>{contributionKinds().length}</strong><span>{c.kinds}</span></div>
          <div><span className="developer-contributions-registry-version">Registry {CONTRIBUTION_REGISTRY_VERSION}</span></div>
        </section>
        <section className="developer-contributions-lifecycle" aria-labelledby="contribution-lifecycle-title">
          <div className="developer-contributions-section-heading"><span>01</span><h2 id="contribution-lifecycle-title">{c.lifecycleTitle}</h2></div>
          <div className="developer-contributions-lifecycle-track">
            {c.lifecycle.map((step, index) => <div key={step} className="developer-contributions-life-step"><b>{String(index + 1).padStart(2, '0')}</b><span>{step}</span></div>)}
          </div>
        </section>
        <section className="developer-contributions-catalog" aria-labelledby="contribution-catalog-title">
          <div className="developer-contributions-section-heading"><span>02</span><h2 id="contribution-catalog-title">{c.catalogTitle}</h2></div>
          <div className="developer-contributions-filters">
            {([['ALL', c.all], ['PUBLISHED', c.publishedOnly], ['CORE_REFERENCE', c.referencesOnly]] as const).map(([value, label]) => (
              <button key={value} type="button" className={filter === value ? 'is-active' : ''} onClick={() => setFilter(value)}>{label}</button>
            ))}
          </div>
          {records.length === 0 ? (
            <div className="developer-contributions-empty"><PackageCheck size={30} /><p>{c.emptyPublished}</p></div>
          ) : (
            <div className="developer-contributions-grid">
              {records.map((record) => (
                <article key={record.id} className="developer-contribution-card">
                  <div className="developer-contribution-card-top"><span>{kindLabel(record.kind)}</span><b>{statusLabel(record.status, locale)}</b></div>
                  <h3>{record.title}</h3>
                  <p>{record.summary}</p>
                  <dl>
                    <div><dt>{c.contributor}</dt><dd>{record.contributor}</dd></div>
                    <div><dt>{c.version}</dt><dd>{record.version}</dd></div>
                    <div><dt>{c.reuse}</dt><dd>{record.reuse}</dd></div>
                    <div><dt>{c.evidence}</dt><dd>{record.evidencePolicy}</dd></div>
                  </dl>
                  <div className="developer-contribution-paths"><strong>{c.source}</strong>{record.sourcePaths.map((path) => <code key={path}>{path}</code>)}</div>
                </article>
              ))}
            </div>
          )}
        </section>
        <section className="developer-contributions-bottom-grid">
          <article className="developer-contributions-package">
            <div className="developer-contributions-section-heading"><span>03</span><h2>{c.packageTitle}</h2></div>
            <p>{c.packageText}</p>
            <pre><code>{c.packageCode}</code></pre>
          </article>
          <article className="developer-contributions-trust">
            <div className="developer-contributions-section-heading"><span>04</span><h2>{c.trustTitle}</h2></div>
            <div className="developer-contributions-trust-list">
              {c.trust.map(([title, text]) => <div key={title}><strong>{title}</strong><p>{text}</p></div>)}
            </div>
          </article>
        </section>
        <footer className="developer-contributions-footer">
          <a href="https://github.com/m1m2m3m4m5m6m700-afk/FLIXO_Hub" target="_blank" rel="noreferrer">FLIXO Hub <ExternalLink size={14} /></a>
          <span>Apache-2.0 · Git-hosted contributions · Exact-SHA evidence</span>
        </footer>
      </div>
    </main>
  );
}

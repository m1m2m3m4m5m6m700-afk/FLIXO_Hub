import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Download, FileCheck2, ShieldCheck } from 'lucide-react';
import { validateContributionProposal, type ContributionEvidenceIndex, type ContributionProposal } from '../lib/developer-platform/platform-boundaries';
import { downloadBlob } from '../lib/developer-platform/local-project-workspace';
import '../developer-platform.css';

type Kind = ContributionProposal['kind'];

const KINDS: Kind[] = ['PROJECT_TEMPLATE','TOOL','AGENT','SKILL','VERIFIER','RUNTIME_ADAPTER','DOCS','WORKFLOW'];

export function DeveloperContribution() {
  const [contributorId, setContributorId] = useState('');
  const [proposalId, setProposalId] = useState('proposal-1');
  const [kind, setKind] = useState<Kind>('TOOL');
  const [sourceSha, setSourceSha] = useState('');
  const [summary, setSummary] = useState('');
  const [evidenceIds, setEvidenceIds] = useState('');
  const [evidenceDocument, setEvidenceDocument] = useState('');
  const [status, setStatus] = useState('');

  const evidence = useMemo(() => evidenceIds.split(',').map((value) => value.trim()).filter(Boolean), [evidenceIds]);

  const buildProposal = (): ContributionProposal => ({
    proposalId,
    contributorId,
    kind,
    sourceSha,
    summary,
    evidenceIds: evidence,
  });

  const validate = () => {
    const proposal = buildProposal();
    try {
      const evidenceIndex: ContributionEvidenceIndex = evidenceDocument.trim()
        ? JSON.parse(evidenceDocument) as ContributionEvidenceIndex
        : {};
      const ok = validateContributionProposal(proposal, sourceSha, evidenceIndex);
      setStatus(ok ? 'VALID_FOR_ADMISSION' : 'REJECTED_BY_CONTRACT');
      return ok;
    } catch {
      setStatus('INVALID_EVIDENCE_DOCUMENT');
      return false;
    }
  };

  const exportProposal = () => {
    if (!validate()) return;
    const payload = JSON.stringify({ schema: 'flixo-platform-contribution-v1', proposal: buildProposal() }, null, 2);
    downloadBlob(new Blob([payload], { type: 'application/json' }), 'flixo-contribution-proposal.json');
  };

  return (
    <main className="developer-platform" lang="en" dir="ltr">
      <div className="developer-platform-shell">
        <header className="developer-platform-header">
          <div>
            <Link to="/developer" className="developer-platform-back">← Back to Developer Platform</Link>
            <p className="developer-platform-eyebrow">CONTRIBUTION · VERIFIED PROPOSAL</p>
            <h1>Turn an idea into an evidence-bound contribution.</h1>
            <p className="developer-platform-lead">
              Draft a Tool, Agent, Skill, Verifier, Workflow, or runtime adapter proposal. The package stays local until an external admission path reviews it.
            </p>
          </div>
          <div className="developer-platform-project-card">
            <ShieldCheck size={20} />
            <strong>No direct publication</strong>
            <small>Proposal → integrity → review → verification → publication → evidence</small>
          </div>
        </header>

        <section className="developer-platform-main-card" aria-labelledby="contribution-form-title">
          <div className="developer-platform-card-heading">
            <div>
              <span className="developer-platform-kicker">01</span>
              <h2 id="contribution-form-title">Proposal contract</h2>
            </div>
            <span className="developer-platform-source">Local draft</span>
          </div>

          <div className="developer-platform-capabilities">
            <label className="developer-platform-field"><span>Contributor ID</span><input value={contributorId} onChange={(event) => setContributorId(event.target.value)} /></label>
            <label className="developer-platform-field"><span>Proposal ID</span><input value={proposalId} onChange={(event) => setProposalId(event.target.value)} /></label>
            <label className="developer-platform-field"><span>Kind</span><select value={kind} onChange={(event) => setKind(event.target.value as Kind)}>{KINDS.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label className="developer-platform-field"><span>Source SHA</span><input value={sourceSha} onChange={(event) => setSourceSha(event.target.value)} placeholder="40-char exact SHA" /></label>
          </div>

          <label className="developer-platform-field developer-platform-field-wide"><span>Summary</span><textarea value={summary} onChange={(event) => setSummary(event.target.value)} rows={4} /></label>
          <label className="developer-platform-field developer-platform-field-wide"><span>Evidence IDs (comma separated)</span><input value={evidenceIds} onChange={(event) => setEvidenceIds(event.target.value)} /></label>
          <label className="developer-platform-field developer-platform-field-wide"><span>Resolved PASS evidence index (JSON)</span><textarea value={evidenceDocument} onChange={(event) => setEvidenceDocument(event.target.value)} rows={7} placeholder='{"artifact-1":{"evidence":{"artifactId":"artifact-1","sourceSha":"...","digest":"...","mediaType":"application/json","verificationId":"verify-1"},"verification":{"verificationId":"verify-1","sourceSha":"...","checks":["..."],"conclusion":"PASS"}}}' /></label>

          <div className="developer-platform-actions">
            <button type="button" className="developer-platform-button" onClick={validate}><FileCheck2 size={16} />Validate proposal</button>
            <button type="button" className="developer-platform-secondary-button" onClick={exportProposal}><Download size={16} />Export proposal JSON</button>
          </div>

          {status && <p className="developer-platform-proposal-status" role="status">{status}</p>}
        </section>
      </div>
    </main>
  );
}

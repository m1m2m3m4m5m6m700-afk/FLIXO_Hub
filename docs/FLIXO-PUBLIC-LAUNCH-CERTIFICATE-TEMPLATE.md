# FLIXO Public Launch Certificate

Status: NOT CERTIFIED

REPOSITORY: m1m2m3m4m5m6m700-afk/FLIXO_Hub
BRANCH: execution
CURRENT_SHA=REQUIRED
CURRENT_WORKFLOW_RUN=REQUIRED
CURRENT_EVIDENCE=REQUIRED
PRODUCTION_IDENTITY=REQUIRED
CERTIFIED_SHA=NOT_YET_CERTIFIED

This is a certificate template, not a certification. It becomes a certificate only after all required evidence is verified against one exact release SHA and one exact workflow lineage.

## Identity

- Release SHA: `REQUIRED`
- Release tag: `REQUIRED`
- Production deployment ID: `REQUIRED`
- Production immutable identity: `REQUIRED`
- Browser verification receipt: `REQUIRED`
- Certification timestamp: `REQUIRED`

## Gates

- [ ] Release candidate freeze
- [ ] Required CI PASS
- [ ] CodeQL PASS
- [ ] Secret scan PASS
- [ ] Security/dependency audit PASS
- [ ] Red Team PASS
- [ ] Browser E2E PASS
- [ ] Production identity PASS
- [ ] Core UX PASS
- [ ] Domain/canonical origin PASS
- [ ] Privacy/security/support surface PASS
- [ ] Analytics PASS
- [ ] SEO/indexing readiness PASS
- [ ] GitHub release readiness PASS
- [ ] Rollback drill PASS
- [ ] Distribution pack PASS

## Certification rule

Any missing, mixed-SHA, stale, skipped, cancelled, neutral, or unverifiable evidence means NOT CERTIFIED.

Only one exact SHA whose evidence is complete and internally consistent may be certified. Prior candidate evidence must remain quarantined as historical evidence.

## HISTORICAL / RETIRED REPOSITORY IDENTITY — NOT CURRENT CERTIFICATION

STATUS=HISTORICAL — NOT CURRENT CERTIFICATION

The former repository identity `m1m2m3m4m5m6m700-afk/FLIXO-AI-TOOLS` is retained only to explain historical records. It is never a current repository or release identity.

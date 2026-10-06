# FLIXO Public Launch Certificate

Status: NOT CERTIFIED

This document is a certificate template. It becomes a certificate only after every required identity and gate is verified against one exact release SHA.

## Identity

- Repository: `m1m2m3m4m5m6m700-afk/FLIXO_Hub`
- Release branch: `REQUIRED`
- Release SHA: `REQUIRED`
- Current workflow run: `REQUIRED`
- Current evidence record: `REQUIRED`
- Release tag: `REQUIRED`
- Production deployment ID: `REQUIRED`
- Production immutable identity: `REQUIRED`
- Browser verification receipt: `REQUIRED`
- Certification timestamp: `REQUIRED`

## Gates

- [ ] Release candidate freeze
- [ ] Required CI PASS on the exact release SHA
- [ ] CodeQL PASS on the exact release SHA
- [ ] Secret scan PASS on the exact release SHA
- [ ] Security/dependency audit PASS on the exact release SHA
- [ ] Red Team PASS on the exact release SHA
- [ ] Browser E2E PASS on the exact release SHA
- [ ] Production identity PASS on the exact release SHA
- [ ] Core UX PASS
- [ ] Domain/canonical origin PASS
- [ ] Privacy/security/support surface PASS
- [ ] Analytics PASS
- [ ] SEO/indexing readiness PASS
- [ ] GitHub release readiness PASS
- [ ] Rollback drill PASS
- [ ] Distribution pack PASS

## Certification rule

Any missing, mixed-SHA, stale, skipped, cancelled, neutral, expired, or unverifiable evidence means NOT CERTIFIED.

Only the exact SHA whose complete evidence lineage is verified may be certified.

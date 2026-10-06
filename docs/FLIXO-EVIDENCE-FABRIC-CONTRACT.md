# FLIXO Global Evidence Fabric

STATUS: CONTRACT / NON-DISPATCHABLE
AUTHORITY: المهام.md

The evidence fabric is a derived proof system. It never creates or owns tasks.

Chain of custody:

source SHA
→ build SHA
→ artifact digest
→ attestation
→ deployment ID
→ deployment SHA
→ environment verification

Provider adapters may later read GitHub, AWS, Azure, or other systems. Their output must normalize into this chain and remain evidence-only.

No provider compliance report, deployment record, or attestation is sufficient to certify FLIXO by itself.

External evidence generated after an immutable release candidate snapshot must live outside the frozen RC and reference its exact SHA.

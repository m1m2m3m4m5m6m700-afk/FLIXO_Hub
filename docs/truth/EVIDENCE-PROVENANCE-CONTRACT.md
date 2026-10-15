# FLIXO Truth — Evidence Provenance Contract

Active evidence binds tested SHA, base SHA, workflow run, toolchain, lockfile digest, configuration digest, generated artifact identity, policyVersion/hash, interfaceVersion/digest, and capability contract identity.

Different candidate SHA => HISTORICAL. Explicit invalidation => INVALIDATED. Neither is current evidence.

Evidence identity is SHA-256 hashed from the canonical record. Gate A requires two distinct candidate SHAs with distinct evidence digests under the same policy/interface/capability contract bindings.

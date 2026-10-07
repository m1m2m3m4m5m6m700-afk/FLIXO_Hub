import { z } from 'zod';

const SHA = z.string().regex(/^[a-f0-9]{40}$/u);

export const GlobalCapabilityManifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  family: z.enum(['image', 'video', 'audio', 'text', 'data', 'editor']),
  lifecycle: z.enum(['experimental', 'beta', 'ready', 'deprecated']),
  executionMode: z.enum(['browser-local', 'browser-worker', 'remote']),
  input: z.object({
    mediaTypes: z.array(z.string().min(1)).min(1),
    maxBytes: z.number().int().positive(),
  }),
  output: z.object({
    contractId: z.string().min(1),
    mediaTypes: z.array(z.string().min(1)).min(1),
  }),
  safety: z.object({
    classification: z.enum(['low', 'moderate', 'high', 'restricted']),
    maxDurationMs: z.number().int().positive(),
    sandboxRequired: z.boolean(),
  }),
  privacy: z.object({
    dataClass: z.enum(['public', 'internal', 'personal', 'sensitive']),
    fileBytesUploaded: z.boolean(),
    thirdPartyProcessing: z.boolean(),
  }),
  localization: z.object({
    titleKey: z.string().min(1),
    descriptionKey: z.string().min(1),
  }),
  regionalAvailability: z.object({
    mode: z.enum(['global', 'allowlist', 'denylist']),
    regions: z.array(z.string().min(2)).min(1),
  }),
  evidence: z.object({
    requiredChecks: z.array(z.string().min(1)).min(1),
    acceptanceCorpus: z.string().min(1),
    exactShaRequired: z.boolean().default(true),
  }),
  sourceSha: SHA.nullable(),
}).superRefine((manifest, ctx) => {
  if (manifest.executionMode === 'remote' && !manifest.privacy.thirdPartyProcessing) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['privacy', 'thirdPartyProcessing'],
      message: 'remote execution must explicitly declare third-party processing',
    });
  }
  if (manifest.privacy.fileBytesUploaded && manifest.privacy.dataClass === 'personal') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['privacy', 'fileBytesUploaded'],
      message: 'personal-data upload requires a separately approved privacy path',
    });
  }
});

export type GlobalCapabilityManifest = z.infer<typeof GlobalCapabilityManifestSchema>;

export function assertGlobalCapabilityManifest(value: unknown): GlobalCapabilityManifest {
  return GlobalCapabilityManifestSchema.parse(value);
}

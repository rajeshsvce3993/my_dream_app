import { z } from 'zod';

/** Shared KYC helpers for vendor shops + delivery partners. */

export const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]$/i;
export const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/i;
export const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i;
export const aadhaarRegex = /^[2-9][0-9]{11}$/;
export const indianPhoneRegex = /^[6-9]\d{9}$/;

export const vendorOnboardingDocumentsBaseSchema = z.object({
  ownerName: z.string().trim().min(2).max(100),
  ownerPhone: z.string().trim().regex(indianPhoneRegex, 'Enter a valid 10-digit mobile number'),
  ownerPan: z.string().trim().regex(panRegex, 'Enter a valid PAN (e.g. ABCDE1234F)'),
  gstin: z.string().trim().regex(gstinRegex, 'Enter a valid GSTIN').optional().or(z.literal('')),
  gstExempt: z.boolean().optional().default(false),
  fssaiLicense: z.string().trim().min(8).max(20),
  fssaiExpiry: z.string().trim().max(20).optional(),
  bankAccountName: z.string().trim().min(2).max(100),
  bankAccountNumber: z.string().trim().min(8).max(20),
  bankIfsc: z.string().trim().regex(ifscRegex, 'Enter a valid IFSC'),
  idProofType: z.enum(['AADHAAR', 'PASSPORT', 'VOTER', 'DL']),
  idProofNumber: z.string().trim().min(4).max(40),
  /** Optional scan / drive links until file storage is wired */
  fssaiDocUrl: z.string().url().optional().or(z.literal('')),
  gstDocUrl: z.string().url().optional().or(z.literal('')),
  panDocUrl: z.string().url().optional().or(z.literal('')),
  bankDocUrl: z.string().url().optional().or(z.literal('')),
  idProofDocUrl: z.string().url().optional().or(z.literal('')),
  shopPhotoUrl: z.string().url().optional().or(z.literal('')),
});

export const vendorOnboardingDocumentsSchema = vendorOnboardingDocumentsBaseSchema.superRefine((docs, ctx) => {
  if (!docs.gstExempt && !docs.gstin) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'GSTIN is required unless GST exempt is checked',
      path: ['gstin'],
    });
  }
  if (docs.idProofType === 'AADHAAR' && !aadhaarRegex.test(docs.idProofNumber.replace(/\s/g, ''))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Enter a valid 12-digit Aadhaar number',
      path: ['idProofNumber'],
    });
  }
});

export type VendorOnboardingDocuments = z.infer<typeof vendorOnboardingDocumentsSchema>;

export const deliveryOnboardingDocumentsSchema = z.object({
  aadhaarNumber: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s/g, ''))
    .pipe(z.string().regex(aadhaarRegex, 'Enter a valid 12-digit Aadhaar number')),
  drivingLicenseNumber: z.string().trim().min(8).max(20),
  vehicleRcNumber: z.string().trim().min(6).max(20),
  bankAccountName: z.string().trim().min(2).max(100),
  bankAccountNumber: z.string().trim().min(8).max(20),
  bankIfsc: z.string().trim().regex(ifscRegex, 'Enter a valid IFSC'),
  insuranceNumber: z.string().trim().max(40).optional().or(z.literal('')),
  aadhaarDocUrl: z.string().url().optional().or(z.literal('')),
  licenseDocUrl: z.string().url().optional().or(z.literal('')),
  rcDocUrl: z.string().url().optional().or(z.literal('')),
  photoUrl: z.string().url().optional().or(z.literal('')),
});

export type DeliveryOnboardingDocuments = z.infer<typeof deliveryOnboardingDocumentsSchema>;

export function normalizeEmptyUrls<T extends Record<string, unknown>>(docs: T): T {
  const out = { ...docs };
  for (const [k, v] of Object.entries(out)) {
    if (v === '') (out as Record<string, unknown>)[k] = undefined;
  }
  return out;
}

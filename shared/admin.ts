/** The review workflow used in the Sheet: New → In review → Follow-up / Approved / Declined. */
export const APPLICATION_STATUSES = ["New", "In review", "Follow-up", "Approved", "Declined"] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

/** CSS-friendly slug: "In review" -> "in-review". */
export function statusSlug(status: ApplicationStatus): string {
  return status.toLowerCase().replace(/\s+/g, "-")
}

/** One row of the Google Sheet, trimmed down for the list view. */
export interface ApplicationSummary {
  /** 1-based row number in the sheet (row 1 is the header). */
  row: number
  reference: string
  businessName: string
  kraPin: string
  phone: string
  email: string
  submittedAt: string
  status: ApplicationStatus
  reviewedBy: string
  reviewedAt: string
}

export interface ApplicationDetail extends ApplicationSummary {
  /** Every mapped form answer, keyed by the logical field name (businessName, dirEmail, ...). */
  fields: Record<string, string>
  notes: string
}

export interface FieldDef {
  key: string
  label: string
  /** Hidden entirely when empty, instead of showing a dash. */
  optional?: boolean
}

export interface FieldGroup {
  title?: string
  fields: FieldDef[]
}

export interface DetailSection {
  id: string
  title: string
  groups: FieldGroup[]
}

/**
 * Mirrors the sections of the public registration form so the admin screen and
 * the approval PDF read in the same order the customer filled things in.
 */
export const DETAIL_SECTIONS: DetailSection[] = [
  {
    id: "customer",
    title: "Customer details",
    groups: [
      {
        fields: [
          { key: "businessName", label: "Business name" },
          { key: "kraPin", label: "KRA PIN" },
          { key: "physicalAddress", label: "Physical address" },
          { key: "phone", label: "Phone / mobile" },
          { key: "email", label: "Email" },
          { key: "permitNo", label: "Business permit number" },
          { key: "bizType", label: "Business type" },
          { key: "bizTypeOther", label: "Business type (other)", optional: true },
        ],
      },
    ],
  },
  {
    id: "people",
    title: "People and contacts",
    groups: [
      {
        title: "Director / owner",
        fields: [
          { key: "dirName", label: "Full name" },
          { key: "dirId", label: "ID or passport" },
          { key: "dirEmail", label: "Email" },
          { key: "dirMobile", label: "Mobile" },
        ],
      },
      {
        title: "Primary contact",
        fields: [
          { key: "cpName", label: "Full name" },
          { key: "cpPosition", label: "Position" },
          { key: "cpEmail", label: "Email" },
          { key: "cpMobile", label: "Mobile" },
        ],
      },
      {
        title: "Accounts / finance contact",
        fields: [
          { key: "financeName", label: "Full name" },
          { key: "financePosition", label: "Position" },
          { key: "financeEmail", label: "Email" },
          { key: "financeMobile", label: "Mobile" },
        ],
      },
    ],
  },
  {
    id: "references",
    title: "Trade references",
    groups: [
      {
        title: "Reference 1",
        fields: [
          { key: "ref1Company", label: "Company" },
          { key: "ref1Contact", label: "Contact" },
          { key: "ref1Email", label: "Email" },
        ],
      },
      {
        title: "Reference 2",
        fields: [
          { key: "ref2Company", label: "Company" },
          { key: "ref2Contact", label: "Contact" },
          { key: "ref2Email", label: "Email" },
        ],
      },
    ],
  },
  {
    id: "banking",
    title: "Banking and terms",
    groups: [
      {
        fields: [
          { key: "bankName", label: "Bank" },
          { key: "bankBranch", label: "Branch" },
          { key: "acctName", label: "Account name" },
          { key: "acctNo", label: "Account number" },
          { key: "paymentTerms", label: "Requested payment terms" },
        ],
      },
    ],
  },
  {
    id: "documents",
    title: "Documents",
    groups: [{ fields: [{ key: "documents", label: "Documents listed" }] }],
  },
  {
    id: "agreement",
    title: "Agreement",
    groups: [
      {
        fields: [
          { key: "agreeCheck", label: "Declaration" },
          { key: "sigName", label: "Signatory" },
          { key: "sigDesignation", label: "Designation" },
          { key: "salesPersonId", label: "Salesperson in charge" },
        ],
      },
    ],
  },
]

/** Drop groups where nothing was filled in (e.g. no second trade reference). */
export function nonEmptyGroups(section: DetailSection, fields: Record<string, string>): FieldGroup[] {
  return section.groups.filter((group) => group.fields.some((f) => (fields[f.key] ?? "").trim() !== ""))
}

/** The fields of a group worth showing: everything except optional fields that are blank. */
export function visibleFields(group: FieldGroup, fields: Record<string, string>): FieldDef[] {
  return group.fields.filter((f) => !f.optional || (fields[f.key] ?? "").trim() !== "")
}

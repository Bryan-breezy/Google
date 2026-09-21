/**
 * Shared types and display helpers for the admin application review UI
 * and the approval PDF generator. Kept in `shared/` so both the client
 * and the server can import the same definitions.
 */

export const APPLICATION_STATUSES = ["Pending", "Approved", "Rejected"] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

export interface ApplicationSummary {
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
  notes: string
  /** Raw field values keyed by the logical Google Form field name. */
  fields: Record<string, string>
}

/* -------------------------------------------------------------------------- */
/*  Detail layout used by the admin drawer and the approval PDF               */
/* -------------------------------------------------------------------------- */

export interface DetailField {
  key: string
  label: string
}

export interface DetailGroup {
  title?: string
  fields: DetailField[]
}

export interface DetailSection {
  id: string
  title: string
  groups: DetailGroup[]
}

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
          { key: "permitNo", label: "Business permit no." },
          { key: "bizType", label: "Type of business" },
          { key: "bizTypeOther", label: "Business type (other)" },
        ],
      },
    ],
  },
  {
    id: "people",
    title: "People & contacts",
    groups: [
      {
        title: "Director / owner",
        fields: [
          { key: "dirName", label: "Name" },
          { key: "dirId", label: "ID / passport no." },
          { key: "dirEmail", label: "Email" },
          { key: "dirMobile", label: "Mobile" },
        ],
      },
      {
        title: "Primary contact",
        fields: [
          { key: "cpName", label: "Name" },
          { key: "cpPosition", label: "Position" },
          { key: "cpEmail", label: "Email" },
          { key: "cpMobile", label: "Mobile" },
        ],
      },
      {
        title: "Accounts / finance contact",
        fields: [
          { key: "financeName", label: "Name" },
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
          { key: "ref1Contact", label: "Contact & phone" },
          { key: "ref1Email", label: "Email" },
        ],
      },
      {
        title: "Reference 2",
        fields: [
          { key: "ref2Company", label: "Company" },
          { key: "ref2Contact", label: "Contact & phone" },
          { key: "ref2Email", label: "Email" },
        ],
      },
    ],
  },
  {
    id: "banking",
    title: "Banking & terms",
    groups: [
      {
        fields: [
          { key: "bankName", label: "Bank name" },
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
    groups: [
      {
        fields: [{ key: "documents", label: "Documents available" }],
      },
    ],
  },
  {
    id: "agreement",
    title: "Agreement & signatory",
    groups: [
      {
        fields: [
          { key: "agreeCheck", label: "Declaration" },
          { key: "sigName", label: "Authorised signatory" },
          { key: "sigDesignation", label: "Designation" },
          { key: "salesPersonId", label: "Salesperson-in-charge ID" },
          { key: "referenceNumber", label: "Application reference" },
        ],
      },
    ],
  },
]

/** Return only groups that have at least one non-empty field value. */
export function nonEmptyGroups(
  section: DetailSection,
  fields: Record<string, string>
): DetailGroup[] {
  return section.groups.filter((group) =>
    group.fields.some((field) => (fields[field.key] ?? "").trim() !== "")
  )
}

/** Return only fields that have a non-empty value. */
export function visibleFields(
  group: DetailGroup,
  fields: Record<string, string>
): DetailField[] {
  return group.fields.filter((field) => (fields[field.key] ?? "").trim() !== "")
}

import React, { FormEvent, useEffect, useState } from "react"
import { Check, ChevronDown, ChevronUp, CircleHelp, Loader2, Send } from "lucide-react"
import { toast } from "sonner"
import Header from "@/components/Header"
import Footer from "@/components/Footer"

const sections = ["Customer details", "People & contacts", "Trade references", "Banking & terms", "Documents", "Agreement"]
const businessTypes = ["Retail shop", "Wholesale distributor", "Beauty salon / spa", "Supermarket", "Other"]
const paymentTerms = ["COD", "7 days", "14 days", "30 days", "45 days", "60 days"]
const emailFieldNames = new Set(["email", "dirEmail", "cpEmail", "financeEmail", "ref1Email", "ref2Email"])

const DRAFT_STORAGE_KEY = "sassy-customer-registration-draft"
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const KRA_PIN_PATTERN = /^[A-Z]\d{9}[A-Z]$/i

const sectionByField: Record<string, string> = {
  businessName: "section-1", kraPin: "section-1", phone: "section-1", email: "section-1",
  dirName: "section-2", dirId: "section-2", dirEmail: "section-2", dirMobile: "section-2",
  cpName: "section-2", cpPosition: "section-2", cpEmail: "section-2", cpMobile: "section-2",
  financeName: "section-2", financePosition: "section-2", financeEmail: "section-2", financeMobile: "section-2",
  ref1Company: "section-3", ref1Contact: "section-3", ref1Email: "section-3",
  ref2Company: "section-3", ref2Contact: "section-3", ref2Email: "section-3",
  documents: "section-5", agreeCheck: "section-6", sigName: "section-6", salesPersonId: "section-6",
}
// This code answers the question: 
// "Which section does this form field belong to?" 
// — and if it doesn't know the answer, it just points you to Section 1 by default. eg
// email	"section-3"
// phone	"section-3"
// fullName	"section-1"
function sectionIdForField(fieldName: string) {
  return sectionByField[fieldName] ?? "section-1"
}

function Field(
  { label, name, required, type = "text", value, onChange, onBlur, error, placeholder }:
  { label: string; name: string; required?: boolean; type?: string; value: string; onChange: (value: string) => void; onBlur?: () => void; error?: string; placeholder?: string }
) {
  return (
      <label className={`field ${error ? "field-error" : ""}`} id={name}>
        <span className="field-label">{label}{required && <b aria-hidden="true">*</b>}</span>
        <input 
          name={name} 
          type={type} 
          value={value} 
          placeholder={placeholder} 
          onChange={(event) => onChange(event.target.value)} 
          onBlur={() => { onChange(value); onBlur?.() }} 
          aria-invalid={Boolean(error)} 
          aria-describedby={error ? `${name}-error` : undefined} 
        />
      {error && <span className="error-text" id={`${name}-error`} role="alert">{error}</span>}
    </label>
  )
}

function Section(
  { number, title, eyebrow, children, id, hasError }:
  { number: string; title: string; eyebrow?: string; children: React.ReactNode; id: string; hasError?: boolean }
) {
  return (
    <section className={`ledger-card ${hasError ? "section-error" : ""}`} id={id} tabIndex={-1}>
      <header className="card-head">
        <span className="section-number">{number}</span>
        <div>
          <span className="card-eyebrow">{eyebrow ?? "Registration ledger"}</span>
          <h2>{title}</h2>
        </div>
      </header>
      <div className="card-body">{children}</div>
    </section>
  )
}

function ChoiceGroup(
  { label, name, options, value, onChange }: 
  { label: string; name: string; options: string[]; value: string; onChange: (value: string) => void }
) {
  return (
    <fieldset className="choice-group">
      <legend className="field-label">{label}</legend>
      <div className="choices">
        {options.map((option) => (
          <label className={`choice ${value === option ? "chosen" : ""}`} key={option}>
            <input type="radio" name={name} checked={value === option} onChange={() => onChange(option)} />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export default function Home() {
  const [values, setValues] = useState<Record<string, string>>({})
  const [selectedDocs, setSelectedDocs] = useState<string[]>([])
  const [otherBusiness, setOtherBusiness] = useState(false)
  const [agreementOpen, setAgreementOpen] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [reference, setReference] = useState("")
  const [submissionError, setSubmissionError] = useState("")
  const [activeSection, setActiveSection] = useState(1)
  const [draftReady, setDraftReady] = useState(false)
  const [draftRestored, setDraftRestored] = useState(false)
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null)

  const [configured, setConfigured] = useState<boolean | null>(null)

  // Load draft from localStorage
  useEffect(() => {
    try {
      const savedDraft = window.localStorage.getItem(DRAFT_STORAGE_KEY)
      if (savedDraft) {
        const draft = JSON.parse(savedDraft) as { values?: Record<string, string>; selectedDocs?: string[]; otherBusiness?: boolean }

        setValues(draft.values ?? {})
        setSelectedDocs(draft.selectedDocs ?? [])
        setOtherBusiness(Boolean(draft.otherBusiness))
        setDraftRestored(true)
      }
    } catch {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY)
    } finally {
      setDraftReady(true)
    }
  }, [])

  // Save draft to localStorage whenever values or selectedDocs change
  useEffect(() => {
    if (!draftReady || submitted) return
    window.localStorage.setItem(
      DRAFT_STORAGE_KEY, 
      JSON.stringify({ values, selectedDocs, otherBusiness, savedAt: new Date().toISOString() })
    )
    setDraftSavedAt(new Date())
  }, [draftReady, submitted, values, selectedDocs, otherBusiness])

  // Check if Google Forms is configured
  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => setConfigured(Boolean(data.configured)))
      .catch(() => setConfigured(false))
  }, [])

  const validateField = (name: string, value: string) => {
    if (name === "businessName" && !value.trim()) return "Business name is required."
    if (name === "phone" && !value.trim()) return "Phone number is required."
    if (emailFieldNames.has(name) && value.trim() && !EMAIL_PATTERN.test(value.trim())) return "Enter a valid email address."
    if (name === "email" && !value.trim()) return "Email address is required."
    if (name === "kraPin" && value.trim() && !KRA_PIN_PATTERN.test(value.trim())) return "Enter a valid KRA PIN."
    if (name === "agreeCheck" && value !== "yes") return "Please confirm the agreement before submitting."
    if (name === "sigName" && !value.trim()) return "Authorized signatory name is required."
    if (name === "salesPersonId" && !value.trim()) return "Salesperson-in-charge ID is required for validation."
    return ""
  }

  const update = (name: string, value: string) => {
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: validateField(name, value) }))
  }

  const markFieldTouched = (name: string) => {
    setErrors((current) => ({ ...current, [name]: validateField(name, values[name] ?? "") }))
  }

  const toggleDoc = (doc: string) => {
    setSelectedDocs((current) => {
      const updated = current.includes(doc) ? current.filter((item) => item !== doc) : [...current, doc]
      // Clear document selection errors once changed
      setErrors((errs) => {
        const next = { ...errs }
        delete next.documents
        return next
      })
      return updated
    })
  }

  // Determine which sections have errors and how many sections are complete
  const visibleErrors = Object.entries(errors).filter(([, message]) => Boolean(message))
  const sectionHasErrors = (sectionId: string) => visibleErrors.some(([fieldName]) => sectionIdForField(fieldName) === sectionId)
  const sectionCompletion = [
    Boolean(values.businessName?.trim() && values.phone?.trim() && values.email?.trim() && !sectionHasErrors("section-1")),
    Boolean(Object.entries(values).some(([name, value]) => sectionIdForField(name) === "section-2" && value.trim()) && !sectionHasErrors("section-2")),
    Boolean(Object.entries(values).some(([name, value]) => sectionIdForField(name) === "section-3" && value.trim()) && !sectionHasErrors("section-3")),
    Boolean(values.bankName?.trim() || values.bankBranch?.trim() || values.acctName?.trim() || values.acctNo?.trim() || values.paymentTerms),
    selectedDocs.length > 0,
    Boolean(values.agreeCheck === "yes" && values.sigName?.trim() && values.salesPersonId?.trim() && !sectionHasErrors("section-6")),
  ]
  const completedSectionCount = sectionCompletion.filter(Boolean).length

  // Focus on the first field of a section when an error is detected
  const focusError = (fieldName: string) => {
    const sectionId = sectionIdForField(fieldName)
    setActiveSection(Number(sectionId.replace("section-", "")))
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "center" })
    window.setTimeout(() => {
      const input = document.getElementsByName(fieldName)[0] as HTMLElement | undefined
      ;(input ?? document.getElementById(sectionId))?.focus()
    }, 250)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()

    const nextErrors: Record<string, string> = {}
    if (!values.businessName?.trim()) nextErrors.businessName = "Business name is required."
    if (!values.phone?.trim()) nextErrors.phone = "Phone number is required."
    if (!values.email?.trim()) {
      nextErrors.email = "Email address is required."
    } 
    else if (!EMAIL_PATTERN.test(values.email.trim())) {
      nextErrors.email = "Enter a valid email address."
    }
    for (const emailFieldName of emailFieldNames) {
      const emailValue = values[emailFieldName]?.trim()
      if (emailValue && !EMAIL_PATTERN.test(emailValue)) {
        nextErrors[emailFieldName] = "Enter a valid email address."
      }
    }
    if (values.kraPin?.trim() && !KRA_PIN_PATTERN.test(values.kraPin.trim())) {
      nextErrors.kraPin = "Enter a valid KRA PIN."
    }
    
    // Document match validations
    if (values.kraPin?.trim() && !selectedDocs.includes("kra")) {
      nextErrors.documents = "Please check 'KRA PIN Certificate' to confirm you will email it."
    } else if (values.permitNo?.trim() && !selectedDocs.includes("permit")) {
      nextErrors.documents = "Please check 'Business Permit / Trade License' to confirm you will email it."
    } else if (values.dirId?.trim() && !selectedDocs.includes("id")) {
      nextErrors.documents = "Please check 'Copy of ID / Passport' to confirm you will email it."
    }

    if (!values.agreeCheck) nextErrors.agreeCheck = "Please confirm the agreement before submitting."
    if (!values.sigName?.trim()) nextErrors.sigName = "Authorized signatory name is required."
    if (!values.salesPersonId?.trim()) nextErrors.salesPersonId = "Salesperson-in-charge ID is required for validation."

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) {
      const firstErrorKey = Object.keys(nextErrors)[0]
      window.setTimeout(() => focusError(firstErrorKey), 0)
      return
    }
    setSubmissionError("")
    if (!configured) {
      toast.error("Google Forms is not connected yet.", { description: "Set GOOGLE_FORMS_URL in the project root .env file" })
      document.getElementById("google-setup")?.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch("/api/submit-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values, selectedDocs }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || "Submission failed.")
      }

      const { reference: ref } = await response.json()
      window.localStorage.removeItem(DRAFT_STORAGE_KEY)
      setDraftRestored(false)
      setDraftSavedAt(null)
      setReference(ref)
      setSubmitted(true)
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (error) {
      const message = error instanceof Error ? error.message : "The submission could not be sent."
      setSubmissionError(message)
      toast.error("The submission could not be sent.", { description: message })
      window.setTimeout(() => document.getElementById("form-error-summary")?.scrollIntoView({ behavior: "smooth", block: "center" }), 0)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="app-shell">
        <Header />
        <main className="success-wrap" aria-live="polite">
          <div className="success-seal">
            <Check size={26} />
          </div>
          <p className="kicker">Application received</p>
          <h1>Thank you for registering with Sassy Cosmetics and Beauty Products (K) Limited.</h1>
          <p className="success-copy">
            Your registration has been sent securely to the Sassy customer accounts team.
            We will review the details and confirm the next step for your wholesale account.
          </p>
          <div className="reference-card">
            <span>Application reference</span>
            <strong>{reference}</strong>
          </div>
          <div className="next-steps">
            <div className="next-steps-heading">
              <span className="section-number">NEXT</span>
              <h2>What happens now</h2>
            </div>
            <ol>
              <li>
                <span>01</span>
                <div>
                  <strong>Send your documents</strong>
                  <p>Email the supporting documents you selected to <a href="mailto:sassycosmetics17@gmail.com">sassycosmetics17@gmail.com</a>.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>Keep your reference</strong>
                  <p>Include <b>{reference}</b> in the email subject so our team can match your documents to this application.</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>Await confirmation</strong>
                  <p>Our accounts team will review your registration and confirm approved payment terms.</p>
                </div>
              </li>
            </ol>
          </div>
          <button className="button secondary" onClick={() => window.location.reload()}>Submit another application</button>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Header />
      <div className="title-band">
        <div className="title-band-inner">
          <div>
            <p className="kicker light">Wholesale account opening</p>
            <h1>Customer registration <em>&amp;</em> credit agreement</h1>
            <p>Tell us how your business trades, and we’ll take care of the next step.</p>
          </div>
        </div>
      </div>
      <main className="content-layout">
        <aside className="section-index" aria-label="Form sections">
          <div className="index-label">In this application</div>
          {sections.map((section, index) => 
            <a key={section} href={`#section-${index + 1}`}>
              <span>0{index + 1}</span>{section}
            </a>)
          }
        </aside>
        <div className="form-column">
              <div className="progress-panel" aria-label="Registration progress">
                <div className="progress-heading">
                  <div>
                    <span className="kicker">Application progress</span>
                    <strong>{completedSectionCount} of {sections.length} sections complete</strong>
                  </div>
                  <span className="progress-percent">
                    {Math.round((completedSectionCount / sections.length) * 100)}%
                  </span>
                </div>
                <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={sections.length} aria-valuenow={completedSectionCount}>
                  <span style={{ width: `${(completedSectionCount / sections.length) * 100}%` }} />
                </div>
                <div className="progress-steps">
                  {sections.map((section, index) => (
                    <button type="button" className={`progress-step ${sectionCompletion[index] ? "complete" : ""} ${activeSection === index + 1 ? "active" : ""}`} key={section} onClick={() => { setActiveSection(index + 1); document.getElementById(`section-${index + 1}`)?.scrollIntoView({ behavior: "smooth", block: "start" }) }}>
                      <span>{sectionCompletion[index] ? "✓" : index + 1}</span>{section}
                    </button>
                  ))}
                </div>
              </div>
              <div className="notice" id="google-setup">
            <CircleHelp size={18} />
            <p>
              <strong>{configured ? "Connected: " : "Before launch: "}</strong>
              {configured
                ? " Submissions are routed to Sassy Cosmetics and Beauty Products (K) Limited."
                : <>set <code>GOOGLE_FORMS_URL</code>.</>}
            </p>{!configured && <span className="status-pill">Connection pending</span>}
          </div>
          <p className="intro-copy">
            Fields marked <span className="required">*</span> are required. 
            Your information is used for account management, credit assessment, order processing, delivery, and debt recovery in accordance with the agreement below.
          </p>
          {(visibleErrors.length > 0 || submissionError) && (
            <div className="form-error-summary" id="form-error-summary" role="alert" aria-live="polite">
              {submissionError && <p>{submissionError}</p>}
              {visibleErrors.length > 0 && <>
              <strong>Please correct the following before submitting:</strong>
              <ul>
                {visibleErrors.map(([fieldName, message]) => (
                  <li key={fieldName}>
                    <a href={`#${sectionIdForField(fieldName)}`} onClick={(event) => { event.preventDefault(); focusError(fieldName) }}>
                      {message}
                    </a>
                  </li>
                ))}
              </ul>
              </>}
            </div>
          )}
          <form onSubmit={submit} noValidate>
            {/* Customer Details */}
            <Section id="section-1" number="01" title="Customer details" eyebrow="Your business" hasError={sectionHasErrors("section-1")}>
              <div className="field-grid">
                <Field label="Business name" name="businessName" required value={values.businessName ?? ""} onChange={(value) => update("businessName", value)} error={errors.businessName} />
                <Field label="KRA PIN" name="kraPin" value={values.kraPin ?? ""} onChange={(value) => update("kraPin", value.toUpperCase())} error={errors.kraPin} />
                <Field label="Physical address" name="physicalAddress" value={values.physicalAddress ?? ""} onChange={(value) => update("physicalAddress", value)} />
                <Field label="Phone / mobile" name="phone" required type="tel" value={values.phone ?? ""} onChange={(value) => update("phone", value)} error={errors.phone} />
                <Field label="Email" name="email" required type="email" value={values.email ?? ""} onChange={(value) => update("email", value)} error={errors.email} />
                <Field label="Business permit no." name="permitNo" value={values.permitNo ?? ""} onChange={(value) => update("permitNo", value)} />
              </div>
              <ChoiceGroup label="Type of business" name="bizType" options={businessTypes} value={values.bizType ?? ""} onChange={(value) => { update("bizType", value); setOtherBusiness(value === "Other") }} />
              {otherBusiness && <Field label="Please specify" name="bizTypeOther" value={values.bizTypeOther ?? ""} onChange={(value) => update("bizTypeOther", value)} />}
            </Section>

            {/* People and Contacts */}
            <Section id="section-2" number="02" title="People & contacts" eyebrow="Who we should speak with" hasError={sectionHasErrors("section-2")}>
              <div className="subsection-title">Director / partner</div>
              <div className="field-grid">
                <Field label="Name" name="dirName" value={values.dirName ?? ""} onChange={(value) => update("dirName", value)} />
                <Field label="ID / passport no." name="dirId" value={values.dirId ?? ""} onChange={(value) => update("dirId", value)} />
                <Field label="Email address" name="dirEmail" type="email" value={values.dirEmail ?? ""} onChange={(value) => update("dirEmail", value)} />
                <Field label="Mobile number" name="dirMobile" type="tel" value={values.dirMobile ?? ""} onChange={(value) => update("dirMobile", value)} />
              </div>
              <div className="subsection-title spaced">Contact person</div>
              <div className="field-grid">
                <Field label="Name" name="cpName" value={values.cpName ?? ""} onChange={(value) => update("cpName", value)} />
                <Field label="Position" name="cpPosition" value={values.cpPosition ?? ""} onChange={(value) => update("cpPosition", value)} />
                <Field label="Email address" name="cpEmail" type="email" value={values.cpEmail ?? ""} onChange={(value) => update("cpEmail", value)} />
                <Field label="Mobile number" name="cpMobile" type="tel" value={values.cpMobile ?? ""} onChange={(value) => update("cpMobile", value)} />
              </div>
              <div className="subsection-title spaced">Accounts / finance contact</div>
              <div className="field-grid">
                <Field label="Name" name="financeName" value={values.financeName ?? ""} onChange={(value) => update("financeName", value)} />
                <Field label="Position" name="financePosition" value={values.financePosition ?? ""} onChange={(value) => update("financePosition", value)} />
                <Field label="Email address" name="financeEmail" type="email" value={values.financeEmail ?? ""} onChange={(value) => update("financeEmail", value)} />
                <Field label="Mobile number" name="financeMobile" type="tel" value={values.financeMobile ?? ""} onChange={(value) => update("financeMobile", value)} />
              </div>
            </Section>

            {/* Trade references */}
            <Section id="section-3" number="03" title="Trade references" eyebrow="Two businesses who know your work" hasError={sectionHasErrors("section-3")}>
              <div className="reference-table">
                <div className="reference-head"><span>Referee</span><span>Company name</span><span>Contact person & phone</span><span>Email</span></div>
                {[1, 2].map((number) => (
                  <div className="reference-row" key={number}>
                    <strong>0{number}</strong>
                    <input aria-label={`Referee ${number} company`} value={values[`ref${number}Company`] ?? ""} onChange={(event) => update(`ref${number}Company`, event.target.value)} />
                    <input aria-label={`Referee ${number} contact`} value={values[`ref${number}Contact`] ?? ""} onChange={(event) => update(`ref${number}Contact`, event.target.value)} />
                    <div>
                      <input aria-label={`Referee ${number} email`} type="email" value={values[`ref${number}Email`] ?? ""} onChange={(event) => update(`ref${number}Email`, event.target.value)} aria-invalid={Boolean(errors[`ref${number}Email`])} />
                      {errors[`ref${number}Email`] && <span className="error-text">{errors[`ref${number}Email`]}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Banking and Terms */}
            <Section id="section-4" number="04" title="Banking & terms" eyebrow="Payment preferences" hasError={sectionHasErrors("section-4")}>
              <div className="field-grid">
                <Field label="Bank name" name="bankName" value={values.bankName ?? ""} onChange={(value) => update("bankName", value)} />
                <Field label="Branch" name="bankBranch" value={values.bankBranch ?? ""} onChange={(value) => update("bankBranch", value)} />
                <Field label="Account name" name="acctName" value={values.acctName ?? ""} onChange={(value) => update("acctName", value)} />
                <Field label="Account no." name="acctNo" value={values.acctNo ?? ""} onChange={(value) => update("acctNo", value)} />
              </div>
              <ChoiceGroup label="Terms of payment requested" name="paymentTerms" options={paymentTerms} value={values.paymentTerms ?? ""} onChange={(value) => update("paymentTerms", value)} />
              <p className="helper">Requested terms are subject to review and approval by Sassy Cosmetics and Beauty Products (K) Limited.</p>
            </Section>

            {/* Documents */}
            <Section id="section-5" number="05" title="Documents" eyebrow="What you’ll send next" hasError={sectionHasErrors("section-5")}>
              <p className="section-copy">Confirm which supporting documents you’ll email separately after submitting this application.</p>
              <div className="document-list">
                {[["id", "Copy of ID / Passport"], ["permit", "Business Permit / Trade License"], ["kra", "KRA PIN Certificate"], ["cert", "Certificate of Incorporation", "if applicable"]].map(([id, label, note]) => (
                  <label className={`document-item ${selectedDocs.includes(id) ? "selected" : ""}`} key={id}>
                    <input type="checkbox" checked={selectedDocs.includes(id)} onChange={() => toggleDoc(id)} />
                    <span>{label} {note && <small>({note})</small>}</span>
                    <Check size={16} />
                  </label>
                ))}
              </div>
              {errors.documents && <span className="error-text" style={{ display: "block", marginTop: "0.5rem" }}>{errors.documents}</span>}
              <div className="upload-note">Online submission does not accept file attachments. Your confirmation will include instructions for sending documents by email.</div>
            </Section>

            {/* Agreement */}
            <Section id="section-6" number="06" title="Agreement" eyebrow="Read, confirm, submit" hasError={sectionHasErrors("section-6")}>
              <p className="declaration">
                <ol>
                  I/We hereby declare that the information provided in this Form is true, complete and accurate to the best of my/our knowledge. 
                  I/We further acknowledge that any payment terms requested herein are subject to the approval of Sassy Cosmetics and Beauty Products 
                  (K) Ltd and agree to be bound by the Company's Customer Account, Supply and Credit Agreement and all applicable terms and 
                  conditions of trade.
                </ol>
                <ol>
                  By signing this Form, I/We consent to the collection, storage, processing and use of the information provided herein by Sassy 
                  Cosmetics and Beauty Products (K) Ltd for lawful business purposes, including account management, credit assessment, order 
                  processing, delivery, debt recovery and related business operations. 
                </ol>
              </p>
              <button type="button" className="agreement-toggle" onClick={() => setAgreementOpen((open) => !open)}>
                {agreementOpen ? "Hide full agreement" : "Read the full Customer Account, Supply and Credit Agreement"}
                {agreementOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
                {agreementOpen && (
                  <div className="agreement-box">
                    <h3>Customer Account, Supply and Credit Agreement</h3>
                    <p>
                      This Customer Account, Supply and Credit Agreement ("Agreement") is made and entered into between
                      Sassy Cosmetics and Beauty Products (K) Ltd, a company duly incorporated under the laws of the
                      Republic of Kenya (hereinafter referred to as "the Company"), and the Customer whose details appear
                      in the duly completed Customer Registration Form (hereinafter referred to as "the Customer"), whereby
                      the Company is engaged in the manufacture, distribution, marketing and sale of cosmetics, beauty
                      products, personal care products and related merchandise, and the Customer wishes to purchase such
                      products and, where applicable, obtain credit facilities from the Company, and accordingly the parties
                      agree to be bound by the terms and conditions set out in this Agreement.
                    </p>

                    <h4>Appointment and Scope of Agreement</h4>
                    <ol>
                      <li>Subject to the terms and conditions of this Agreement, the Company agrees to sell and supply to the Customer, and the Customer agrees to purchase from the Company, such cosmetics, beauty products, personal care products, accessories and related products as may be offered by the Company from time to time.</li>
                      <li>This Agreement shall govern all transactions, orders, deliveries, invoices, payments, credit facilities and all other commercial dealings between the parties unless otherwise agreed in writing.</li>
                      <li>The Company reserves the right to introduce, modify, discontinue, substitute or withdraw any product, product range, packaging specification or promotional programme at any time without incurring any liability to the Customer.</li>
                      <li>Nothing in this Agreement shall be construed as creating an exclusive purchasing or supply arrangement between the parties unless expressly agreed in writing.</li>
                    </ol>

                    <h4>Customer Account</h4>
                    <ol>
                      <li>The Customer shall maintain accurate, complete and up-to-date business information at all times and shall promptly notify the Company in writing of any change in its ownership, management, business name, physical address, postal address, telephone contacts, email addresses, banking details or any other material information relevant to this Agreement.</li>
                      <li>The Company reserves the right to verify any information provided by the Customer and may suspend, delay or decline any transaction where such information is found to be inaccurate, incomplete or misleading.</li>
                      <li>The Customer acknowledges and agrees that the Customer Registration Form and all information contained therein form an integral part of this Agreement.</li>
                    </ol>

                    <h4>Orders</h4>
                    <ol>
                      <li>Orders may be placed through authorized sales representatives, approved electronic channels, official Company email addresses, telephone communication, written purchase orders or any other method approved by the Company.</li>
                      <li>All orders shall be subject to acceptance by the Company and availability of stock.</li>
                      <li>The Company reserves the right, at its sole discretion, to reject, amend, defer, split, suspend or cancel any order where circumstances so require, including but not limited to stock shortages, overdue accounts, exceeded credit limits or operational constraints.</li>
                      <li>No order shall be deemed accepted until the Company issues an invoice, delivery note, order confirmation or proceeds with delivery.</li>
                    </ol>

                    <h4>Pricing</h4>
                    <ol>
                      <li>All products shall be supplied at the Company's prevailing prices at the date of invoicing.</li>
                      <li>The Company reserves the right to revise prices at any time due to changes in manufacturing costs, taxation, exchange rates, transportation costs, regulatory requirements or prevailing market conditions.</li>
                      <li>All promotional prices, discounts, rebates and incentives shall be governed by separate terms communicated by the Company and may be amended or withdrawn without prior notice.</li>
                      <li>No verbal commitment relating to pricing, discounts or incentives shall be binding unless confirmed in writing by an authorized officer of the Company.</li>
                    </ol>

                    <h4>Credit Facilities</h4>
                    <ol>
                      <li>The granting of credit facilities shall be entirely at the discretion of the Company, and the Company may, at its sole discretion, approve, reject, review, reduce, suspend or withdraw any credit facility at any time without prior notice.</li>
                      <li>The Customer shall strictly adhere to the approved credit limit and credit period communicated by the Company.</li>
                      <li>The Company may, as a condition for granting or maintaining any credit facility, require guarantees, security, post-dated cheques or any other form of credit support as it may deem appropriate.</li>
                      <li>Any payment terms, credit period or credit limit requested by the Customer in the Customer Registration Form shall be subject to the Company's review and approval and shall not be binding upon the Company unless expressly approved in writing.</li>
                    </ol>

                    <h4>Payment Terms</h4>
                    <ol>
                      <li>The Customer shall make payment in accordance with the payment terms approved by the Company and specified in the Customer Registration Form, provided that customers operating on cash terms shall make full payment before delivery unless otherwise approved in writing by the Company.</li>
                      <li>All payments shall be made strictly to the Company's official bank account, M-Pesa Paybill or M-Pesa till Number as designated by the Company, and no payments shall be made to any sales representative, employee or any other third party under any circumstances.</li>
                      <li>Payment shall only be deemed received upon clearance and confirmation by the Company's Finance Department.</li>
                      <li>The Customer shall not withhold payment on account of any dispute, counterclaim or set-off unless expressly agreed in writing by the Company.</li>
                      <li>Any cheque returned unpaid shall attract all associated bank charges and administrative costs, which shall be borne by the Customer.</li>
                    </ol>

                    <h4>Overdue Accounts and Debt Recovery</h4>
                    <ol>
                      <li>Any amount remaining unpaid after the approved payment period shall be deemed overdue.</li>
                      <li>The Company reserves the right to charge interest on overdue amounts at the prevailing commercial rate determined by the Company from time to time.</li>
                      <li>The Company may suspend deliveries, withdraw credit facilities, place the Customer's account on hold or terminate the business relationship in respect of overdue accounts.</li>
                      <li>The Customer shall be liable for all costs incurred by the Company in recovering outstanding amounts, including legal fees, court costs, debt collection charges, auctioneer fees and related administrative expenses.</li>
                    </ol>

                    <h4>Delivery and Acceptance</h4>
                    <ol>
                      <li>Delivery dates provided by the Company are estimates only and shall not constitute a guarantee.</li>
                      <li>Delivery shall be deemed complete upon receipt and acknowledgment by the Customer or the Customer's authorized representative, 
                        and a signed delivery note shall constitute conclusive evidence of delivery of the products in the quantities and condition stated therein.</li>
                      <li>The Customer shall inspect the products immediately upon delivery and notify the Company in writing of any shortages, damages or discrepancies within twenty-four (24) hours.</li>
                      <li>Failure to provide written notification within the prescribed period shall constitute acceptance of the products in good order and condition.</li>
                    </ol>

                    <h4>Transfer of Risk and Retention of Title</h4>
                    <ol>
                      <li>
                        Risk in the products shall pass to the Customer upon delivery; however, ownership of the products
                        shall remain vested in the Company until full payment has been received, and where any payment
                        remains outstanding, the Company shall be entitled to repossess the products without prejudice to any
                        other rights or remedies available under this Agreement or applicable law.
                      </li>
                    </ol>

                    <h4>Storage, Handling and Stock Management</h4>
                    <ol>
                      <li>The Customer shall store products in appropriate conditions, protect them from damage, contamination,
                      excessive heat and moisture, maintain proper stock records, implement First-In-First-Out (FIFO) stock
                      rotation practices and monitor expiry dates regularly. 
                      </li>
                      <li>The Company shall not be liable for losses arising from improper storage, handling or stock management after delivery.</li>
                    </ol>

                    <h4>Returns and Claims</h4>
                    <ol>
                      <li>Returns shall only be accepted with the Company's prior written approval and where products were
                      supplied in error, delivered damaged or proven to contain manufacturing defects.</li> 
                      <li>The Company shall not accept returns of expired products, opened products, used products, slow-moving stock or products
                      damaged after delivery.</li>
                    </ol>

                    <h4>Product Recalls</h4>
                    <ol>
                      <li>The Customer shall cooperate fully with any product recall initiated by the Company or a regulatory
                      authority and shall immediately cease sale of affected products, isolate stock and provide relevant
                      records when requested.</li>
                    </ol>

                    <h4>Intellectual Property and Brand Protection</h4>
                    <ol>
                      <li>All trademarks, trade names, logos, packaging designs, artwork, labels, promotional materials and
                      intellectual property rights relating to the Company's products shall remain the exclusive property of
                      the Company.</li> 
                      <li>The Customer shall not copy, alter, misuse or reproduce any such intellectual property
                      without prior written authorization.</li>
                    </ol>

                    <h4>Confidentiality</h4>
                    <ol>
                      <li>The Customer shall keep confidential all information relating to pricing structures, discounts,
                      promotional programmes, customer information, trade terms, business operations and commercial
                      arrangements obtained during the course of the business relationship.</li>
                    </ol>

                    <h4>Compliance With Laws</h4>
                    <ol>
                      <li>The Customer shall comply with all applicable laws, regulations and industry standards relating to the
                      storage, marketing, sale and distribution of products supplied by the Company.</li>
                    </ol>

                    <h4>Limitation of Liability</h4>
                    <ol>
                      <li>The Company's liability shall be limited to replacement of defective products or refund of the
                      purchase price at the Company's discretion.</li>
                      <li>Under no circumstances shall the Company be liable for indirect, consequential or special losses, including loss of profits, business opportunities or goodwill.</li>
                    </ol>

                    <h4>Force Majeure</h4>
                    <ol>
                      <li>The Company shall not be liable for any failure or delay in performance arising from acts of God or
                      other events beyond its reasonable control, and may suspend, reduce or cancel any affected orders
                      without liability; however, any goods delivered or invoiced to the Customer prior to such event shall
                      remain payable in full.</li>
                    </ol>

                    <h4>Termination</h4>
                    <ol>
                      <li>The Company may suspend or terminate this Agreement immediately where the Customer breaches this
                      Agreement, fails to meet payment obligations, provides false information, becomes insolvent or engages
                      in conduct that may expose the Company to legal, financial or reputational risk.</li>
                    </ol>

                    <h4>Dispute Resolution</h4>
                    <ol>
                      <li>This Agreement shall be governed by the laws of the Republic of Kenya.</li>
                      <li>The parties shall endeavor to resolve disputes amicably through good faith negotiations.</li>
                      <li>Where a dispute cannot be resolved amicably, it shall be referred to the courts of competent jurisdiction in Kenya.</li>
                    </ol>

                    <h4>Entire Agreement</h4>
                    <ol>
                      <li>This Agreement, together with the Customer Registration Form, approved credit facility documents,
                      invoices, delivery notes and any written amendments issued by the Company, constitutes the entire
                      agreement between the parties and supersedes all prior discussions, understandings or representations.
                      </li>
                    </ol>

                    <p>
                      This Agreement is executed in duplicate, with each party retaining one original copy. By signing this
                      Agreement, the parties acknowledge that they have read, understood and agreed to be bound by its terms
                      and conditions.
                    </p>
                  </div>
                )}
              <label className={`agree-row ${errors.agreeCheck ? "field-error" : ""}`} id="agreeCheck">
                <input type="checkbox" checked={values.agreeCheck === "yes"} onChange={(event) => update("agreeCheck", event.target.checked ? "yes" : "")} />
                <span>I have read and agree to be bound by the Customer Account, Supply and Credit Agreement, and confirm the information provided is true and complete.<b>*</b>{errors.agreeCheck && <small className="error-text">{errors.agreeCheck}</small>}</span>
              </label>
              <div className="field-grid signature-grid">
                <Field label="Authorized signatory name" name="sigName" required placeholder="Type full name as signature" value={values.sigName ?? ""} onChange={(value) => update("sigName", value)} error={errors.sigName} />
                <Field label="Designation" name="sigDesignation" value={values.sigDesignation ?? ""} onChange={(value) => update("sigDesignation", value)} />
                <Field label="Salesperson-in-charge ID" name="salesPersonId" required placeholder="Enter the salesperson ID" value={values.salesPersonId ?? ""} onChange={(value) => update("salesPersonId", value)} error={errors.salesPersonId} />
              </div>
            </Section>
            <div className="submit-panel">
              <div>
                <p className="kicker">Ready when you are</p>
                <h2>Send your application to Sassy Cosmetic & Beauty Products (K) Limited.</h2>
                <p>Submitting this form acts as your electronic signature on the registration and credit agreement.</p>
              </div>
              <button className="button primary" type="submit" disabled={submitting} aria-busy={submitting}>
                {submitting ? <><Loader2 className="spin" size={17} aria-hidden="true" /> Sending securely…</> : <><Send size={17} /> Submit registration</>}
              </button>
            </div>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  )
}

import React, { FormEvent, useEffect, useState } from "react"
import { Check, ChevronDown, ChevronUp, CircleHelp, Leaf, Loader2, Send } from "lucide-react"
import { toast } from "sonner"
import Header from "@/components/Header"
import Footer from "@/components/Footer"

const sections = ["Customer details", "People & contacts", "Trade references", "Banking & terms", "Documents", "Agreement"]
const businessTypes = ["Retail shop", "Wholesale distributor", "Beauty salon / spa", "Supermarket", "Other"]
const paymentTerms = ["COD", "7 days", "14 days", "30 days", "45 days", "60 days"]
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const KRA_PIN_PATTERN = /^[A-Z]\d{9}[A-Z]$/i
const emailFieldNames = new Set(["email", "dirEmail", "cpEmail", "financeEmail", "ref1Email", "ref2Email"])
const sectionByField: Record<string, string> = {
  businessName: "section-1", kraPin: "section-1", phone: "section-1", email: "section-1",
  dirName: "section-2", dirId: "section-2", dirEmail: "section-2", dirMobile: "section-2",
  cpName: "section-2", cpPosition: "section-2", cpEmail: "section-2", cpMobile: "section-2",
  financeName: "section-2", financePosition: "section-2", financeEmail: "section-2", financeMobile: "section-2",
  ref1Company: "section-3", ref1Contact: "section-3", ref1Email: "section-3",
  ref2Company: "section-3", ref2Contact: "section-3", ref2Email: "section-3",
  documents: "section-5", agreeCheck: "section-6", sigName: "section-6", salesPersonId: "section-6",
}

function sectionIdForField(fieldName: string) {
  return sectionByField[fieldName] ?? "section-1"
}

function Field(
  { label, name, required, type = "text", value, onChange, error, placeholder }:
  { label: string; name: string; required?: boolean; type?: string; value: string; onChange: (value: string) => void; error?: string; placeholder?: string }
) {
  return (
      <label className={`field ${error ? "field-error" : ""}`} id={name}>
        <span className="field-label">{label}{required && <b aria-hidden="true">*</b>}</span>
        <input name={name} type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? `${name}-error` : undefined} />
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
        <Leaf className="section-leaf" size={15} aria-hidden="true" />
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

  const [configured, setConfigured] = useState<boolean | null>(null)

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
    if (name === "kraPin" && value.trim() && !KRA_PIN_PATTERN.test(value.trim())) return "Enter a valid KRA PIN format"
    if (name === "agreeCheck" && value !== "yes") return "Please confirm the agreement before submitting."
    if (name === "sigName" && !value.trim()) return "Authorized signatory name is required."
    if (name === "salesPersonId" && !value.trim()) return "Salesperson-in-charge ID is required for validation."
    return ""
  }

  const update = (name: string, value: string) => {
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: validateField(name, value) }))
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

  const visibleErrors = Object.entries(errors).filter(([, message]) => Boolean(message))
  const sectionHasErrors = (sectionId: string) => visibleErrors.some(([fieldName]) => sectionIdForField(fieldName) === sectionId)

  const focusError = (fieldName: string) => {
    const sectionId = sectionIdForField(fieldName)
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
    } else if (!EMAIL_PATTERN.test(values.email.trim())) {
      nextErrors.email = "Enter a valid email address."
    }
    for (const emailFieldName of emailFieldNames) {
      const emailValue = values[emailFieldName]?.trim()
      if (emailValue && !EMAIL_PATTERN.test(emailValue)) {
        nextErrors[emailFieldName] = "Enter a valid email address."
      }
    }
    if (values.kraPin?.trim() && !KRA_PIN_PATTERN.test(values.kraPin.trim())) {
      nextErrors.kraPin = "Enter a valid KRA PIN format (e.g., A123456789B)."
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
        <h1>Thank you for registering with Sassy Cosmetics and Beauty Products Kenya Limited.</h1>
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
                <p>Email the supporting documents you selected to <a href="mailto:accounts@sassycosmetics.co.ke">accounts@sassycosmetics.co.ke</a>.</p>
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
          {sections.map((section, index) => <a key={section} href={`#section-${index + 1}`}><span>0{index + 1}</span>{section}</a>)}
        </aside>
        <div className="form-column">
          <div className="notice" id="google-setup">
            <CircleHelp size={18} />
            <p>
              <strong>{configured ? "Connected:" : "Before launch:"}</strong>
              {configured
                ? "submissions are routed to the Sassy Customer Registration Google Form and its linked review workbook."
                : <>set <code>GOOGLE_FORMS_URL</code> in the project root <code>.env</code> file. Entry IDs are detected automatically from the form.</>}
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
            <Section id="section-1" number="01" title="Customer details" eyebrow="Your business" hasError={sectionHasErrors("section-1")}>
              <div className="field-grid">
                <Field label="Business name" name="businessName" required value={values.businessName ?? ""} onChange={(value) => update("businessName", value)} error={errors.businessName} />
                <Field label="KRA PIN" name="kraPin" placeholder="e.g., A123456789B" value={values.kraPin ?? ""} onChange={(value) => update("kraPin", value.toUpperCase())} error={errors.kraPin} />
                <Field label="Physical address" name="physicalAddress" value={values.physicalAddress ?? ""} onChange={(value) => update("physicalAddress", value)} />
                <Field label="Phone / mobile" name="phone" required type="tel" value={values.phone ?? ""} onChange={(value) => update("phone", value)} error={errors.phone} />
                <Field label="Email" name="email" required type="email" value={values.email ?? ""} onChange={(value) => update("email", value)} error={errors.email} />
                <Field label="Business permit no." name="permitNo" value={values.permitNo ?? ""} onChange={(value) => update("permitNo", value)} />
              </div>
              <ChoiceGroup label="Type of business" name="bizType" options={businessTypes} value={values.bizType ?? ""} onChange={(value) => { update("bizType", value); setOtherBusiness(value === "Other") }} />
              {otherBusiness && <Field label="Please specify" name="bizTypeOther" value={values.bizTypeOther ?? ""} onChange={(value) => update("bizTypeOther", value)} />}
            </Section>
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
            <Section id="section-4" number="04" title="Banking & terms" eyebrow="Payment preferences" hasError={sectionHasErrors("section-4")}>
              <div className="field-grid">
                <Field label="Bank name" name="bankName" value={values.bankName ?? ""} onChange={(value) => update("bankName", value)} />
                <Field label="Branch" name="bankBranch" value={values.bankBranch ?? ""} onChange={(value) => update("bankBranch", value)} />
                <Field label="Account name" name="acctName" value={values.acctName ?? ""} onChange={(value) => update("acctName", value)} />
                <Field label="Account no." name="acctNo" value={values.acctNo ?? ""} onChange={(value) => update("acctNo", value)} />
              </div>
              <ChoiceGroup label="Terms of payment requested" name="paymentTerms" options={paymentTerms} value={values.paymentTerms ?? ""} onChange={(value) => update("paymentTerms", value)} />
              <p className="helper">Requested terms are subject to review and approval by Sassy Cosmetics and Beauty Products Kenya Limited.</p>
            </Section>
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
            <Section id="section-6" number="06" title="Agreement" eyebrow="Read, confirm, submit" hasError={sectionHasErrors("section-6")}>
              <p className="declaration">I/We declare that the information provided is true, complete and accurate to the best of my/our knowledge. I/We acknowledge that requested payment terms are subject to approval by Sassy Cosmetics and Beauty Products Kenya Limited and agree to be bound by the Customer Account, Supply and Credit Agreement.</p>
              <button type="button" className="agreement-toggle" onClick={() => setAgreementOpen((open) => !open)}>
                {agreementOpen ? "Hide full agreement" : "Read the full Customer Account, Supply and Credit Agreement"}
                {agreementOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {agreementOpen && (
                <div className="agreement-box">
                  <h3>Customer Account, Supply and Credit Agreement</h3>
                  <ol>
                    <li>The Company may sell and supply cosmetics, beauty products, personal care products, accessories, and related products offered from time to time.</li>
                    <li>The Customer shall keep business information accurate and promptly report changes to ownership, management, address, contacts, or banking details.</li>
                    <li>All orders are subject to acceptance by the Company and stock availability.</li>
                    <li>Prices are the Company’s prevailing prices at the date of invoicing and may change due to costs, taxation, exchange rates, transport, or market conditions.</li>
                    <li>Credit facilities are at the Company’s discretion and may be approved, reviewed, reduced, suspended, or withdrawn.</li>
                    <li>The Customer shall pay according to the terms approved by the Company. Overdue accounts may result in suspended deliveries, withdrawn credit, and recovery costs.</li>
                    <li>Risk passes to the Customer on delivery; ownership remains with the Company until full payment is received.</li>
                    <li>The Customer must inspect deliveries and report shortages, damage, or discrepancies in writing within 24 hours.</li>
                    <li>This Agreement is governed by the laws of Kenya. Disputes are first addressed through good-faith negotiation and then by courts of competent jurisdiction in Kenya.</li>
                  </ol>
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
                <h2>Send your application to Sassy.</h2>
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

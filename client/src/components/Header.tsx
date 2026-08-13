export default function Header() {
  return (
    <header
      className="site-header"
      style={{ position: "sticky", top: 0, zIndex: 50 }}
    >
      <div className="brand-lockup">
        <img src="/manus-storage/sassy-botanical-mark_cbd5ddb6.png" alt="" />
        <div>
          <div className="brand-name">Sassy</div>
          <div className="brand-tag">For a sassy look</div>
        </div>
      </div>
      <div className="company-meta">
        <strong>Sassy Cosmetic & Beauty Products (K) Limited</strong>
        <span>P.O. Box 12404–00100 Nairobi, Kenya</span>
        <span>+254 706 238 579 &nbsp;·&nbsp; +254 721 239 867</span>
      </div>
    </header>
  )
}
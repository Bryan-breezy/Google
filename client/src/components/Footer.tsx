import { ExternalLink } from "lucide-react"

export default function Footer() {
  return (
    <footer className="site-footer">
      <span>Sassy Cosmetic & Beauty Products (K) Limited</span>
      <span>Customer registration desk &nbsp;·&nbsp; Nairobi, Kenya</span>
      <a href="mailto:sassycosmetics17@gmail.com">
        Contact accounts <ExternalLink size={13} />
      </a>
    </footer>
  )
}

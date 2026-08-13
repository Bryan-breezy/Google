# Sassy Customer Registration — Design Direction

## Three stylistic approaches

### Theme Name: Botanical Ledger
Very warm, editorial, and trustworthy: a modern business form with natural green, paper, and brass accents. It makes a formal credit application feel calm, clear, and human.
**Probability:** 0.07

### Theme Name: Quiet Commerce
A restrained, highly functional form system built around generous whitespace, charcoal type, and precise data-entry affordances. It prioritizes speed and confidence over decoration.
**Probability:** 0.03

### Theme Name: Sassy Counterpoint
A bolder brand expression using deep green fields, oversized serif typography, and bright coral accents to make the registration experience feel more distinctive and memorable.
**Probability:** 0.08

## Selected approach: Botanical Ledger

### Design Movement
Contemporary editorial design informed by botanical packaging, independent apothecary labels, and Swiss information design.

### Core Principles
1. Formal information should feel approachable, not bureaucratic.
2. Every section should have a clear visual hierarchy and a calm reading rhythm.
3. Natural color and paper-like surfaces should communicate trust without looking corporate.
4. Interaction feedback should be visible, brief, and reassuring.

### Color Philosophy
Deep leaf green anchors the brand and signals care, stability, and natural products. Warm paper tones prevent the page from feeling clinical. A muted brass accent marks important actions and required information without competing with the content.

### Layout Paradigm
A narrow editorial reading column is paired with a slim, sticky section index on larger screens. The form remains sequential, but the index gives users orientation without forcing a dashboard-like grid.

### Signature Elements
- A circular botanical line mark beside the Sassy wordmark.
- Section headers styled like numbered ledger entries.
- Soft paper grain, thin rule lines, and brass micro-accents.

### Interaction Philosophy
Inputs should feel like guided completion rather than a data dump. Focus states use a green rule and subtle lift; selected choices become lightly tinted ledger chips. Validation is local and plain-spoken. Submission feedback confirms the handoff to Google Forms without pretending the form has performed any private storage.

### Animation
Use short 160–220ms ease-out transitions for focus, chip selection, section reveal, and submit feedback. On initial load, stagger the header, intro, and first sections by 40ms. Respect reduced motion preferences and never animate layout-heavy properties.

### Typography System
Use Fraunces for brand display and section titles, IBM Plex Sans for body copy and controls, and IBM Plex Mono for labels, metadata, and section numbers. Headlines are sentence case, compact, and editorial; labels are uppercase with generous tracking.

### Brand Essence
A clear, trustworthy registration desk for Kenyan beauty retailers who want to trade with Sassy Cosmetics without paperwork friction. Personality: grounded, precise, welcoming.

### Brand Voice
Headlines are calm and specific. CTAs are direct and reassuring. Microcopy explains what happens next and never overpromises.

Example lines:
- “Tell us how your business trades.”
- “Your application will open in our secure Google Form response sheet.”

### Wordmark & Logo
Use the existing circular line mark: a simple botanical curve inside a thin ring, paired with a custom-feeling Fraunces wordmark. The mark should be recognizable without text and visible in the header and favicon.

### Signature Brand Color
Leaf green `#2F5A1A`.

## Implementation notes

The form will submit to Google Forms using the form’s `formResponse` endpoint and the Google Forms `entry.<field-id>` names. Because the current Google Form URL and entry IDs were not included, the implementation will expose a single `GOOGLE_FORM_CONFIG` mapping block with placeholders and a setup note. Once the user supplies the Google Form edit or public URL, the mapping can be completed precisely. The browser will use a hidden POST/iframe-compatible submission pattern; file uploads are not sent to Google Forms and remain an email follow-up step.

## Style Decisions

- Keep deep leaf green fields paired with warm paper surfaces and brass-only action accents.
- Keep section identity consistent through numbered ledger headers, Fraunces titles, IBM Plex Mono metadata, thin rules, and generous editorial whitespace.
- Keep the botanical line mark visible in the primary brand lockup as the signature motif.

- Treat inputs as ledger entries on paper: thin rules, calm spacing, and restrained surfaces replace heavy generic boxes.
- Repeat the botanical line mark as a subtle leaf flourish in section headers and transition rules, never as decorative wallpaper.
- Use precise, reassuring state language: errors are specific, the submit button says “Sending securely…”, and the success page gives concrete next steps.
- Keep the success experience within the deep leaf green, warm paper, brass, Fraunces, and IBM Plex Mono system.

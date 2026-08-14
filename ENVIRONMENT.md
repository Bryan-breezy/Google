# Environment setup

The server reads environment variables from a `.env` file in the project root through `dotenv`. The repository ignores `.env` files, so secrets and deployment-specific values are not committed.

## Local setup

Copy the template and start the application:

```bash
cp .env.example .env
pnpm install
pnpm dev
```

The required Google Forms setting is:

```dotenv
GOOGLE_FORMS_URL=https://docs.google.com/forms/d/1gZUM_6EIc0uApuW4PPXL6vWt3-WiwpzlF3HdFE32pnc/viewform
```

Use the public `/viewform` URL, not the Google Forms `/edit` URL. The server automatically reads the live question metadata and detects the `entry.<number>` IDs; no manual entry-ID configuration is required.

The optional server port is:

```dotenv
PORT=8787
```

For production, define the same variables in the hosting provider’s server environment rather than committing a `.env` file. After changing `GOOGLE_FORMS_URL`, restart the server so the configuration cache is recreated.

## Verification

Run the following commands from the project root:

```bash
pnpm check
pnpm build
```

When the server is running, check the configuration endpoint:

```bash
curl http://127.0.0.1:8787/api/config
```

A correctly configured server returns:

```json
{"configured":true}
```

# ItsBloxx

Bloxx Component Library Builder - generates production-ready UI components using AI.

## Features

- Generates semantic HTML with ARIA attributes
- Creates responsive CSS with media queries
- Adds Schema.org markup for SEO
- Processes multiple component types in parallel
- Validates output quality (100% score target)

## Usage

```bash
# Install dependencies
npm install

# Dry run (preview without creating)
DRY_RUN=true npm start

# Live run (creates components in Xano)
DRY_RUN=false npm start
```

## Environment Variables

```
GEMINI_API_KEY=your-gemini-api-key
XANO_API_BASE=https://your-xano-instance/api:endpoint
DRY_RUN=true
```

## GitHub Actions

This repo includes a workflow to run the component builder in the cloud.
Trigger it manually from the Actions tab.

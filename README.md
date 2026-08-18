# PhySoc Studio

PhySoc Studio is the committee editor for PhySoc social and academic graphics.

It provides 15 templates for announcements, events, academic content, campaigns, and recurring committee communications. The published Studio is password protected for committee use.

## Use the Studio

Open the live Studio at [physocstudio.pages.dev](https://physocstudio.pages.dev). Choose a template, add the approved copy and images, then export the required social format.

The committee handover and the Google Drive release explain the brand rules, asset requirements, and recommended workflow.

## Maintainer workflow

The source of truth is the `studio/` directory. Build and check it before committing:

```sh
cd studio
npm ci
npm run smoke
```

`npm run build` creates the deployable runtime in `studio/dist/`. The generated runtime, local Wrangler state, exported graphics, and poster drafts are intentionally untracked.

## Deployment

Pushing a verified change to `main` runs the Studio smoke check and deploys the result to the existing Cloudflare Pages project, `physocstudio`.

The GitHub repository is public. Do not commit passwords, API tokens, committee-only source photos, personal data, or unpublished event material. Runtime access control and export support depend on the Cloudflare environment variables and secrets described in the maintainer handover.

# PhySoc Studio

PhySoc Studio is the committee editor for PhySoc social and academic graphics.

It provides 23 templates for announcements, events, academic content, campaigns, and recurring committee communications. The published Studio is password protected for committee use.

## Use the Studio

Open the live Studio at [physocstudio.pages.dev](https://physocstudio.pages.dev). Choose a template, add the approved copy and images, then export the required social format.

The committee handover and the Google Drive release explain the brand rules, asset requirements, and recommended workflow.

### Social templates

Choose one of four covers under **Social templates**, with a corresponding second slide under **Social photo slides**:

- **Pub Social:** beer mugs over two circular coasters, on PhySoc deep teal with white, lime and mint accents.
- **Sober Social:** a citrus drink, snack bowl and die on white with a lime accent.
- **Study Session:** a notebook and pencil on mint.
- **Games Night:** dice on lime.

Pub Social and Sober Social keep those names in the Studio gallery; their artwork tags both read **Social**, including the matching photo slides. The Games Night tag uses plain dark text on the lime background.

The covers and photo slides export at 1080 × 1350. Each photo slide has two photo slots with upload, zoom and repositioning, plus editable captions. Both slides use the category's colours. Fill the plain title, caption and meeting-detail placeholders; each template saves its own local draft. Shorten any copy that Studio flags before exporting. Existing drafts keep their saved text.

Across Studio, title and caption placeholders name the field they fill, such as **Title line 1**, **Event title**, **Caption** and **Photo 1 caption**. Calls to action, introductory text and committee questions also start with descriptive labels instead of sample copy.

Where a template has a swipe or back-to-cover bubble, untick **Show carousel prompt** to remove the whole bubble from the graphic and exported PNG. Studio saves this choice with the draft and preserves the prompt text so you can turn it back on. The original Social Post and Social Story remain available alongside the other existing templates.

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

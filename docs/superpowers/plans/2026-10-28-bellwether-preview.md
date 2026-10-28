# Bellwether public preview implementation plan

Goal: publish the redesign as a separate HTTPS static site that opens directly on iPhone Safari, while leaving the original repository's main branch, Pages settings and production artifact unchanged.

Approach: dedicated `f2456hhchv-bit/shattered-reef-bellwether-preview` repository with compiled static assets on `preview-site`; the original source stays on `design/bellwether-phase2`. Build with an explicit preview flag that forces redesigned geography even if a URL requests classic mode. Keep the prototype save namespace and read-only classic import. Existing GitHub Pages project URL remains untouched.

1. Write failing tests for preview mode forcing redesign and deployment-target rejection. Add artifact tests for metadata, relative assets and `.nojekyll`.
2. Implement a separate build/package/publish script. Restrict all remote mutations to the dedicated preview repository, require a clean named source branch, use fast-forward pushes, and fail closed if an existing target lacks the preview marker. Do not edit production workflows.
3. Build/package locally with preview flags, run the game interaction/save tests and actual mobile Chromium smoke at a project subpath, including hostile classic query and reload. Safari hardware/WebKit limitations must be stated accurately.
4. Create and enable the dedicated public Pages site using GitHub API only once network/auth access is available. Verify public HTML/assets, gameplay, save/reload and touch controls against its HTTPS URL; compare the original main SHA and production entrypoint before/after. Do not provide an unverified URL as a completed deployment.

Current access blocker: API calls to api.github.com are forbidden by the enforced environment policy. A narrow network draft adding api.github.com and the account's github.io host has been saved; publishing the environment configuration is required to apply it. No new credentials requested until API access can establish whether authentication is sufficient.

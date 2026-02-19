<purpose>
Ship the project to a deployment target in 3 phases:

1. **ASK** -- Present project summary, detect stack, suggest platforms, user declares target (this phase)
2. **RESEARCH & PLAN** -- Investigate target requirements, generate deployment checklist (Stage 39)
3. **WALK CHECKLIST** -- Execute auto items, gate on human items, track progress (Stage 40)

Phase 1 is fully implemented. Phases 2 and 3 are expansion points for future stages.
</purpose>

<core_principle>
Smart defaults, user decides. Detect the stack automatically, suggest the best-fit platforms, but the user always declares the final target. Persist the declaration so future phases can act on it without re-asking.
</core_principle>

<process>

<step name="detect_existing_ship" priority="first">

Check for an existing ship plan from a previous run:

```bash
[ -f .ace/ship-plan.md ] && echo "EXISTING_PLAN" || echo "NO_PLAN"
```

**If `.ace/ship-plan.md` exists:**

Read the file to extract the previous target:

```bash
head -20 .ace/ship-plan.md
```

Also check for the target file:

```bash
cat .ace/ship-target.md 2>/dev/null
```

Present options using AskUserQuestion:
- header: "Existing Ship Plan"
- question: "Found an existing ship plan for [previous target]. What would you like to do?"
- options:
  - "Resume" (description: "Continue where you left off")
  - "Restart" (description: "Start fresh for the same target")
  - "Different target" (description: "Ship somewhere else")

**If "Resume":** Skip to Phase 2 or Phase 3 depending on plan status. If Phase 2 is not yet implemented, inform the user:

```
Phase 2 (Research & Plan) will be implemented in Stage 39.
Run /ace.ship again after Stage 39 is complete to continue.
```

**If "Restart":** Delete both files and continue to phase_1_ask:

```bash
rm -f .ace/ship-plan.md .ace/ship-target.md
```

**If "Different target":** Delete both files and continue to phase_1_ask:

```bash
rm -f .ace/ship-plan.md .ace/ship-target.md
```

**If `.ace/ship-plan.md` does NOT exist:** Continue to phase_1_ask.

</step>

<step name="phase_1_ask">

Phase 1 has 6 sub-steps: extract project summary, detect stack, map stack to platforms, present summary and suggestions, persist target, display completion message.

---

**Sub-step 2a: Extract project summary from brief.md**

Read `.ace/brief.md` and extract:

```bash
# Project name from first heading
PROJECT_NAME=$(head -1 .ace/brief.md 2>/dev/null | sed 's/^# //')

# Platform from Context section
PLATFORM=$(grep -m1 '^\*\*Platform:\*\*' .ace/brief.md 2>/dev/null | sed 's/\*\*Platform:\*\* //')
```

Also extract from brief.md by reading these sections:
- `## What This Is` -- 2-3 sentence project description
- `## Core Value` -- one-liner priority statement
- `## Requirements > ### Active` -- what is currently being built

If brief.md does not exist, inform the user and stop:

```
No .ace/brief.md found. Run /ace.init first to set up your project.
```

---

**Sub-step 2b: Stack detection (5 layers)**

Detect the project's technology stack using 5 layers in priority order:

**Layer 1: brief.md Platform field**

Already extracted above as `$PLATFORM`. Values like: web, mobile-ios, cli, api, desktop, etc.

**Layer 2: `.ace/codebase/STACK.md` (if exists)**

```bash
cat .ace/codebase/STACK.md 2>/dev/null | head -50
```

If present, this contains a full stack analysis from the codebase mapper. Extract framework names, language, and runtime information.

**Layer 3: `.ace/research/stack.md` (if exists)**

```bash
cat .ace/research/stack.md 2>/dev/null | head -50
```

If present, this contains stack recommendations from project research.

**Layer 4: Manifest file detection**

Check for language-specific manifest files:

```bash
[ -f package.json ] && echo "node"
[ -f requirements.txt ] || [ -f pyproject.toml ] && echo "python"
[ -f Cargo.toml ] && echo "rust"
[ -f go.mod ] && echo "go"
[ -f Package.swift ] && echo "swift"
[ -f Gemfile ] && echo "ruby"
```

**Layer 5: Framework-specific detection and existing platform config**

Detect frameworks from manifest contents:

```bash
# Node.js frameworks (from package.json dependencies)
grep -q '"next"' package.json 2>/dev/null && echo "nextjs"
grep -q '"react"' package.json 2>/dev/null && echo "react"
grep -q '"vue"' package.json 2>/dev/null && echo "vue"
grep -q '"nuxt"' package.json 2>/dev/null && echo "nuxt"
grep -q '"svelte"' package.json 2>/dev/null && echo "svelte"
grep -q '"express"' package.json 2>/dev/null && echo "express"
grep -q '"fastify"' package.json 2>/dev/null && echo "fastify"
grep -q '"hono"' package.json 2>/dev/null && echo "hono"

# Python frameworks (from requirements.txt or pyproject.toml)
grep -qi 'django' requirements.txt 2>/dev/null && echo "django"
grep -qi 'flask' requirements.txt 2>/dev/null && echo "flask"
grep -qi 'fastapi' requirements.txt 2>/dev/null && echo "fastapi"
```

Detect existing platform configuration:

```bash
[ -f vercel.json ] && echo "vercel-configured"
[ -f netlify.toml ] && echo "netlify-configured"
[ -f fly.toml ] && echo "fly-configured"
[ -f render.yaml ] && echo "render-configured"
[ -f railway.json ] && echo "railway-configured"
[ -f Dockerfile ] && echo "docker"
[ -f docker-compose.yml ] || [ -f docker-compose.yaml ] && echo "docker-compose"
```

Check if npm-publishable:

```bash
# npm-publishable if package.json exists AND "private": true is NOT present
if [ -f package.json ]; then
  grep -q '"private": true' package.json || echo "npm-publishable"
fi
```

Combine all layers into a comma-separated detected stack string for display and mapping.

---

**Sub-step 2c: Map detected stack to suggested platforms**

Use the detected stack to determine platform suggestions. If an existing platform config was detected (vercel.json, netlify.toml, etc.), that platform becomes the primary suggestion.

Otherwise, use this mapping table:

| Detected Stack | Primary | Secondary | Tertiary |
|----------------|---------|-----------|----------|
| Next.js | Vercel | Netlify | AWS Amplify |
| React (CRA/Vite) | Vercel | Netlify | Cloudflare Pages |
| Vue/Nuxt | Vercel | Netlify | Cloudflare Pages |
| Svelte/SvelteKit | Vercel | Netlify | Cloudflare Pages |
| Express/Fastify/Node API | Railway | Render | Fly.io |
| Python (Django/Flask/FastAPI) | Railway | Render | Fly.io |
| Rust (Actix/Axum) | Fly.io | Docker | AWS |
| Go (net/http/Gin/Echo) | Fly.io | Docker | Railway |
| npm package/library | npm registry | GitHub Packages | -- |
| CLI tool (Node) | npm registry | Homebrew | -- |
| CLI tool (Rust) | crates.io | Homebrew | GitHub Releases |
| CLI tool (Go) | GitHub Releases | Homebrew | -- |
| Static site | GitHub Pages | Netlify | Cloudflare Pages |
| Mobile (iOS) | TestFlight | App Store | -- |
| Mobile (Android) | Google Play | Firebase App Distribution | -- |
| Docker-configured | Fly.io | Railway | AWS ECS |

When multiple stacks are detected (e.g., Next.js + npm-publishable), pick the primary platform for the dominant stack and include npm registry as an additional option.

---

**Sub-step 2d: Present project summary and platform suggestions**

Display the project summary and suggestions:

```
## Your Project

**[Project Name]**
[What This Is description from brief.md]

**Stack:** [detected frameworks/languages, comma-separated]
**Platform:** [from brief.md or detected]

---

Based on your stack, here are recommended shipping targets:
```

Then use AskUserQuestion to let the user choose:

- header: "Shipping Target"
- question: "Where do you want to ship [Project Name]?"
- options:
  - "[Primary suggestion]" (description: "Best match for your [detected stack] stack")
  - "[Secondary suggestion]" (description: "Also works well with [detected stack]")
  - "[Tertiary suggestion]" (description: "Alternative option")
  - "Other" (description: "Tell me where you want to ship")

If the user selects "Other", ask a follow-up question:

- header: "Custom Target"
- question: "What platform or service do you want to ship to?"

Use the response as the chosen target.

---

**Sub-step 2e: Persist the declared target**

Write the chosen target to `.ace/ship-target.md`:

```markdown
# Ship Target

**Target:** [chosen platform]
**Declared:** [YYYY-MM-DD]
**Stack detected:** [comma-separated detected stack]
**Status:** awaiting-plan
```

This file is small and intentional. It exists so Phase 2 (Stage 39) can read the target without re-asking the user.

Do NOT create `.ace/ship-plan.md` -- that is Phase 2's responsibility.

---

**Sub-step 2f: Display Phase 1 completion message**

```
Target declared: [chosen platform]

Phase 2 (Research & Plan) will be implemented in Stage 39.
Run /ace.ship again after Stage 39 is complete to continue.
```

</step>

<step name="phase_2_research_plan">

**EXPANSION POINT -- Implemented in Stage 39**

This phase will:
- Read `.ace/ship-target.md` for the declared target
- Spawn ace-stage-scout with a shipping-specific research prompt for the chosen platform
- Research the platform's deployment requirements (CLI tools, config files, environment variables, build steps)
- Generate a deployment checklist at `.ace/ship-plan.md`
- Classify each checklist item as `auto` (Claude executes) or `gate` (user action required)
- Handle credentials/secrets as gates (never auto-handled)

For now, this phase is not yet implemented. If reached (e.g., via "Resume" from detect_existing_ship), display:

```
Phase 2 (Research & Plan) will be implemented in Stage 39.
Run /ace.ship again after Stage 39 is complete to continue.
```

</step>

<step name="phase_3_walk_checklist">

**EXPANSION POINT -- Implemented in Stage 40**

This phase will:
- Read `.ace/ship-plan.md` for the deployment checklist
- Walk through each checklist item in order
- Execute `auto` items (CLI commands, file creation, config changes, commits)
- Present `gate` items for user verification (DNS propagation, environment variables, app store review)
- Handle async gates for long-running operations (wait and re-check)
- Track progress with checkboxes and timestamps
- Handle failures with retry/skip/abort options
- Provide error recovery guidance

For now, this phase is not yet implemented. It is unreachable since Phase 2 (which creates ship-plan.md) is also not yet implemented.

</step>

</process>

<success_criteria>
- [ ] Re-ship detection works when .ace/ship-plan.md exists (resume/restart/different-target)
- [ ] Project summary extracted from brief.md and displayed
- [ ] Stack detected via 5 layers (brief.md, STACK.md, research, manifests, frameworks)
- [ ] Detected stack mapped to platform suggestions
- [ ] User selected target via AskUserQuestion
- [ ] Target persisted to .ace/ship-target.md with status awaiting-plan
- [ ] .ace/ship-plan.md is NOT created by Phase 1
- [ ] Phases 2-3 are clearly marked as expansion points
</success_criteria>

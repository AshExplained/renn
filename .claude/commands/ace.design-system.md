---
name: ace.design-system
description: Create design system (stylekit + components) for a UI stage
argument-hint: "<stage> [--skip-ux-interview]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
  - AskUserQuestion
---

<objective>
Create the project's design system (stylekit + components) for a UI stage by running Phase 1 of the design pipeline. Handles UX interview, UX synthesis, design interview, Phase 1 (stylekit creation + reviewer + approval), and commit. Stops after Phase 1 and directs user to `/ace.design-screens N` for screen prototypes.

Context budget: ~15% orchestrator, fresh 200k per subagent.
</objective>

<execution_context>
@./.claude/ace/workflows/design-stage.md
@./.claude/ace/references/ui-brand.md
</execution_context>

<context>
Stage number: $ARGUMENTS (optional flags)

Normalize stage input in step 2 before any directory lookups.
</context>

<process>
**Follow the design-stage workflow** from `@./.claude/ace/workflows/design-stage.md`.

This command adds `--phase-1-only` semantics to the arguments before the workflow processes them. The `--phase-1-only` flag causes the workflow to:

- Execute all steps through Phase 1 (validate, research, UI detection, UX interview, UX synthesis, design interview, Phase 1 stylekit creation + reviewer + approval + commit)
- STOP after Phase 1 commit -- skip Phase 2, skip implementation guide generation
- Route to the command's `<offer_next>` section

Also pass through `--skip-ux-interview` if present in $ARGUMENTS.

The workflow handles all design pipeline logic including:

1. **Validate environment** -- Check .ace/ exists, resolve horsepower profile
2. **Parse arguments** -- Stage number + --phase-1-only + optional --skip-ux-interview
3. **Validate stage** -- Confirm stage exists in track.md
4. **Ensure stage directory** -- Create if needed, load intel.md early
5. **Handle research** (optional) -- Check existing, offer to run scout
6. **Detect UI stage** -- UI detection, ERROR if non-UI stage (directs to /ace.plan-stage N)
7. **Handle UX interview** -- Dynamic questions from UX.md (unless --skip-ux-interview)
8. **UX synthesis** -- Produce UX brief, persist to file
9. **Handle design (Phase 1 only)** -- Design interview + Phase 1 (stylekit creation + reviewer + approval + commit) then STOP
10. **Present final status** -- Route to offer_next
</process>

<offer_next>
Output this markdown directly (not as a code block):

---

ACE > STAGE {X} DESIGN SYSTEM COMPLETE

Stage {X}: {Name} -- design system created

Artifacts:
- Stylekit: .ace/design/stylekit.yaml
- CSS: .ace/design/stylekit.css
- Preview: .ace/design/stylekit-preview.html
- Components: .ace/design/components/
- UX Brief: {STAGE_DIR}/{STAGE}-ux-brief.md

## Next Up

**Design Screens** -- create screen prototypes using this design system

/ace.design-screens {X}

<sub>/clear first -- fresh context window</sub>

---

**Also available:**
- cat .ace/design/stylekit-preview.html -- review design system
- /ace.design-system {X} -- re-run design system creation

---
</offer_next>

<success_criteria>
- [ ] .ace/ directory validated
- [ ] Stage validated against track
- [ ] Stage directory created if needed
- [ ] UI stage detection completed (non-UI stages error with redirect to /ace.plan-stage)
- [ ] UX interview completed (unless --skip-ux-interview or no UX.md)
- [ ] UX brief synthesized and persisted to file
- [ ] Design interview completed
- [ ] Phase 1 (stylekit) approved
- [ ] Phase 1 design artifacts committed (if commit_docs enabled)
- [ ] Command STOPPED after Phase 1 (did NOT continue to Phase 2)
- [ ] User directed to /ace.design-screens as next step
</success_criteria>

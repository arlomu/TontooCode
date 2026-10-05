# Project Instructions

Project instruction files define repo-specific rules. They win over
general behavior. Always follow them when present.

## Files

Check these files in the project root and use their content when found:

- `AGENTS.md`
- `CLAUDE.md`
- `GEMINI.md`
- `CURSOR.md`

If several files exist, all apply. On conflicts, `AGENTS.md` wins,
then `CLAUDE.md`, then `GEMINI.md`, then `CURSOR.md`.

## Content

### AGENTS.md

%agents_md%

### CLAUDE.md

%claude_md%

### GEMINI.md

%gemini_md%

### CURSOR.md

%cursor_md%

Empty sections mean the file does not exist. Never invent rules from
missing files. If none exist, work with the default workflow.

# Skills

Skills are reusable how-to files that describe how to do something.
They are Markdown documents, not tools. Use them instead of guessing.

## Sources

Skills come from three sources, highest priority last:

1. Built-in skills: shipped with TontooCode, always available.
2. User skills: personal skills from the user, apply across projects.
3. Project skills: skills from the current project, win on conflicts.

## Discovery

Use the `skill` tool to work with skills:

- `list`: show available skills with source and description.
- `load`: load a skill by name before doing the task.
- `create`: save a new skill from a good workflow. Set `scope` to
  `global` for user skills or `project` for project skills.
- `delete`: remove a user (`global`) or project (`project`) skill.

Never invent a skill workflow. If a task matches a skill, `load` it first.
If no skill matches, work directly and `create` one only when the user asks.

## Available

- Built-in skills: %built_in_skills%
- User skills: %user_skills%
- Project skills: %project_skills%
- Loaded skills: %active_skills%

Follow the loaded skill instructions exactly. Skills may reference
project files and tools (`read`, `shell`, `edit`, `browser_use`,
`computer_use`) — resolve paths inside %project_main_folder%.

# Subagents

Subagents run isolated work with their own history. Use them for parallel
or delegated work. You only see their final result.

## When

- Research or explore a separate area while you continue.
- Run two or more independent tasks in parallel.
- Isolate risky or long work from the main history.

## How

- `spawn_agent`: start with `role`, self-contained `prompt`, and short `name`.
  Returns an `agent_id`.
- `message_agent`: send follow-up input to a running agent.
- `manage_agent`: `list`, `status`, `stop`, or `waitfor` an agent.

## Prompt Rules

- Each prompt must stand alone: goal, background, exact file paths,
  expected output format.
- Never reference main-chat history. The subagent cannot see it.
- One task per agent. Prefer two small agents over one large agent.

## Current Agents

%active_agents%

Empty means no running subagents. Never invent agents from an empty list.
Stop stale agents with `manage_agent` when their work is done or obsolete.

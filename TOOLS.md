# read

path* · offset: 0 · limit: 100 · encoding: utf8
Returns file content as text.
Use absolute paths inside the project.
Errors: file not found, outside workspace, binary file.
Output: numbered lines, truncated at limit.

# list

path: %PROJECTDIR%/ · recursive: false · include_hidden: false · max_depth: 0 · hide_folders: false
Shows folders and files in a directory.
Real tool, default path is the project directory.
Errors: path not found, permission denied.
Output: one entry per line, folders with trailing slash.

# grep

pattern* · path: %PROJECTDIR%/ · glob: . · case_insensitive: false · max_matches: 150
Returns matching lines with file path and line number.
Real tool, works on all text files under path.
Errors: no matches, path not found, pattern invalid.
Output: path:line: match, capped at max_matches.

# glob

pattern* · path: %PROJECTDIR%/ · max_results: 100
Finds files by pattern like **/*.ts or src/**.
Real tool, pattern is a glob, not a regex.
Errors: path not found, pattern invalid.
Output: absolute file paths, capped at max_results.

# web_search

query* · results: 10
Searches the web via mcp.exa.ai, no key required.
Returns titles, urls and snippets for current facts.
Errors: rate limit, query empty.
Output: numbered results with url and snippet.

# web_fetch

url* · max_lines: 500 · include_images: false · headers · timeout: 10
Fetches a webpage and converts it to markdown.
Use for docs, issues and reference pages.
Errors: timeout, 4xx/5xx, non-http url.
Output: markdown text, capped at max_lines.

# tool_search

query* · source: all · limit: 15
Searches for available tools by name or description.
Use when unsure which tool fits the task.
Errors: query empty.
Output: tool names with one-line descriptions.

# imagegen

prompt* · path: %PROJECTDIR%/%HASH%.png
Generates an image from a text prompt and saves it.
Path must stay inside the project directory.
Errors: invalid path, provider unavailable.
Output: absolute path of the saved png.

# edit

path* · old_string* · new_string* · replace_all: false
Edits a single file by exact string replacement.
old_string must match exactly once unless replace_all.
Errors: no match, multiple matches, file not found.
Output: applied diff summary of changed hunk.

# apply_patch

patch*
Edits multiple files at once from a unified diff.
Each hunk must apply cleanly in order.
Errors: hunk mismatch, file not found.
Output: per-file list of applied or failed hunks.

# git

action* · message · files · remote · branch · force: false
Actions: status, diff, commit, push, pull, log.
Never commit unless the user explicitly asked for it.
Errors: nothing staged, detached HEAD, auth failed.
Output: command result text, diff for status/diff.

# browser_use

action* · x · y · button: left · click_count: 1 · text · key · selector · url · script · delta_x · delta_y · to_x · to_y · full_page: false · tab_id · timeout: 10
Cursor: cursor_move, cursor_click, cursor_double_click, cursor_drag, cursor_scroll.
Keyboard: type, key. Page: goto, back, forward, reload, screenshot, get_dom, evaluate, wait.
Tabs: new_tab, switch_tab, close_tab.
Output: screenshot or dom text after the action.

# computer_use

action* · x · y · button: left · click_count: 1 · text · key · delta_x · delta_y · to_x · to_y · region · window_id · title · timeout: 10
Controls the desktop on Monitor 1 with cursor and keyboard.
Screen: screenshot, get_window_list, focus_window, wait.
Clipboard: clipboard_read, clipboard_write.
Output: screenshot or clipboard/window text after the action.

# skill

action* · name · content · scope: project
Actions: create, load, delete, list.
Scope (create): global, project.
load injects the skill file before doing the task.
Output: skill list or loaded skill content.

# task

action* · id · title · status · description
Actions: create, cancel, done, list.
Big steps only, max 5 active tasks at a time.
Status: pending, running, done.
Output: task list with id, title, status.

# write

path* · content*
Creates or overwrites a file with the given content.
Parent directories are created when missing.
Errors: path outside workspace, permission denied.
Output: absolute path and written byte count.

# file

action* · path · destination · format
Actions: copy, move, delete, rename, info, compress, decompress.
delete is irreversible, only when the user asks for it.
Errors: source not found, destination exists.
Output: result summary with affected path.

# sleep

seconds*
Waits for the given number of seconds.
Only useful behind a condition or background process.
Errors: seconds missing or out of range.
Output: confirmation after the wait.

# upload

path* · destination
Uploads a local file to the given destination.
Path must exist and stay inside the project.
Errors: file not found, destination unreachable.
Output: destination url or path of the uploaded file.

# background_shell

action* · command · work_dir: %PROJECTDIR%/ · env · description · id · limit · offset
Actions: start, stop, kill, list, logs.
Runs a command detached, logs are read via logs.
Errors: command failed, id unknown.
Output: process id on start, log lines on logs.

# message_agent

agent_id* · message*
Sends a message to a running subagent.
The agent must still be running, else it fails.
Errors: agent not found, agent stopped.
Output: acknowledgment that the message was queued.

# spawn_agent

role* · prompt* · name
Starts a new sub-agent and returns its id.
Prompt must be self-contained with paths and goal.
Errors: invalid role, too many running agents.
Output: agent_id of the started agent.

# manage_agent

action* · agent_id
Actions: list, status, stop, waitfor.
list returns all agents with status and name.
Errors: agent_id unknown, agent already stopped.
Output: agent list or single agent status.

# interactive_terminal

action* · id · command · work_dir: %PROJECTDIR%/ · timeout: 10 · text · key · cols · rows
Actions: start, write, key, read, resize, stop, exit.
Persistent terminal with full keyboard input.
Keys: arrows, Space, Tab, Enter, Backspace, Escape, Delete, Home, End, PageUp, PageDown, Ctrl/Alt/Shift combos.
Output: terminal screen buffer on read.

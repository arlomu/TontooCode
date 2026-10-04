**read**  
path* · offset: 0 · limit: 100 · encoding: utf8  
→ Returns file content

**shell**  
command* · work_dir: %PROJECTDIR%/ · timeout: 120 · env · description  
→ Runs a Powershell or Bash command

**list**  
path: %PROJECTDIR%/ · recursive: false · include_hidden: false · max_depth: 0 · hide_folders: false  
→ Shows folders and files in a directory

**grep**  
pattern* · path: %PROJECTDIR%/ · glob: . · case_insensitive: false · max_matches: 150  
→ Returns matching lines with file path

**glob**  
pattern* · path: %PROJECTDIR%/ · max_results: 100  
→ Finds files by pattern

**web_search**  
query* · results: 10  
→ Searches the web via mcp.exa.ai (no key required)

**web_fetch**  
url* · max_lines: 500 · include_images: false · headers · timeout: 10  
→ Fetches a webpage as markdown

**tool_search**  
query* · source: all · limit: 15  
→ Searches for available tools

**imagegen**  
prompt* · path: %PROJECTDIR%/%HASH%.png  
→ Generates an image

**edit**  
path* · old_string* · new_string* · replace_all: false  
→ Edits a single file

**apply_patch**  
patch*  
→ Edits multiple files at once

**git**  
action* · message · files · remote · branch · force: false  
→ Actions: status, diff, commit, push, pull, log

**browser_use**  
action* · x · y · button: left · click_count: 1 · text · key · selector · url · script · delta_x · delta_y · to_x · to_y · full_page: false · tab_id · timeout: 10  

Cursor: cursor_move, cursor_click, cursor_double_click, cursor_drag, cursor_scroll  
Keyboard: type, key  
Page: goto, back, forward, reload, screenshot, get_dom, evaluate, wait  
Tabs: new_tab, switch_tab, close_tab

**computer_use**  
action* · x · y · button: left · click_count: 1 · text · key · delta_x · delta_y · to_x · to_y · region · window_id · title · timeout: 10  

Cursor: cursor_move, cursor_click, cursor_double_click, cursor_drag, cursor_scroll  
Keyboard: type, key  
Screen: screenshot, get_window_list, focus_window, wait  
Clipboard: clipboard_read, clipboard_write  
→ Controls desktop on Monitor 1

**skill**  
action* · name · content  
→ Actions: create, load, delete, list

**task**  
action* · id · title · status · description  
→ Actions: create, update, remove, list

**write**  
path* · content*  
→ Creates or overwrites a file

**file**  
action* · path · destination · format  
→ Actions: copy, move, delete, rename, info, compress, decompress

**sleep**  
seconds*  
→ Waits for the given number of seconds

**upload**  
path* · destination  
→ Uploads a local file to the given destination

**background_shell**  
action* · command · work_dir: %PROJECTDIR%/ · env · description · id · limit · offset  
→ Actions: start, stop, kill, list, logs

**message_agent**  
agent_id* · message*  
→ Sends a message to a running agent

**spawn_agent**  
role* · prompt* · name  
→ Starts a new sub-agent and returns its id

**manage_agent**  
action* · agent_id  
→ Actions: list, status, stop, waitfor

**interactive_terminal**
action* · id · command · work_dir: %PROJECTDIR%/ · timeout: 10 · text · key · cols · rows
→ Interactive persistent terminal with full keyboard input

**Actions:** start, write, key, read, resize, stop, exit

**Keys:** all keys · Arrow Up/Down/Left/Right · Space · Tab · Enter · Backspace · Escape · Delete · Home · End · PageUp · PageDown · Insert · Ctrl + Key · Alt + Key · Shift + Key · Ctrl + Shift + Key · Ctrl + Alt + Key

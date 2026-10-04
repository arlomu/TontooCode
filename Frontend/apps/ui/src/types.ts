import type { UIDataTypes, UIMessage, UITools } from 'ai';

/** Tool names the workstation knows how to render. */
export type ToolName = 'read_file' | 'grep' | 'run_terminal' | 'web_search' | 'delegate_task';

/**
 * The tool set the workstation knows how to render.
 *
 * The mock backend speaks exactly this vocabulary today; the real Python
 * backend will implement the same tool names so the UI needs no changes.
 */
export interface TontooTools extends UITools {
  read_file: {
    input: { path: string; offset?: number; limit?: number };
    output: string;
  };
  grep: {
    input: { pattern: string; path?: string };
    output: string;
  };
  run_terminal: {
    input: { command: string; cwd?: string };
    output: string;
  };
  web_search: {
    input: { query: string };
    output: string;
  };
  delegate_task: {
    input: { agent: string; task: string };
    output: string;
  };
}

export type TontooMessage = UIMessage<unknown, UIDataTypes, TontooTools>;

"""`git` tool (TOOLS.md): status, diff, commit, push, pull, log."""
from __future__ import annotations

import os
import shutil
import subprocess

#: Hard cap for diff/log output (protects model context).
MAX_OUTPUT_CHARS = 20000

#: Seconds per git invocation.
GIT_TIMEOUT = 120


def _git_binary() -> str | None:
    return shutil.which("git")


def _run(args: list[str], work_dir: str) -> str:
    env = dict(os.environ)
    env["GIT_PAGER"] = "cat"
    env["GIT_TERMINAL_PROMPT"] = "0"
    try:
        proc = subprocess.run(
            ["git", "-c", "core.pager=cat", *args],
            cwd=work_dir,
            capture_output=True,
            text=True,
            timeout=GIT_TIMEOUT,
            env=env,
        )
    except FileNotFoundError:
        return "Error: git binary not found"
    except subprocess.TimeoutExpired:
        return f"Error: git timed out after {GIT_TIMEOUT}s"
    out = (proc.stdout or "") + (proc.stderr or "")
    out = out.strip()
    if proc.returncode != 0:
        return f"Error: git {' '.join(args)} failed (exit {proc.returncode}):\n{out}"
    return out or "(no output)"


def _check_repo(work_dir: str) -> str | None:
    """Return an error string unless work_dir is inside a git work tree."""
    git = _git_binary()
    if git is None:
        return "Error: git binary not found"
    try:
        proc = subprocess.run(
            [git, "rev-parse", "--is-inside-work-tree"],
            cwd=work_dir,
            capture_output=True,
            text=True,
            timeout=30,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        return f"Error: cannot probe git repo: {exc}"
    if proc.returncode != 0 or proc.stdout.strip() != "true":
        return f"Error: '{work_dir}' is not inside a git repository"
    return None


def git_tool(
    project_dir: str,
    action: str,
    message: str = "",
    files: list[str] | None = None,
    remote: str = "",
    branch: str = "",
    force: bool = False,
) -> str:
    """Run git actions in the project folder.

    Mirrors TOOLS.md `git`: action is required (status, diff, commit,
    push, pull, log). commit needs a message; files optionally scope the
    action (default: everything); push/pull take remote/branch; push
    honors force.
    """
    action = (action or "").strip().lower()
    if action not in ("status", "diff", "commit", "push", "pull", "log"):
        return (
            f"Error: unknown git action '{action}' — "
            "use status, diff, commit, push, pull or log"
        )
    if not project_dir:
        return "Error: no project context — git needs a project folder"
    if not _git_binary():
        return "Error: git binary not found"
    repo_error = _check_repo(project_dir)
    if repo_error:
        return repo_error
    paths = files or []

    if action == "status":
        return _run(["status", "--short", "--branch", "--", *paths], project_dir)
    if action == "diff":
        out = _run(["diff", "--", *paths], project_dir)
        return _truncate(out)
    if action == "log":
        return _truncate(_run(["log", "--oneline", "-20", "--", *paths], project_dir))
    if action == "commit":
        if not message or not message.strip():
            return "Error: commit needs a message"
        if paths:
            staged = _run(["add", "--", *paths], project_dir)
            if staged.startswith("Error:"):
                return staged
        else:
            staged = _run(["add", "-A"], project_dir)
            if staged.startswith("Error:"):
                return staged
        return _run(["commit", "-m", message.strip()], project_dir)
    args = ["push" if action == "push" else "pull"]
    if remote.strip():
        args.append(remote.strip())
    if branch.strip():
        args.append(branch.strip())
    if action == "push" and force:
        args.append("--force")
    return _truncate(_run(args, project_dir))


def _truncate(out: str) -> str:
    if len(out) > MAX_OUTPUT_CHARS:
        return out[:MAX_OUTPUT_CHARS] + f"\n… (truncated, {len(out)} chars total)"
    return out

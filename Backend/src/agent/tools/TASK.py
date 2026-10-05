"""`task` tool (TOOLS.md): track big work steps (max 5 active)."""
from __future__ import annotations

from typing import Any

from storage import Storage

#: Statuses a task can carry.
VALID_STATUSES = ("pending", "done", "cancelled")

#: Max active (pending) tasks at a time — mirrors the system prompt rule.
MAX_ACTIVE_TASKS = 5


def task_tool(
    storage: Storage,
    action: str,
    id: int = 0,
    title: str = "",
    status: str = "",
    description: str = "",
) -> str:
    """Manage big work steps (not small details).

    Mirrors TOOLS.md `task`: action is required (create, list, done,
    cancel). create needs a title; done/cancel need an id; list takes an
    optional status filter.
    """
    action = (action or "").strip().lower()
    if action not in ("create", "list", "done", "cancel"):
        return "Error: unknown task action '{0}' — use create, list, done or cancel".format(
            action
        )
    if action == "create":
        return _create(storage, title, status, description)
    if action == "list":
        return _list(storage, status)
    task = storage.get_task(int(id or 0))
    if task is None:
        return f"Error: no task #{id}"
    if action == "done":
        if task["status"] == "done":
            return f"Task #{task['id']} is already done"
        storage.set_task_status(task["id"], "done")
        return f"Task #{task['id']} done: {task['title']}"
    if task["status"] == "cancelled":
        return f"Task #{task['id']} is already cancelled"
    storage.set_task_status(task["id"], "cancelled")
    return f"Task #{task['id']} cancelled: {task['title']}"


def _create(storage: Storage, title: str, status: str, description: str) -> str:
    title = (title or "").strip()
    if not title:
        return "Error: create needs a title"
    want = (status or "pending").strip().lower()
    if want not in VALID_STATUSES:
        return f"Error: bad status '{status}' — use pending, done or cancelled"
    if want == "pending" and len(storage.list_tasks("pending")) >= MAX_ACTIVE_TASKS:
        return (
            f"Error: max {MAX_ACTIVE_TASKS} active tasks — "
            "finish or cancel one first (done/cancel)"
        )
    task = storage.create_task(title, description.strip(), want)
    return f"Task #{task['id']} created [{task['status']}]: {task['title']}"


def _list(storage: Storage, status: str) -> str:
    want = (status or "").strip().lower()
    if want and want not in VALID_STATUSES:
        return f"Error: bad status '{status}' — use pending, done or cancelled"
    tasks: list[dict[str, Any]] = storage.list_tasks(want or None)
    if not tasks:
        return "(no tasks)" if not want else f"(no {want} tasks)"
    lines = []
    for task in tasks:
        lines.append(f"#{task['id']} [{task['status']}] {task['title']}")
        if task["description"]:
            lines.append(f"  {task['description']}")
    return "\n".join(lines)

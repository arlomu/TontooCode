"""FastAPI web server for the Tontoo backend.

Endpoints (all JSON, all localhost-only):
  GET    /api/health
  GET    /api/settings
  PUT    /api/settings
  GET    /api/projects
  POST   /api/projects
  PATCH  /api/projects/{id}
  DELETE /api/projects/{id}
  GET    /api/providers
  POST   /api/providers
  DELETE /api/providers/{id}
  GET    /api/catalog/providers
  GET    /api/catalog/providers/{provider_id}
  POST   /api/catalog/refresh

There are deliberately NO chat endpoints — chats are not stored anywhere
yet. Provider API keys are accepted and stored but never returned.
"""
from __future__ import annotations

import re
import uuid
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from settings import SettingsError, SettingsService
from storage import Storage
import modelsdev

# Local dev origins (Vite + Electron over HTTP). file:// has no origin
# and is same-machine, so it is not subject to CORS preflights here.
LOCAL_ORIGIN = re.compile(r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$")


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    main_folder: str = Field(default="", max_length=1024)
    subfolders: list[str] = Field(default_factory=list)


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    main_folder: str | None = Field(default=None, max_length=1024)
    subfolders: list[str] | None = None


class ProviderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    api_key: str = Field(default="", max_length=4096)


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "provider"


def _new_project_id() -> str:
    return f"p_{uuid.uuid4().hex[:8]}"


def create_app(storage: Storage) -> FastAPI:
    settings = SettingsService(storage)
    storage.ensure_default_project()

    app = FastAPI(title="Tontoo Backend", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=LOCAL_ORIGIN.pattern,
        allow_credentials=False,
        allow_methods=["GET", "PUT", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type"],
    )

    @app.get("/api/health")
    def health() -> dict[str, Any]:
        return {
            "status": "ok",
            "db": str(storage.path),
            "projects": len(storage.list_projects()),
        }

    @app.get("/api/settings")
    def get_settings() -> dict[str, Any]:
        return settings.all()

    @app.put("/api/settings")
    def put_settings(patch: dict[str, Any]) -> dict[str, Any]:
        try:
            return settings.update(patch)
        except SettingsError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @app.get("/api/projects")
    def list_projects() -> list[dict[str, Any]]:
        return storage.list_projects()

    @app.post("/api/projects", status_code=201)
    def create_project(body: ProjectCreate) -> dict[str, Any]:
        return storage.create_project(
            _new_project_id(), body.name.strip(), body.main_folder.strip(), body.subfolders
        )

    @app.patch("/api/projects/{project_id}")
    def update_project(project_id: str, body: ProjectUpdate) -> dict[str, Any]:
        project = storage.update_project(
            project_id,
            name=body.name.strip() if body.name is not None else None,
            main_folder=body.main_folder.strip() if body.main_folder is not None else None,
            subfolders=body.subfolders,
        )
        if project is None:
            raise HTTPException(status_code=404, detail="project not found")
        return project

    @app.delete("/api/projects/{project_id}", status_code=204)
    def delete_project(project_id: str) -> None:
        if project_id == "default":
            raise HTTPException(status_code=400, detail="the default project cannot be deleted")
        if not storage.delete_project(project_id):
            raise HTTPException(status_code=404, detail="project not found")

    # ----- providers (keys accepted, never returned) -----

    @app.get("/api/providers")
    def list_providers() -> list[dict[str, Any]]:
        return storage.list_providers()

    @app.post("/api/providers", status_code=201)
    def create_provider(body: ProviderCreate) -> dict[str, Any]:
        name = body.name.strip()
        candidate = _slugify(name)
        provider_id = candidate
        suffix = 2
        while storage.get_provider(provider_id) is not None:
            provider_id = f"{candidate}-{suffix}"
            suffix += 1
        return storage.create_provider(provider_id, name, body.api_key)

    @app.delete("/api/providers/{provider_id}", status_code=204)
    def delete_provider(provider_id: str) -> None:
        if not storage.delete_provider(provider_id):
            raise HTTPException(status_code=404, detail="provider not found")

    # ----- models.dev catalog (served from a 24h cache) -----

    def _catalog(*, refresh: bool = False) -> dict[str, Any]:
        try:
            return modelsdev.get_catalog(storage, refresh=refresh)
        except modelsdev.ModelsDevError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

    @app.get("/api/catalog/providers")
    def catalog_providers(q: str = "") -> list[dict[str, Any]]:
        catalog = _catalog()
        query = q.strip().lower()
        out = []
        for pid, p in catalog.get("providers", {}).items():
            if query and query not in pid.lower() and query not in p.get("name", "").lower():
                continue
            out.append({"id": pid, "name": p.get("name", pid), "model_count": p.get("model_count", 0)})
        return sorted(out, key=lambda p: p["name"].lower())

    @app.get("/api/catalog/providers/{provider_id}")
    def catalog_provider(provider_id: str) -> dict[str, Any]:
        catalog = _catalog()
        found = modelsdev.find_provider(catalog, provider_id)
        if found is None:
            raise HTTPException(status_code=404, detail="provider not in catalog")
        return found

    @app.post("/api/catalog/refresh")
    def catalog_refresh() -> dict[str, Any]:
        catalog = _catalog(refresh=True)
        return {"fetched_at": storage.get_setting(modelsdev.KEY_FETCHED_AT),
                **modelsdev.catalog_stats(catalog)}

    return app

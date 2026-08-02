"""🐊 DRILO Workflow Library.

Exposes a /drilo/* API that reads the user's real workflows
(user/default/workflows) and attaches editable metadata to them: favorite,
generation type, function, comment, thumbnail and last-used timestamp. It also
reports which models and custom nodes each workflow needs and which of those
are missing from this installation.

It keeps two mirrors under custom_nodes so ComfyUI's native Templates browser
shows a section for the library and another for its starred workflows: ComfyUI
builds that menu by globbing custom_nodes/*/example_workflows/*.json.
"""

import json
import logging
import re
import shutil
import time
import unicodedata
from datetime import datetime
from pathlib import Path

from aiohttp import web

import folder_paths
from server import PromptServer

log = logging.getLogger("DriloLibrary")

BASE_DIR = Path(__file__).parent
# Derived from the install folder so the pack keeps working whatever the user
# (or ComfyUI-Manager) named the directory it was cloned into.
FAV_PACK_DIR = BASE_DIR.parent / f"{BASE_DIR.name}-Favorites"

# The two mirrors must live inside custom_nodes: that is the only place ComfyUI
# looks when building the Templates menu.
MIRROR_DIR = BASE_DIR / "example_workflows"
FAV_MIRROR_DIR = FAV_PACK_DIR / "example_workflows"

ROUTE_PREFIX = "/drilo"

# ---------------------------------------------------------------------------
# Base paths
# ---------------------------------------------------------------------------


def _user_dir() -> Path:
    try:
        return Path(folder_paths.get_user_directory())
    except Exception:
        return Path(folder_paths.base_path) / "user"


def workflows_dir() -> Path:
    """The active user's real workflows folder."""
    return _user_dir() / "default" / "workflows"


# Everything the user creates lives under user/, never inside this package:
# ComfyUI-Manager wipes and reinstalls custom node folders when updating.
DATA_DIR = _user_dir() / "default" / "drilo-library"
THUMBS_DIR = DATA_DIR / "thumbnails"
META_FILE = DATA_DIR / "metadata.json"
TRASH_DIR = DATA_DIR / "trash"


def _ensure_dirs():
    for directory in (DATA_DIR, THUMBS_DIR, MIRROR_DIR, FAV_MIRROR_DIR):
        directory.mkdir(parents=True, exist_ok=True)


def _migrate_legacy_data():
    """Adopt data from older layouts: in-package, and the pre-rename user dir."""
    sources = [
        (BASE_DIR / "metadata.json", BASE_DIR / "thumbnails", BASE_DIR / "trash"),
        (
            _user_dir() / "default" / "cokedrilo" / "metadata.json",
            _user_dir() / "default" / "cokedrilo" / "thumbnails",
            _user_dir() / "default" / "cokedrilo" / "trash",
        ),
    ]
    moved = False

    for legacy_meta, legacy_thumbs, legacy_trash in sources:
        if legacy_meta.exists() and not META_FILE.exists():
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            shutil.move(str(legacy_meta), str(META_FILE))
            moved = True

        for src_dir, dst_dir in ((legacy_thumbs, THUMBS_DIR), (legacy_trash, TRASH_DIR)):
            if not src_dir.is_dir():
                continue
            dst_dir.mkdir(parents=True, exist_ok=True)
            for entry in src_dir.iterdir():
                if entry.is_file() and not (dst_dir / entry.name).exists():
                    shutil.move(str(entry), str(dst_dir / entry.name))
                    moved = True
            try:
                src_dir.rmdir()
            except OSError:
                pass

        legacy_root = legacy_meta.parent
        if legacy_root != BASE_DIR:
            try:
                legacy_root.rmdir()
            except OSError:
                pass

    if moved:
        log.info("DRILO Library: user data migrated to %s", DATA_DIR)


def _ensure_favorites_pack():
    """Create the sibling pack that backs the ⭐ Templates section.

    ComfyUI globs custom_nodes/*/example_workflows one level deep, so a single
    pack can only contribute one section. The second one needs its own folder
    with an importable __init__.py, otherwise its static route is never
    registered and every template in it 404s.
    """
    init_file = FAV_PACK_DIR / "__init__.py"
    if init_file.exists():
        return
    FAV_MIRROR_DIR.mkdir(parents=True, exist_ok=True)
    init_file.write_text(
        '"""The ⭐ section of the Templates browser.\n\n'
        "Generated automatically by the DRILO Workflow Library. The contents of\n"
        "example_workflows are rebuilt every time you star or unstar a workflow,\n"
        "so do not edit this folder by hand.\n"
        '"""\n\n'
        "NODE_CLASS_MAPPINGS = {}\n"
        "NODE_DISPLAY_NAME_MAPPINGS = {}\n",
        encoding="utf-8",
    )
    log.info(
        "DRILO Library: created %s — restart ComfyUI once for the ⭐ section to appear",
        FAV_PACK_DIR,
    )


# ---------------------------------------------------------------------------
# Workflow analysis
# ---------------------------------------------------------------------------

GENERATION_TYPES = ["Image", "Audio", "Video", "3D", "Other"]

# Values written by earlier Spanish-language versions of this pack.
LEGACY_TYPES = {"Imagen": "Image", "Vídeo": "Video", "Otro": "Other"}

# Patterns rather than bare substrings: a loose "wan" matched "PreviewAny".
_AUDIO_RE = re.compile(r"audio|vocoder|musicgen|stableaudio|ace_?step")
_VIDEO_RE = re.compile(r"video|vhs_|savewebm|svd_|animatediff|ltxv|mochi|^wan|cosmos")
_3D_RE = re.compile(r"load3d|save3d|hunyuan3d|trellis|^mesh|_mesh")
_IMAGE_RE = re.compile(r"saveimage|previewimage|emptylatentimage|vaedecode")

_UPSCALE_RE = re.compile(r"upscale|esrgan|ultimatesd")
_CONTROL_RE = re.compile(r"controlnet|ipadapter|depthanything|openpose|canny")
_INPAINT_RE = re.compile(r"inpaint|setlatentnoisemask")

MODEL_EXTENSIONS = (".safetensors", ".ckpt", ".pt", ".pth", ".bin", ".gguf", ".sft", ".onnx")

# Nodes that only exist in the frontend graph, never in NODE_CLASS_MAPPINGS.
FRONTEND_ONLY_NODES = {"Reroute", "Note", "MarkdownNote", "PrimitiveNode"}


def _iter_graphs(data: dict):
    """Yield the root graph and every subgraph definition."""
    yield data
    for subgraph in (data.get("definitions") or {}).get("subgraphs") or []:
        yield subgraph


def _node_types_raw(data: dict) -> list:
    types = []
    for graph in _iter_graphs(data):
        for node in graph.get("nodes") or []:
            node_type = node.get("type")
            if isinstance(node_type, str):
                types.append(node_type)
    return types


def _node_types(data: dict) -> list:
    return [t.lower() for t in _node_types_raw(data)]


def _subgraph_ids(data: dict) -> set:
    ids = set()
    for subgraph in (data.get("definitions") or {}).get("subgraphs") or []:
        if isinstance(subgraph.get("id"), str):
            ids.add(subgraph["id"])
    return ids


def _extract_models(data: dict) -> list:
    """Model filenames referenced anywhere in the graph.

    Scans every widget value rather than a hardcoded list of loader nodes, so
    custom loaders are picked up too.
    """
    found = []

    def consider(value):
        if isinstance(value, str) and value.lower().endswith(MODEL_EXTENSIONS):
            found.append(value)
        elif isinstance(value, dict):
            for nested in value.values():
                consider(nested)
        elif isinstance(value, list):
            for nested in value:
                consider(nested)

    for graph in _iter_graphs(data):
        for node in graph.get("nodes") or []:
            consider(node.get("widgets_values"))

    seen = set()
    unique = []
    for model in found:
        if model not in seen:
            seen.add(model)
            unique.append(model)
    return unique


def _matches(types, pattern):
    return any(pattern.search(t) for t in types)


def guess_generation_type(types: list) -> str:
    if _matches(types, _AUDIO_RE):
        return "Audio"
    if _matches(types, _VIDEO_RE):
        return "Video"
    if _matches(types, _3D_RE):
        return "3D"
    if _matches(types, _IMAGE_RE):
        return "Image"
    return "Other"


def guess_function(types: list, gen_type: str) -> str:
    has_load_image = any("loadimage" in t for t in types)
    if _matches(types, _INPAINT_RE):
        return "inpaint"
    if _matches(types, _UPSCALE_RE):
        return "upscale"
    if gen_type == "Audio":
        return "txt2audio"
    if gen_type == "Video":
        return "img2vid" if has_load_image else "txt2vid"
    if gen_type == "Image":
        if has_load_image and _matches(types, _CONTROL_RE):
            return "img2img + control"
        if has_load_image:
            return "img2img"
        return "txt2img"
    return ""


def analyse(data: dict) -> dict:
    """Everything derived from a workflow's JSON, cached against its mtime."""
    raw_types = _node_types_raw(data)
    lowered = [t.lower() for t in raw_types]
    gen_type = guess_generation_type(lowered)
    subgraphs = _subgraph_ids(data)
    return {
        "generationType": gen_type,
        "function": guess_function(lowered, gen_type),
        "nodeCount": len(data.get("nodes") or []),
        "models": _extract_models(data),
        "nodeTypes": sorted(
            {t for t in raw_types if t not in FRONTEND_ONLY_NODES and t not in subgraphs}
        ),
    }


# ---------------------------------------------------------------------------
# What this installation actually has
# ---------------------------------------------------------------------------


_MODEL_CACHE = {"names": None, "stamp": 0.0}
_MODEL_CACHE_TTL = 30.0


def installed_models() -> set:
    """Every model filename ComfyUI can resolve, by full relative path and basename.

    Cached briefly: walking every model category on each request is the one part
    of the index that grows with the size of the model library rather than with
    the number of workflows.
    """
    now = time.monotonic()
    if _MODEL_CACHE["names"] is not None and now - _MODEL_CACHE["stamp"] < _MODEL_CACHE_TTL:
        return _MODEL_CACHE["names"]

    names = set()
    for category in list(folder_paths.folder_names_and_paths.keys()):
        try:
            for filename in folder_paths.get_filename_list(category):
                names.add(filename)
                names.add(filename.replace("\\", "/"))
                names.add(Path(filename).name)
        except Exception:
            continue

    _MODEL_CACHE["names"] = names
    _MODEL_CACHE["stamp"] = now
    return names


# Node types are NOT checked here. NODE_CLASS_MAPPINGS only knows about Python
# nodes, and packs like KJNodes register some (GetNode, SetNode) purely in the
# frontend — checking server-side reports them as missing when they work fine.
# The UI checks against LiteGraph.registered_node_types instead.


def _missing_models(models: list, available: set) -> list:
    missing = []
    for model in models:
        normalized = model.replace("\\", "/")
        if model in available or normalized in available or Path(normalized).name in available:
            continue
        missing.append(model)
    return missing


# ---------------------------------------------------------------------------
# Metadata store
# ---------------------------------------------------------------------------

DEFAULT_PREFS = {
    "widths": {},
    "rowHeight": 74,
    "hidden": [],
}


def _blank_meta() -> dict:
    return {"version": 2, "items": {}, "prefs": dict(DEFAULT_PREFS)}


def load_meta() -> dict:
    if not META_FILE.exists():
        return _blank_meta()
    try:
        with open(META_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        data.setdefault("items", {})
        prefs = data.setdefault("prefs", {})
        for key, value in DEFAULT_PREFS.items():
            prefs.setdefault(key, value if not isinstance(value, (dict, list)) else type(value)())
        for entry in data["items"].values():
            legacy = LEGACY_TYPES.get(entry.get("generationType"))
            if legacy:
                entry["generationType"] = legacy
        return data
    except Exception as exc:
        log.warning("DRILO Library: metadata.json unreadable (%s); starting fresh", exc)
        return _blank_meta()


def save_meta(meta: dict):
    _ensure_dirs()
    tmp = META_FILE.with_suffix(".json.tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)
    tmp.replace(META_FILE)


def _read_workflow(path: Path) -> dict:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _safe_slug(key: str) -> str:
    """A stable, filesystem-safe name for thumbnails and mirror copies."""
    stem = key[:-5] if key.lower().endswith(".json") else key
    stem = stem.replace("/", " - ")
    normalized = unicodedata.normalize("NFKD", stem).encode("ascii", "ignore").decode("ascii")
    normalized = re.sub(r"[^A-Za-z0-9 ._-]", "", normalized).strip()
    return normalized or "workflow"


# ---------------------------------------------------------------------------
# Index
# ---------------------------------------------------------------------------


def scan_workflows() -> list:
    root = workflows_dir()
    if not root.exists():
        return []
    found = []
    for path in sorted(root.rglob("*.json")):
        if path.name.startswith("."):
            continue
        found.append((path.relative_to(root).as_posix(), path))
    return found


def build_index(prune: bool = True) -> list:
    meta = load_meta()
    items_meta = meta["items"]
    found = scan_workflows()
    known = {key for key, _ in found}
    dirty = False

    if prune:
        for stale in [key for key in items_meta if key not in known]:
            items_meta.pop(stale)
            dirty = True

    available_models = installed_models()

    result = []
    for key, path in found:
        stat = path.stat()
        entry = items_meta.get(key)
        is_new = entry is None
        if is_new:
            entry = {"favorite": False, "comment": "", "thumb": None}
            items_meta[key] = entry
            dirty = True

        # The expensive part — parsing the JSON — only runs when the file changed.
        analysis = entry.get("analysis")
        if not analysis or analysis.get("mtime") != int(stat.st_mtime):
            computed = analyse(_read_workflow(path))
            computed["mtime"] = int(stat.st_mtime)
            entry["analysis"] = analysis = computed
            entry.setdefault("generationType", computed["generationType"])
            entry.setdefault("function", computed["function"])
            entry["nodeCount"] = computed["nodeCount"]
            dirty = True

        if is_new:
            entry.setdefault(
                "lastUsed", datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds")
            )

        thumb = entry.get("thumb")
        thumb_version = 0
        if thumb:
            thumb_path = THUMBS_DIR / thumb
            if thumb_path.exists():
                thumb_version = int(thumb_path.stat().st_mtime)
            else:
                thumb = None
                entry["thumb"] = None
                dirty = True

        models = analysis.get("models", [])
        node_types = analysis.get("nodeTypes", [])
        parent = Path(key).parent.as_posix()

        result.append(
            {
                "key": key,
                "name": path.stem,
                "folder": "" if parent == "." else parent,
                "slug": _safe_slug(key),
                "favorite": bool(entry.get("favorite")),
                "generationType": entry.get("generationType") or "Other",
                "function": entry.get("function") or "",
                "comment": entry.get("comment") or "",
                "lastUsed": entry.get("lastUsed"),
                "runCount": int(entry.get("runCount") or 0),
                "lastRun": entry.get("lastRun"),
                "thumb": thumb,
                "thumbVersion": thumb_version,
                "nodeCount": entry.get("nodeCount") or 0,
                "sizeKb": round(stat.st_size / 1024),
                "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds"),
                "models": models,
                "missingModels": _missing_models(models, available_models),
                "nodeTypes": node_types,
            }
        )

    if dirty:
        save_meta(meta)
    return result


# ---------------------------------------------------------------------------
# Mirrors for the native Templates browser
# ---------------------------------------------------------------------------


def _copy_if_stale(src: Path, dst: Path) -> bool:
    """Copy only when the destination is missing or out of date."""
    try:
        if dst.exists():
            src_stat = src.stat()
            dst_stat = dst.stat()
            if src_stat.st_size == dst_stat.st_size and int(src_stat.st_mtime) == int(
                dst_stat.st_mtime
            ):
                return False
    except OSError:
        pass
    shutil.copy2(src, dst)
    return True


def _prune_mirror(directory: Path, keep: set):
    if not directory.exists():
        return
    for entry in directory.iterdir():
        if entry.is_file() and entry.suffix.lower() in (".json", ".jpg") and entry.name not in keep:
            try:
                entry.unlink()
            except OSError:
                pass


def sync_mirrors() -> dict:
    """Bring the example_workflows folders of both packs up to date.

    Incremental on purpose: this runs on every star, rename, import and delete,
    and a full rewrite would copy the whole workflow collection each time.

    The Templates browser uses the filename as the card title and only picks up
    .jpg thumbnails sharing that same basename.
    """
    _ensure_dirs()
    root = workflows_dir()
    index = build_index()

    keep = {MIRROR_DIR: set(), FAV_MIRROR_DIR: set()}
    total = favorites = copied = 0

    for item in index:
        src = root / item["key"]
        if not src.exists():
            continue
        targets = [MIRROR_DIR]
        if item["favorite"]:
            targets.append(FAV_MIRROR_DIR)

        thumb_src = THUMBS_DIR / item["thumb"] if item["thumb"] else None
        for target in targets:
            json_name = f"{item['slug']}.json"
            keep[target].add(json_name)
            copied += _copy_if_stale(src, target / json_name)
            if thumb_src and thumb_src.exists():
                jpg_name = f"{item['slug']}.jpg"
                keep[target].add(jpg_name)
                copied += _copy_if_stale(thumb_src, target / jpg_name)

        total += 1
        if item["favorite"]:
            favorites += 1

    for directory, names in keep.items():
        _prune_mirror(directory, names)

    return {"synced": total, "favorites": favorites, "copied": copied}


# ---------------------------------------------------------------------------
# HTTP routes
# ---------------------------------------------------------------------------

routes = PromptServer.instance.routes

EDITABLE_FIELDS = {"favorite", "generationType", "function", "comment"}


def _resolve_key(key: str):
    """Resolve a workflow key to an existing path inside the workflows folder."""
    root = workflows_dir()
    path = (root / (key or "")).resolve()
    if not str(path).startswith(str(root.resolve())) or not path.exists():
        return None, root
    return path, root


def _save_thumbnail(raw: bytes, filename: str) -> bool:
    try:
        import io

        from PIL import Image

        image = Image.open(io.BytesIO(raw))
        if getattr(image, "is_animated", False):
            image.seek(0)
        if image.mode not in ("RGB", "L"):
            image = image.convert("RGB")
        image.thumbnail((640, 640))
        image.save(THUMBS_DIR / filename, "JPEG", quality=88)
        return True
    except Exception as exc:
        log.warning("DRILO Library: could not process thumbnail %s: %s", filename, exc)
        return False


@routes.get(f"{ROUTE_PREFIX}/items")
async def drilo_items(request):
    items = build_index()
    return web.json_response(
        {
            "items": items,
            "generationTypes": GENERATION_TYPES,
            "workflowsDir": str(workflows_dir()),
            "prefs": load_meta().get("prefs", dict(DEFAULT_PREFS)),
            # So the Templates picker can skip this pack's own mirror sections.
            "packModules": [BASE_DIR.name, FAV_PACK_DIR.name],
        }
    )


@routes.post(f"{ROUTE_PREFIX}/prefs")
async def drilo_prefs(request):
    """Column widths, row height and hidden columns."""
    body = await request.json()
    meta = load_meta()
    prefs = meta.setdefault("prefs", dict(DEFAULT_PREFS))

    widths = body.get("widths")
    if isinstance(widths, dict):
        prefs["widths"] = {
            str(k): max(40, min(900, int(v)))
            for k, v in widths.items()
            if isinstance(v, (int, float))
        }

    row_height = body.get("rowHeight")
    if isinstance(row_height, (int, float)):
        prefs["rowHeight"] = max(44, min(320, int(row_height)))

    hidden = body.get("hidden")
    if isinstance(hidden, list):
        prefs["hidden"] = [str(h) for h in hidden]

    save_meta(meta)
    return web.json_response({"ok": True, "prefs": prefs})


@routes.post(f"{ROUTE_PREFIX}/item")
async def drilo_update_item(request):
    body = await request.json()
    key = body.get("key")
    patch = body.get("patch") or {}
    meta = load_meta()
    entry = meta["items"].get(key)
    if entry is None:
        return web.json_response({"error": f"Unknown workflow: {key}"}, status=404)
    for field, value in patch.items():
        if field not in EDITABLE_FIELDS:
            continue
        entry[field] = bool(value) if field == "favorite" else str(value)[:400]
    save_meta(meta)
    if "favorite" in patch:
        sync_mirrors()
    return web.json_response({"ok": True})


@routes.post(f"{ROUTE_PREFIX}/touch")
async def drilo_touch(request):
    body = await request.json()
    key = body.get("key")
    meta = load_meta()
    entry = meta["items"].get(key)
    if entry is None:
        return web.json_response({"error": "Unknown workflow"}, status=404)
    entry["lastUsed"] = datetime.now().isoformat(timespec="seconds")
    save_meta(meta)
    return web.json_response({"ok": True, "lastUsed": entry["lastUsed"]})


@routes.post(f"{ROUTE_PREFIX}/rename")
async def drilo_rename(request):
    body = await request.json()
    key = body.get("key")
    new_name = (body.get("name") or "").strip()
    src, root = _resolve_key(key)

    if src is None:
        return web.json_response({"error": "Invalid path"}, status=400)
    if not new_name or re.search(r'[\\/:*?"<>|]', new_name):
        return web.json_response({"error": "Invalid name"}, status=400)
    if not new_name.lower().endswith(".json"):
        new_name += ".json"

    dst = src.parent / new_name
    if dst.exists():
        return web.json_response({"error": "A workflow with that name already exists"}, status=409)

    src.rename(dst)
    new_key = dst.relative_to(root).as_posix()
    meta = load_meta()
    if key in meta["items"]:
        meta["items"][new_key] = meta["items"].pop(key)
    save_meta(meta)
    sync_mirrors()
    return web.json_response({"ok": True, "key": new_key})


@routes.post(f"{ROUTE_PREFIX}/duplicate")
async def drilo_duplicate(request):
    body = await request.json()
    key = body.get("key")
    src, root = _resolve_key(key)
    if src is None:
        return web.json_response({"error": "Invalid path"}, status=400)

    stem = src.stem
    dst = src.parent / f"{stem} copy.json"
    counter = 2
    while dst.exists():
        dst = src.parent / f"{stem} copy {counter}.json"
        counter += 1

    shutil.copy2(src, dst)
    new_key = dst.relative_to(root).as_posix()

    meta = load_meta()
    original = meta["items"].get(key)
    if original:
        clone = dict(original)
        clone["favorite"] = False
        clone["lastUsed"] = datetime.now().isoformat(timespec="seconds")
        thumb = original.get("thumb")
        if thumb and (THUMBS_DIR / thumb).exists():
            new_thumb = f"{_safe_slug(new_key)}.jpg"
            shutil.copy2(THUMBS_DIR / thumb, THUMBS_DIR / new_thumb)
            clone["thumb"] = new_thumb
        meta["items"][new_key] = clone
        save_meta(meta)

    sync_mirrors()
    return web.json_response({"ok": True, "key": new_key, "name": dst.stem})


@routes.post(f"{ROUTE_PREFIX}/delete")
async def drilo_delete(request):
    """Move the workflow to a trash folder instead of deleting it outright."""
    body = await request.json()
    key = body.get("key")
    src, _ = _resolve_key(key)
    if src is None:
        return web.json_response({"error": "Invalid path"}, status=400)

    TRASH_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    target = TRASH_DIR / f"{_safe_slug(key)}__{stamp}.json"
    shutil.move(str(src), str(target))

    meta = load_meta()
    entry = meta["items"].pop(key, None)
    if entry and entry.get("thumb"):
        thumb = THUMBS_DIR / entry["thumb"]
        if thumb.exists():
            try:
                shutil.move(str(thumb), str(TRASH_DIR / f"{_safe_slug(key)}__{stamp}.jpg"))
            except OSError:
                pass
    save_meta(meta)
    sync_mirrors()
    return web.json_response({"ok": True, "trash": str(target)})


@routes.post(f"{ROUTE_PREFIX}/import")
async def drilo_import(request):
    """Copy a Templates-browser entry into the user's own workflows."""
    reader = await request.multipart()
    name = None
    workflow_raw = None
    thumb_raw = None
    while True:
        part = await reader.next()
        if part is None:
            break
        if part.name == "name":
            name = (await part.text()).strip()
        elif part.name == "workflow":
            workflow_raw = await part.text()
        elif part.name == "file":
            thumb_raw = await part.read()

    if not name or not workflow_raw:
        return web.json_response({"error": "Missing data"}, status=400)
    if re.search(r'[\\/:*?"<>|]', name):
        return web.json_response({"error": "Invalid name"}, status=400)

    try:
        workflow = json.loads(workflow_raw)
    except Exception:
        return web.json_response({"error": "The template is not valid JSON"}, status=400)

    root = workflows_dir()
    root.mkdir(parents=True, exist_ok=True)
    dst = root / f"{name}.json"
    counter = 2
    while dst.exists():
        dst = root / f"{name} ({counter}).json"
        counter += 1

    with open(dst, "w", encoding="utf-8") as f:
        json.dump(workflow, f, indent=2, ensure_ascii=False)

    key = dst.relative_to(root).as_posix()
    computed = analyse(workflow)
    computed["mtime"] = int(dst.stat().st_mtime)

    _ensure_dirs()
    thumb_name = None
    if thumb_raw and _save_thumbnail(thumb_raw, f"{_safe_slug(key)}.jpg"):
        thumb_name = f"{_safe_slug(key)}.jpg"

    meta = load_meta()
    meta["items"][key] = {
        "favorite": False,
        "generationType": computed["generationType"],
        "function": computed["function"],
        "comment": "",
        "lastUsed": datetime.now().isoformat(timespec="seconds"),
        "thumb": thumb_name,
        "nodeCount": computed["nodeCount"],
        "analysis": computed,
    }
    save_meta(meta)
    sync_mirrors()
    return web.json_response({"ok": True, "key": key, "name": dst.stem})


@routes.post(f"{ROUTE_PREFIX}/run")
async def drilo_run(request):
    """Record that a workflow was actually executed, not merely opened."""
    body = await request.json()
    key = body.get("key")
    meta = load_meta()
    entry = meta["items"].get(key)
    if entry is None:
        return web.json_response({"ok": False, "reason": "not in library"})
    entry["runCount"] = int(entry.get("runCount") or 0) + 1
    entry["lastRun"] = datetime.now().isoformat(timespec="seconds")
    entry["lastUsed"] = entry["lastRun"]
    save_meta(meta)
    return web.json_response({"ok": True, "runCount": entry["runCount"]})


IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".webp", ".gif")


@routes.get(f"{ROUTE_PREFIX}/outputs")
async def drilo_outputs(request):
    """The most recent generated images, for picking a thumbnail."""
    try:
        output_root = Path(folder_paths.get_output_directory())
    except Exception:
        return web.json_response({"items": []})
    if not output_root.exists():
        return web.json_response({"items": []})

    try:
        limit = max(1, min(120, int(request.query.get("limit", 48))))
    except ValueError:
        limit = 48

    found = []
    for path in output_root.rglob("*"):
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS:
            try:
                found.append((path.stat().st_mtime, path))
            except OSError:
                continue

    found.sort(key=lambda pair: pair[0], reverse=True)
    items = []
    for mtime, path in found[:limit]:
        relative = path.relative_to(output_root)
        items.append(
            {
                "filename": path.name,
                "subfolder": relative.parent.as_posix() if relative.parent.as_posix() != "." else "",
                "modified": datetime.fromtimestamp(mtime).isoformat(timespec="seconds"),
            }
        )
    return web.json_response({"items": items})


@routes.post(f"{ROUTE_PREFIX}/thumbnail/from-output")
async def drilo_thumbnail_from_output(request):
    """Use one of the generated images as a workflow's thumbnail."""
    body = await request.json()
    key = body.get("key")
    filename = body.get("filename") or ""
    subfolder = body.get("subfolder") or ""

    meta = load_meta()
    entry = meta["items"].get(key)
    if entry is None:
        return web.json_response({"error": "Unknown workflow"}, status=404)

    try:
        output_root = Path(folder_paths.get_output_directory()).resolve()
    except Exception:
        return web.json_response({"error": "No output directory"}, status=400)

    source = (output_root / subfolder / filename).resolve()
    if not str(source).startswith(str(output_root)) or not source.is_file():
        return web.json_response({"error": "Invalid image path"}, status=400)

    _ensure_dirs()
    thumb_name = f"{_safe_slug(key)}.jpg"
    if not _save_thumbnail(source.read_bytes(), thumb_name):
        return web.json_response({"error": "Could not process the image"}, status=400)

    entry["thumb"] = thumb_name
    save_meta(meta)
    sync_mirrors()
    return web.json_response({"ok": True, "thumb": thumb_name})


@routes.post(f"{ROUTE_PREFIX}/bulk")
async def drilo_bulk(request):
    """Apply one action to many workflows at once."""
    body = await request.json()
    keys = [k for k in (body.get("keys") or []) if isinstance(k, str)]
    action = body.get("action")
    value = body.get("value")

    if not keys:
        return web.json_response({"error": "No workflows selected"}, status=400)

    affected = 0
    trashed = []

    if action in ("favorite", "unfavorite", "generationType", "function"):
        meta = load_meta()
        for key in keys:
            entry = meta["items"].get(key)
            if entry is None:
                continue
            if action == "favorite":
                entry["favorite"] = True
            elif action == "unfavorite":
                entry["favorite"] = False
            else:
                entry[action] = str(value)[:400]
            affected += 1
        save_meta(meta)

    elif action == "delete":
        TRASH_DIR.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        meta = load_meta()
        for key in keys:
            src, _ = _resolve_key(key)
            if src is None:
                continue
            target = TRASH_DIR / f"{_safe_slug(key)}__{stamp}.json"
            counter = 2
            while target.exists():
                target = TRASH_DIR / f"{_safe_slug(key)}__{stamp}-{counter}.json"
                counter += 1
            shutil.move(str(src), str(target))
            entry = meta["items"].pop(key, None)
            if entry and entry.get("thumb"):
                thumb = THUMBS_DIR / entry["thumb"]
                if thumb.exists():
                    try:
                        thumb.unlink()
                    except OSError:
                        pass
            trashed.append(target.name)
            affected += 1
        save_meta(meta)

    else:
        return web.json_response({"error": f"Unknown action: {action}"}, status=400)

    sync_mirrors()
    return web.json_response({"ok": True, "affected": affected, "trashed": trashed})


@routes.post(f"{ROUTE_PREFIX}/thumbnail")
async def drilo_thumbnail(request):
    reader = await request.multipart()
    key = None
    raw = None
    while True:
        part = await reader.next()
        if part is None:
            break
        if part.name == "key":
            key = (await part.text()).strip()
        elif part.name == "file":
            raw = await part.read()

    if not key or not raw:
        return web.json_response({"error": "Missing data"}, status=400)

    meta = load_meta()
    entry = meta["items"].get(key)
    if entry is None:
        return web.json_response({"error": "Unknown workflow"}, status=404)

    _ensure_dirs()
    filename = f"{_safe_slug(key)}.jpg"
    if not _save_thumbnail(raw, filename):
        return web.json_response({"error": "Could not process the image"}, status=400)

    entry["thumb"] = filename
    save_meta(meta)
    sync_mirrors()
    return web.json_response({"ok": True, "thumb": filename})


@routes.post(f"{ROUTE_PREFIX}/thumbnail/clear")
async def drilo_thumbnail_clear(request):
    body = await request.json()
    key = body.get("key")
    meta = load_meta()
    entry = meta["items"].get(key)
    if entry is None:
        return web.json_response({"error": "Unknown workflow"}, status=404)
    thumb = entry.get("thumb")
    if thumb:
        try:
            (THUMBS_DIR / thumb).unlink()
        except OSError:
            pass
    entry["thumb"] = None
    save_meta(meta)
    sync_mirrors()
    return web.json_response({"ok": True})


@routes.get(ROUTE_PREFIX + "/thumb/{name}")
async def drilo_thumb(request):
    name = request.match_info["name"]
    path = (THUMBS_DIR / name).resolve()
    if not str(path).startswith(str(THUMBS_DIR.resolve())) or not path.exists():
        raise web.HTTPNotFound()
    # URLs carry a ?v=<mtime> token, so the browser can cache them properly
    # instead of refetching every thumbnail on every repaint.
    return web.FileResponse(path, headers={"Cache-Control": "public, max-age=86400"})


@routes.post(f"{ROUTE_PREFIX}/sync")
async def drilo_sync(request):
    return web.json_response(sync_mirrors())


def bootstrap():
    """Runs when the custom node is loaded."""
    _ensure_favorites_pack()
    _ensure_dirs()
    _migrate_legacy_data()
    try:
        stats = sync_mirrors()
        log.info(
            "DRILO Library: ready (%s workflows, %s favorites)",
            stats["synced"],
            stats["favorites"],
        )
    except Exception as exc:
        log.warning("DRILO Library: could not sync the Templates mirror: %s", exc)

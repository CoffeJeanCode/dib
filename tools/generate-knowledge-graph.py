#!/usr/bin/env python3
"""
Knowledge Graph Generator for DIB project.
Scans TypeScript/React and Rust source files to produce:
  - graphify-out/graph.json      (nodes + edges)
  - graphify-out/GRAPH_REPORT.md (human-readable summary)
  - graphify-out/graph.html      (interactive visualization)
"""

import json
import os
import re
import sys
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Optional

# ── Config ──────────────────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = ROOT / "graphify-out"

SOURCE_DIRS = ["src", "src-tauri/src"]
SKIP_DIRS = {"node_modules", "dist", "target", ".git", "gen", ".opencode", ".claude", "graphify-out"}
TS_EXTENSIONS = {".ts", ".tsx"}
RUST_EXTENSIONS = {".rs"}
CSS_EXTENSIONS = {".css"}

# ── Data structures ─────────────────────────────────────────────────────────

@dataclass
class Node:
    id: str
    kind: str  # file | class | function | interface | component | module | struct | trait | impl | constant
    file: str
    name: str
    language: str  # ts | rust | css
    line: int = 0
    metadata: dict = field(default_factory=dict)

@dataclass
class Edge:
    source: str
    target: str
    kind: str  # imports | defines | implements | extends | calls | uses

# ── Helpers ─────────────────────────────────────────────────────────────────

def relative(path: Path) -> str:
    return str(path.relative_to(ROOT)).replace("\\", "/")

def node_id(kind: str, name: str, file: str) -> str:
    return f"{kind}:{name}@{file}"

def strip_ext(path: str) -> str:
    for ext in (".ts", ".tsx", ".rs", ".css", ".json"):
        if path.endswith(ext):
            return path[: -len(ext)]
    return path

# ── TypeScript parser ───────────────────────────────────────────────────────

TS_IMPORT_RE = re.compile(
    r"""(?:import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\w+))?\s+from\s+)?|import\s+)["']([^"']+)["']"""
)
TS_EXPORT_CLASS_RE = re.compile(r"export\s+(?:default\s+)?class\s+(\w+)")
TS_EXPORT_FN_RE = re.compile(r"export\s+(?:default\s+)?(?:function|const)\s+(\w+)")
TS_EXPORT_INTERFACE_RE = re.compile(r"export\s+interface\s+(\w+)")
TS_EXPORT_TYPE_RE = re.compile(r"export\s+type\s+(\w+)")
TS_EXPORT_CONST_RE = re.compile(r"export\s+const\s+(\w+)")
TS_CLASS_RE = re.compile(r"(?:export\s+)?class\s+(\w+)")
TS_FUNCTION_RE = re.compile(r"(?:export\s+)?(?:function)\s+(\w+)")
TS_INTERFACE_RE = re.compile(r"(?:export\s+)?interface\s+(\w+)")
TS_COMPONENT_RE = re.compile(r"(?:export\s+)?(?:default\s+)?function\s+([A-Z]\w+)\s*\(")
TS_CONST_RE = re.compile(r"(?:export\s+)?const\s+(\w+)\s*[=:]")


def parse_ts_file(path: Path) -> tuple[list[Node], list[Edge]]:
    nodes: list[Node] = []
    edges: list[Edge] = []
    rel = relative(path)
    lang = "ts"
    if path.suffix == ".tsx":
        lang = "tsx"

    try:
        content = path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return nodes, edges

    lines = content.splitlines()

    # file node
    fid = node_id("file", rel, rel)
    nodes.append(Node(id=fid, kind="file", file=rel, name=rel, language=lang))

    # imports
    for m in TS_IMPORT_RE.finditer(content):
        imp = m.group(1)
        # resolve relative imports
        if imp.startswith("."):
            target_file = strip_ext(relative((path.parent / imp).resolve()))
            # try adding extensions
            for ext in (".ts", ".tsx", "/index.ts", "/index.tsx"):
                candidate = relative((path.parent / (imp + ext)).resolve())
                tid = node_id("file", candidate, candidate)
                if any(n.id == tid for n in nodes) or (path.parent / (imp + ext)).exists():
                    edges.append(Edge(source=fid, target=tid, kind="imports"))
                    break
            else:
                # fallback: just reference the name
                edges.append(Edge(source=fid, target=f"file:{target_file}", kind="imports"))
        else:
            # package import
            edges.append(Edge(source=fid, target=f"package:{imp}", kind="imports"))

    # classes
    for m in TS_CLASS_RE.finditer(content):
        name = m.group(1)
        line = content[: m.start()].count("\n") + 1
        nid = node_id("class", name, rel)
        nodes.append(Node(id=nid, kind="class", file=rel, name=name, language=lang, line=line))
        edges.append(Edge(source=fid, target=nid, kind="defines"))

    # functions (non-component, non-exported already captured)
    seen_fns = {m.group(1) for m in TS_CLASS_RE.finditer(content)}
    for m in TS_FUNCTION_RE.finditer(content):
        name = m.group(1)
        if name in seen_fns:
            continue
        seen_fns.add(name)
        line = content[: m.start()].count("\n") + 1
        nid = node_id("function", name, rel)
        nodes.append(Node(id=nid, kind="function", file=rel, name=name, language=lang, line=line))
        edges.append(Edge(source=fid, target=nid, kind="defines"))

    # components (functions starting with uppercase)
    for m in TS_COMPONENT_RE.finditer(content):
        name = m.group(1)
        if name in seen_fns:
            continue
        seen_fns.add(name)
        line = content[: m.start()].count("\n") + 1
        nid = node_id("component", name, rel)
        nodes.append(Node(id=nid, kind="component", file=rel, name=name, language=lang, line=line))
        edges.append(Edge(source=fid, target=nid, kind="defines"))

    # interfaces
    for m in TS_INTERFACE_RE.finditer(content):
        name = m.group(1)
        line = content[: m.start()].count("\n") + 1
        nid = node_id("interface", name, rel)
        nodes.append(Node(id=nid, kind="interface", file=rel, name=name, language=lang, line=line))
        edges.append(Edge(source=fid, target=nid, kind="defines"))

    # constants
    for m in TS_EXPORT_CONST_RE.finditer(content):
        name = m.group(1)
        if name in seen_fns:
            continue
        seen_fns.add(name)
        line = content[: m.start()].count("\n") + 1
        nid = node_id("constant", name, rel)
        nodes.append(Node(id=nid, kind="constant", file=rel, name=name, language=lang, line=line))
        edges.append(Edge(source=fid, target=nid, kind="defines"))

    # type aliases
    for m in TS_EXPORT_TYPE_RE.finditer(content):
        name = m.group(1)
        line = content[: m.start()].count("\n") + 1
        nid = node_id("type", name, rel)
        nodes.append(Node(id=nid, kind="interface", file=rel, name=name, language=lang, line=line))
        edges.append(Edge(source=fid, target=nid, kind="defines"))

    return nodes, edges

# ── Rust parser ─────────────────────────────────────────────────────────────

RUST_USE_RE = re.compile(r"use\s+([\w:]+(?:::\{[^}]*\})?)\s*;")
RUST_MOD_RE = re.compile(r"mod\s+(\w+)\s*;")
RUST_STRUCT_RE = re.compile(r"(?:pub\s+)?struct\s+(\w+)")
RUST_TRAIT_RE = re.compile(r"(?:pub\s+)?trait\s+(\w+)")
RUST_IMPL_RE = re.compile(r"impl(?:<[^>]*>)?\s+(\w+)(?:<[^>]*>)?\s+for\s+(\w+)")
RUST_IMPL_BLOCK_RE = re.compile(r"impl(?:<[^>]*>)?\s+(\w+)(?:<[^>]*>)?\s*\{")
RUST_FN_RE = re.compile(r"(?:pub\s+)?(?:async\s+)?fn\s+(\w+)")
RUST_ATTR_CMD_RE = re.compile(r"#\[tauri::command\]")


def parse_rust_file(path: Path) -> tuple[list[Node], list[Edge]]:
    nodes: list[Node] = []
    edges: list[Edge] = []
    rel = relative(path)

    try:
        content = path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return nodes, edges

    # file node
    fid = node_id("file", rel, rel)
    nodes.append(Node(id=fid, kind="file", file=rel, name=rel, language="rust"))

    # use statements → edges to other files
    for m in RUST_USE_RE.finditer(content):
        mod_path = m.group(1)
        # resolve crate:: to src-tauri/src/
        resolved = mod_path
        if resolved.startswith("crate::"):
            resolved = resolved.replace("crate::", "src-tauri/src/", 1)
        elif resolved.startswith("super::"):
            resolved = resolved.replace("super::", str(path.parent) + "/")
        # normalize separators
        resolved = resolved.replace("::", "/")
        # try to find the actual file
        for ext in ("", ".rs", "/mod.rs"):
            candidate = relative((ROOT / (resolved + ext)).resolve()) if not os.path.isabs(resolved) else resolved
            if (ROOT / (resolved + ext)).exists():
                tid = node_id("file", candidate, candidate)
                edges.append(Edge(source=fid, target=tid, kind="uses"))
                break
        else:
            edges.append(Edge(source=fid, target=f"module:{mod_path}", kind="uses"))

    # mod declarations
    for m in RUST_MOD_RE.finditer(content):
        name = m.group(1)
        line = content[: m.start()].count("\n") + 1
        nid = node_id("module", name, rel)
        nodes.append(Node(id=nid, kind="module", file=rel, name=name, language="rust", line=line))
        edges.append(Edge(source=fid, target=nid, kind="defines"))
        # try to find the module file
        mod_file = path.parent / f"{name}.rs"
        if mod_file.exists():
            tid = node_id("file", relative(mod_file), relative(mod_file))
            edges.append(Edge(source=nid, target=tid, kind="defines"))

    # structs
    for m in RUST_STRUCT_RE.finditer(content):
        name = m.group(1)
        line = content[: m.start()].count("\n") + 1
        nid = node_id("struct", name, rel)
        nodes.append(Node(id=nid, kind="struct", file=rel, name=name, language="rust", line=line))
        edges.append(Edge(source=fid, target=nid, kind="defines"))

    # traits
    for m in RUST_TRAIT_RE.finditer(content):
        name = m.group(1)
        line = content[: m.start()].count("\n") + 1
        nid = node_id("trait", name, rel)
        nodes.append(Node(id=nid, kind="trait", file=rel, name=name, language="rust", line=line))
        edges.append(Edge(source=fid, target=nid, kind="defines"))

    # impl blocks (Trait for Type)
    for m in RUST_IMPL_RE.finditer(content):
        trait_name = m.group(1)
        type_name = m.group(2)
        line = content[: m.start()].count("\n") + 1
        nid = node_id("impl", f"{trait_name} for {type_name}", rel)
        nodes.append(Node(id=nid, kind="impl", file=rel, name=f"{trait_name} for {type_name}", language="rust", line=line))
        edges.append(Edge(source=fid, target=nid, kind="defines"))
        # relationship edges
        trait_id = node_id("trait", trait_name, "")
        struct_id = node_id("struct", type_name, "")
        edges.append(Edge(source=nid, target=trait_id, kind="implements"))
        edges.append(Edge(source=nid, target=struct_id, kind="implements"))

    # impl blocks (standalone Type)
    for m in RUST_IMPL_BLOCK_RE.finditer(content):
        type_name = m.group(1)
        line = content[: m.start()].count("\n") + 1
        nid = node_id("impl", f"{type_name}", rel)
        nodes.append(Node(id=nid, kind="impl", file=rel, name=type_name, language="rust", line=line))
        edges.append(Edge(source=fid, target=nid, kind="defines"))

    # functions
    seen_fns = set()
    for m in RUST_FN_RE.finditer(content):
        name = m.group(1)
        if name in seen_fns:
            continue
        seen_fns.add(name)
        line = content[: m.start()].count("\n") + 1
        is_cmd = content[max(0, m.start() - 50):m.start()].find("#[tauri::command]") != -1
        nid = node_id("function", name, rel)
        meta = {"tauri_command": is_cmd}
        nodes.append(Node(id=nid, kind="function", file=rel, name=name, language="rust", line=line, metadata=meta))
        edges.append(Edge(source=fid, target=nid, kind="defines"))

    return nodes, edges

# ── CSS parser ──────────────────────────────────────────────────────────────

CSS_SELECTOR_RE = re.compile(r"([.#][\w-]+)")


def parse_css_file(path: Path) -> tuple[list[Node], list[Edge]]:
    rel = relative(path)
    fid = node_id("file", rel, rel)
    nodes = [Node(id=fid, kind="file", file=rel, name=rel, language="css")]
    edges: list[Edge] = []
    return nodes, edges

# ── Graph builder ───────────────────────────────────────────────────────────

def build_graph() -> tuple[list[Node], list[Edge]]:
    all_nodes: list[Node] = []
    all_edges: list[Edge] = []

    for src_dir in SOURCE_DIRS:
        dir_path = ROOT / src_dir
        if not dir_path.exists():
            continue
        for dirpath, dirnames, filenames in os.walk(dir_path):
            # prune excluded dirs
            dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
            for fname in filenames:
                fpath = Path(dirpath) / fname
                ext = fpath.suffix
                if ext in TS_EXTENSIONS:
                    nodes, edges = parse_ts_file(fpath)
                    all_nodes.extend(nodes)
                    all_edges.extend(edges)
                elif ext in RUST_EXTENSIONS:
                    nodes, edges = parse_rust_file(fpath)
                    all_nodes.extend(nodes)
                    all_edges.extend(edges)
                elif ext in CSS_EXTENSIONS:
                    nodes, edges = parse_css_file(fpath)
                    all_nodes.extend(nodes)
                    all_edges.extend(edges)

    return all_nodes, all_edges

# ── Post-process: resolve cross-file symbol references ─────────────────────

def resolve_cross_refs(nodes: list[Node], edges: list[Edge]) -> list[Edge]:
    """Add edges for cross-file references where imported names match symbol names."""
    node_by_name: dict[str, list[Node]] = {}
    for n in nodes:
        if n.kind != "file":
            node_by_name.setdefault(n.name, []).append(n)

    # map file node id → file path
    file_path_by_id = {n.id: n.file for n in nodes if n.kind == "file"}

    new_edges: list[Edge] = []
    for e in edges:
        if e.kind == "imports":
            src_file = file_path_by_id.get(e.source, "")
            # look for symbol matches in imported file
            target_file_node = next((n for n in nodes if n.id == e.target and n.kind == "file"), None)
            if target_file_node:
                target_file = target_file_node.file
                # find all symbols defined in target file
                for n in nodes:
                    if n.file == target_file and n.kind != "file":
                        # check if the symbol name is used in source file
                        pass  # we'll skip content re-reading for perf; keep structural edges
    return new_edges

# ── Output: graph.json ──────────────────────────────────────────────────────

def write_graph_json(nodes: list[Node], edges: list[Edge]):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    graph = {
        "metadata": {
            "project": "DIB - Database Interface Builder",
            "generator": "generate-knowledge-graph.py",
            "node_count": len(nodes),
            "edge_count": len(edges),
        },
        "nodes": [asdict(n) for n in nodes],
        "edges": [asdict(e) for e in edges],
    }
    (OUTPUT_DIR / "graph.json").write_text(
        json.dumps(graph, indent=2, ensure_ascii=False), encoding="utf-8"
    )

# ── Output: GRAPH_REPORT.md ────────────────────────────────────────────────

def write_graph_report(nodes: list[Node], edges: list[Edge]):
    files = [n for n in nodes if n.kind == "file"]
    classes = [n for n in nodes if n.kind == "class"]
    functions = [n for n in nodes if n.kind == "function"]
    components = [n for n in nodes if n.kind == "component"]
    interfaces = [n for n in nodes if n.kind == "interface"]
    structs = [n for n in nodes if n.kind == "struct"]
    traits = [n for n in nodes if n.kind == "trait"]
    impls = [n for n in nodes if n.kind == "impl"]
    modules = [n for n in nodes if n.kind == "module"]

    ts_files = [f for f in files if f.language in ("ts", "tsx")]
    rust_files = [f for f in files if f.language == "rust"]
    css_files = [f for f in files if f.language == "css"]

    tauri_cmds = [n for n in functions if n.metadata.get("tauri_command")]

    imports = [e for e in edges if e.kind == "imports"]
    defines = [e for e in edges if e.kind == "defines"]

    lines = [
        "# Knowledge Graph Report — DIB",
        "",
        f"**Generated:** `generate-knowledge-graph.py`",
        "",
        "---",
        "",
        "## Summary",
        "",
        f"| Metric | Count |",
        f"|--------|-------|",
        f"| Total nodes | {len(nodes)} |",
        f"| Total edges | {len(edges)} |",
        f"| Files | {len(files)} |",
        f"| Classes | {len(classes)} |",
        f"| Functions | {len(functions)} |",
        f"| React Components | {len(components)} |",
        f"| Interfaces / Types | {len(interfaces)} |",
        f"| Rust Structs | {len(structs)} |",
        f"| Rust Traits | {len(traits)} |",
        f"| Rust Impl Blocks | {len(impls)} |",
        f"| Rust Modules | {len(modules)} |",
        f"| Tauri Commands | {len(tauri_cmds)} |",
        "",
        "## Files by Language",
        "",
        f"- **TypeScript/TSX:** {len(ts_files)} files",
        f"- **Rust:** {len(rust_files)} files",
        f"- **CSS:** {len(css_files)} files",
        "",
        "---",
        "",
        "## TypeScript Files",
        "",
    ]

    for f in sorted(ts_files, key=lambda x: x.name):
        sym_edges = [e for e in defines if e.source == f.id]
        imported = [e for e in imports if e.source == f.id]
        lines.append(f"### `{f.name}`")
        if sym_edges:
            symbols = []
            for e in sym_edges:
                target = next((n for n in nodes if n.id == e.target), None)
                if target:
                    symbols.append(f"{target.kind} `{target.name}`")
            lines.append(f"- Defines: {', '.join(symbols)}")
        if imported:
            deps = []
            for e in imported:
                target = next((n for n in nodes if n.id == e.target), None)
                if target:
                    deps.append(f"`{target.name}`")
            lines.append(f"- Imports: {', '.join(deps)}")
        lines.append("")

    lines += ["## Rust Files", ""]
    for f in sorted(rust_files, key=lambda x: x.name):
        sym_edges = [e for e in defines if e.source == f.id]
        used = [e for e in edges if e.source == f.id and e.kind == "uses"]
        lines.append(f"### `{f.name}`")
        if sym_edges:
            symbols = []
            for e in sym_edges:
                target = next((n for n in nodes if n.id == e.target), None)
                if target:
                    symbols.append(f"{target.kind} `{target.name}`")
            lines.append(f"- Defines: {', '.join(symbols)}")
        if used:
            deps = []
            for e in used:
                target = next((n for n in nodes if n.id == e.target), None)
                if target:
                    deps.append(f"`{target.name}`")
            lines.append(f"- Uses: {', '.join(deps)}")
        lines.append("")

    if tauri_cmds:
        lines += ["## Tauri IPC Commands", ""]
        for cmd in sorted(tauri_cmds, key=lambda x: x.name):
            lines.append(f"- `{cmd.name}` ({cmd.file}:{cmd.line})")
        lines.append("")

    # Dependency graph (top-level)
    lines += [
        "---",
        "",
        "## File Dependency Graph (imports)",
        "",
        "```",
    ]
    for f in sorted(ts_files, key=lambda x: x.name):
        imported = [e for e in imports if e.source == f.id]
        for e in imported:
            target = next((n for n in nodes if n.id == e.target), None)
            if target:
                lines.append(f"  {f.name} --> {target.name}")
    lines.append("```")
    lines.append("")

    (OUTPUT_DIR / "GRAPH_REPORT.md").write_text("\n".join(lines), encoding="utf-8")

# ── Output: graph.html ─────────────────────────────────────────────────────

def write_graph_html(nodes: list[Node], edges: list[Edge]):
    # Build nodes/edges for vis.js
    vis_nodes = []
    for n in nodes:
        color = {
            "file": "#4a90d9",
            "class": "#e74c3c",
            "function": "#2ecc71",
            "component": "#9b59b6",
            "interface": "#e67e22",
            "struct": "#e74c3c",
            "trait": "#f39c12",
            "impl": "#1abc9c",
            "module": "#3498db",
            "constant": "#95a5a6",
        }.get(n.kind, "#95a5a6")

        shape = "dot" if n.kind == "file" else "diamond" if n.kind in ("class", "struct") else "triangle" if n.kind == "component" else "square"

        vis_nodes.append({
            "id": n.id,
            "label": n.name.split("/")[-1] if "/" in n.name else n.name,
            "group": n.kind,
            "color": {"background": color, "border": color, "highlight": {"background": color, "border": "#fff"}},
            "shape": shape,
            "size": 15 if n.kind == "file" else 10,
            "title": f"{n.kind}: {n.name}\nFile: {n.file}:{n.line}" if n.line else f"{n.kind}: {n.name}\nFile: {n.file}",
        })

    vis_edges = []
    for e in edges:
        color = "#aaa" if e.kind == "imports" else "#2ecc71" if e.kind == "defines" else "#e74c3c" if e.kind == "implements" else "#9b59b6" if e.kind == "uses" else "#ccc"
        vis_edges.append({
            "from": e.source,
            "to": e.target,
            "arrows": "to",
            "color": {"color": color},
            "label": e.kind,
            "font": {"size": 8, "color": "#666"},
            "smooth": {"type": "curvedCW", "roundness": 0.2},
        })

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DIB Knowledge Graph</title>
<script src="https://unpkg.com/vis-network@9.1.6/standalone/umd/vis-network.min.js"></script>
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ font-family: 'Segoe UI', system-ui, sans-serif; background: #1a1a2e; color: #e0e0e0; }}
  #header {{ padding: 16px 24px; background: #16213e; border-bottom: 1px solid #0f3460; display: flex; align-items: center; gap: 16px; }}
  #header h1 {{ font-size: 18px; font-weight: 600; color: #e94560; }}
  #header .stats {{ font-size: 13px; color: #888; }}
  #graph {{ width: 100vw; height: calc(100vh - 56px); }}
  #legend {{ position: absolute; bottom: 16px; left: 16px; background: rgba(22,33,62,0.95); padding: 12px 16px; border-radius: 8px; border: 1px solid #0f3460; font-size: 12px; }}
  #legend .item {{ display: flex; align-items: center; gap: 8px; margin: 4px 0; }}
  #legend .dot {{ width: 10px; height: 10px; border-radius: 50%; }}
  #search {{ padding: 6px 12px; border-radius: 4px; border: 1px solid #0f3460; background: #0a0a1a; color: #e0e0e0; font-size: 13px; width: 220px; }}
  #search::placeholder {{ color: #555; }}
  #info {{ position: absolute; top: 72px; right: 16px; background: rgba(22,33,62,0.95); padding: 12px 16px; border-radius: 8px; border: 1px solid #0f3460; font-size: 12px; max-width: 320px; display: none; }}
  #info h3 {{ color: #e94560; margin-bottom: 6px; }}
</style>
</head>
<body>
<div id="header">
  <h1>DIB Knowledge Graph</h1>
  <input id="search" type="text" placeholder="Search nodes..." />
  <span class="stats">{len(nodes)} nodes &middot; {len(edges)} edges</span>
</div>
<div id="graph"></div>
<div id="legend">
  <div class="item"><div class="dot" style="background:#4a90d9"></div> File</div>
  <div class="item"><div class="dot" style="background:#e74c3c"></div> Class / Struct</div>
  <div class="item"><div class="dot" style="background:#2ecc71"></div> Function</div>
  <div class="item"><div class="dot" style="background:#9b59b6"></div> Component</div>
  <div class="item"><div class="dot" style="background:#e67e22"></div> Interface</div>
  <div class="item"><div class="dot" style="background:#f39c12"></div> Trait</div>
  <div class="item"><div class="dot" style="background:#1abc9c"></div> Impl</div>
  <div class="item"><div class="dot" style="background:#3498db"></div> Module</div>
</div>
<div id="info"></div>
<script>
const nodesData = {json.dumps(vis_nodes)};
const edgesData = {json.dumps(vis_edges)};

const container = document.getElementById('graph');
const data = {{ nodes: new vis.DataSet(nodesData), edges: new vis.DataSet(edgesData) }};
const options = {{
  physics: {{
    solver: 'forceAtlas2Based',
    forceAtlas2Based: {{ gravitationalConstant: -40, centralGravity: 0.008, springLength: 120, springConstant: 0.02 }},
    stabilization: {{ iterations: 200 }},
  }},
  interaction: {{ hover: true, tooltipDelay: 100, navigationButtons: true, keyboard: true }},
  edges: {{ font: {{ size: 8 }}, width: 1 }},
  groups: {{
    file: {{ borderWidth: 2 }},
    class: {{ borderWidth: 2 }},
    component: {{ borderWidth: 2 }},
    struct: {{ borderWidth: 2 }},
    trait: {{ borderWidth: 2 }},
  }},
}};

const network = new vis.Network(container, data, options);

const infoDiv = document.getElementById('info');
network.on('click', function(params) {{
  if (params.nodes.length > 0) {{
    const nodeId = params.nodes[0];
    const node = nodesData.find(n => n.id === nodeId);
    if (node) {{
      infoDiv.innerHTML = '<h3>' + node.group + '</h3><div>' + node.title.replace(/\\n/g, '<br>') + '</div>';
      infoDiv.style.display = 'block';
    }}
  }} else {{
    infoDiv.style.display = 'none';
  }}
}});

document.getElementById('search').addEventListener('input', function(e) {{
  const query = e.target.value.toLowerCase();
  const updates = nodesData.map(n => ({{
    id: n.id,
    opacity: (!query || n.label.toLowerCase().includes(query) || (n.title && n.title.toLowerCase().includes(query))) ? 1.0 : 0.1,
  }}));
  data.nodes.update(updates);
}});
</script>
</body>
</html>"""

    (OUTPUT_DIR / "graph.html").write_text(html, encoding="utf-8")

# ── Main ────────────────────────────────────────────────────────────────────

def main():
    print(f"Scanning {ROOT} ...")
    nodes, edges = build_graph()
    print(f"  Nodes: {len(nodes)}, Edges: {len(edges)}")

    write_graph_json(nodes, edges)
    print(f"  -> {OUTPUT_DIR / 'graph.json'}")

    write_graph_report(nodes, edges)
    print(f"  -> {OUTPUT_DIR / 'GRAPH_REPORT.md'}")

    write_graph_html(nodes, edges)
    print(f"  -> {OUTPUT_DIR / 'graph.html'}")

    print("Done.")


if __name__ == "__main__":
    main()

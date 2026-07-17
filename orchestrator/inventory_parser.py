"""Parse audit/process-inventory markdown into ProcessRecord list."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

HUB_BASENAMES = frozenset({"study.js", "api.js", "session-store.js"})
RISK_VALUES = frozenset({"likely-broken", "likely-fragile", "likely-fine", "unknown"})

_SECTION_RE = re.compile(r"^##\s+(\d+)\.\s+(.+?)\s*$")
_ID_TOKEN_RE = re.compile(r"`([a-z0-9][a-z0-9-]*)`")


@dataclass
class ProcessRecord:
    id: str
    name: str
    entry_point: str
    files_involved: list[str]
    trigger: str
    depends_on_raw: str
    depends_on_ids: list[str] = field(default_factory=list)
    current_logging_state: str = ""
    error_handling_state: str = ""
    static_risk_assessment: str = "unknown"
    is_critical_path_for_demo: str = "no"
    section_name: str = ""
    section_index: int = 0


def _split_files(cell: str) -> list[str]:
    parts = []
    for raw in cell.split(","):
        t = raw.strip().strip("`")
        if not t or t == "—":
            continue
        # keep basename for hub matching; store as written
        parts.append(t)
    return parts


def _normalize_risk(cell: str) -> str:
    lower = cell.strip().lower()
    for risk in RISK_VALUES:
        if lower.startswith(risk) or risk in lower.split("—")[0]:
            # e.g. "likely-fragile — blocks all…"
            if risk in lower:
                # prefer exact token at start
                head = lower.split("—")[0].strip()
                for r in RISK_VALUES:
                    if head.startswith(r):
                        return r
                return risk
    return "unknown"


def _normalize_yes_no(cell: str) -> str:
    t = cell.strip().lower()
    if t.startswith("yes"):
        return "yes"
    return "no"


def parse_inventory(path: str | Path) -> list[ProcessRecord]:
    text = Path(path).read_text(encoding="utf-8")
    lines = text.splitlines()

    # First pass: collect all ids for depends_on resolution
    all_ids: set[str] = set()
    table_rows: list[tuple[int, str, list[str]]] = []  # section_index, section_name, cells

    section_index = 0
    section_name = ""
    in_table = False
    header_cells: list[str] = []

    for line in lines:
        m = _SECTION_RE.match(line)
        if m:
            section_index = int(m.group(1))
            section_name = f"{m.group(1)}. {m.group(2).strip()}"
            in_table = False
            header_cells = []
            continue

        if not line.startswith("|"):
            in_table = False
            continue

        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if not cells:
            continue

        # separator row
        if all(re.match(r"^:?-+:?$", c.replace(" ", "")) for c in cells):
            continue

        if cells[0].lower() == "id":
            header_cells = [c.lower() for c in cells]
            in_table = True
            continue

        if not in_table or not header_cells:
            continue

        if len(cells) < len(header_cells):
            cells = cells + [""] * (len(header_cells) - len(cells))

        row = {header_cells[i]: cells[i] for i in range(len(header_cells))}
        pid = row.get("id", "").strip().strip("`")
        if not pid:
            continue
        all_ids.add(pid)
        table_rows.append((section_index, section_name, row))

    records: list[ProcessRecord] = []
    for section_index, section_name, row in table_rows:
        pid = row.get("id", "").strip().strip("`")
        depends_raw = row.get("depends_on", "")
        deps = []
        for tok in _ID_TOKEN_RE.findall(depends_raw):
            if tok in all_ids and tok != pid:
                deps.append(tok)
        # also bare ids without backticks if exact match
        for tok in re.findall(r"\b([a-z][a-z0-9-]{2,})\b", depends_raw):
            if tok in all_ids and tok != pid and tok not in deps:
                deps.append(tok)

        records.append(
            ProcessRecord(
                id=pid,
                name=row.get("name", "").strip(),
                entry_point=row.get("entry_point", "").strip(),
                files_involved=_split_files(row.get("files_involved", "")),
                trigger=row.get("trigger", "").strip(),
                depends_on_raw=depends_raw.strip(),
                depends_on_ids=deps,
                current_logging_state=row.get("current_logging_state", "").strip(),
                error_handling_state=row.get("error_handling_state", "").strip(),
                static_risk_assessment=_normalize_risk(row.get("static_risk_assessment", "")),
                is_critical_path_for_demo=_normalize_yes_no(row.get("is_critical_path_for_demo", "")),
                section_name=section_name,
                section_index=section_index,
            )
        )
    return records


def hub_files_for(files_involved: list[str]) -> list[str]:
    hubs = []
    for f in files_involved:
        base = Path(f.replace("\\", "/")).name
        if base in HUB_BASENAMES and base not in hubs:
            hubs.append(base)
    return hubs

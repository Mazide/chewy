"""Load the hand-edited Hero without changing its document identities.

Only the copy assembled into CampScene gets new client namespaces. The saved
namespace map is append-only so later editor clients cannot renumber old ones.
"""
from copy import deepcopy
import json
import os
from pathlib import Path
import re
import tempfile
import xml.etree.ElementTree as ET


_NUMBER = r"(?:0|[1-9][0-9]*)"
_ID = re.compile(rf"{_NUMBER}:{_NUMBER}\Z")
_INITIAL_NAMESPACES = {"1": 101, "5": 105, "9": 109}
_FORBIDDEN = {"ImageAsset", "ScriptAsset", "NestedArtboard", "NestedArtboardLayout"}


def _reference_ids(key, value):
    if key.endswith("Ids"):
        values = value.split("-") if value else []
    elif key.endswith("Id"):
        values = [value]
    else:
        return []
    for ident in values:
        if not _ID.fullmatch(ident) or ident == "0:0":
            raise ValueError(f"Invalid or unresolved reference {key}={value!r}")
    return values


def validate_hero_document(root):
    """Return the self-contained Hero board, or reject an unsafe import.

This intentionally supports the existing vector rig and contour edits only.
The Rive CLI remains responsible for schema and runtime validation.
"""
    if root.tag != "Rive" or root.get("version") != "1" or root.get("kind") != "fragment":
        raise ValueError("Expected a Rive version=1 kind=fragment document")
    boards = list(root.iter("Artboard"))
    if len(boards) != 1 or boards[0] not in list(root) or boards[0].get("name") != "Hero":
        raise ValueError("Expected exactly one artboard named Hero")
    board = boards[0]
    try:
        size = (float(board.get("width", "nan")), float(board.get("height", "nan")))
    except ValueError as error:
        raise ValueError("Hero dimensions must be 506 by 1060") from error
    if size != (506, 1060):
        raise ValueError("Hero dimensions must remain 506 by 1060")

    assets = [child for child in root if child is not board]
    if len(assets) > 1 or any(
        child.tag != "ComponentAsset" or child.get("artboardId") != board.get("id")
        for child in assets
    ):
        raise ValueError("Only Hero and its optional ComponentAsset are supported")

    declared = {}
    for node in root.iter():
        if node is root:
            continue
        if node.tag in _FORBIDDEN:
            raise ValueError(f"Hero must remain self-contained vectors: found {node.tag}")
        ident = node.get("id", "")
        if not _ID.fullmatch(ident) or ident == "0:0":
            raise ValueError(f"{node.tag} needs a valid authored id; found {ident!r}")
        if ident in declared:
            raise ValueError(f"Duplicate authored id {ident}")
        declared[ident] = node

    board_ids = {node.get("id") for node in board.iter()}
    for node in board.iter():
        for key, value in node.attrib.items():
            for ident in _reference_ids(key, value):
                if ident not in board_ids:
                    raise ValueError(f"External or missing Hero reference: {node.tag}.{key}={ident}")
    for asset in assets:
        for node in asset.iter():
            for key, value in node.attrib.items():
                for ident in _reference_ids(key, value):
                    if ident not in declared:
                        raise ValueError(f"Missing ComponentAsset reference: {key}={ident}")

    machine = declared.get(board.get("defaultStateMachineId"))
    if machine is None or machine.tag != "StateMachine" or machine.get("name") != "Hero":
        raise ValueError("Hero must retain its default state machine named Hero")
    style = declared.get(board.get("styleId"))
    if style is None or style.tag != "LayoutComponentStyle":
        raise ValueError("Hero must retain its referenced LayoutComponentStyle")
    return board


def _load_namespaces(path, clients):
    if path.exists():
        namespaces = json.loads(path.read_text())
    else:
        namespaces = dict(_INITIAL_NAMESPACES)
    if not isinstance(namespaces, dict) or any(
        not re.fullmatch(_NUMBER, client)
        or type(destination) is not int
        or destination < 100
        for client, destination in namespaces.items()
    ):
        raise ValueError("Namespace map must map numeric client strings to integers >=100")
    if len(set(namespaces.values())) != len(namespaces):
        raise ValueError("Namespace map destinations must be unique")
    changed = not path.exists()
    used = set(namespaces.values())
    for client in sorted(clients, key=int):
        if client in namespaces:
            continue
        destination = 100
        while destination in used:
            destination += 1
        namespaces[client] = destination
        used.add(destination)
        changed = True
    if changed:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, delete=False) as output:
                temporary = Path(output.name)
                json.dump(namespaces, output, indent=2, sort_keys=True)
                output.write("\n")
            os.replace(temporary, path)
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)
    return namespaces


def load_editable_hero(source_path, namespace_map_path):
    """Return a remapped deep copy; leave all authoritative source bytes alone."""
    source_path, namespace_map_path = Path(source_path), Path(namespace_map_path)
    if source_path.resolve() == namespace_map_path.resolve():
        raise ValueError("Namespace map must be separate from the Hero source")
    original = validate_hero_document(ET.parse(source_path).getroot())
    clients = {node.get("id").split(":")[0] for node in original.iter()}
    namespaces = _load_namespaces(namespace_map_path, clients)
    board = deepcopy(original)

    def remap(ident):
        client, number = ident.split(":")
        return f"{namespaces[client]}:{number}"

    for node in board.iter():
        for key, value in list(node.attrib.items()):
            if key == "id" or key.endswith("Id"):
                node.set(key, remap(value))
            elif key.endswith("Ids"):
                node.set(key, "-".join(remap(ident) for ident in _reference_ids(key, value)))
    return board

#!/usr/bin/env python3
"""Validation script for the pixel art trait library.

Runs all checks before the agent opens a PR. Exit 0 if all pass, exit 1 otherwise.
"""
import json
import sys
from pathlib import Path

from PIL import Image


def validate():
    errors = []

    repo_root = Path(__file__).resolve().parent.parent.parent

    # Check 1: All PNGs in traits/*/ are 32x32, mode P, max 5 unique non-zero pixel values
    traits_dir = repo_root / "traits"
    for subdir in ["heads", "bodies", "accessories", "eyes", "mouths", "backgrounds"]:
        layer_dir = traits_dir / subdir
        if not layer_dir.exists():
            continue
        for png_path in sorted(layer_dir.glob("*.png")):
            try:
                img = Image.open(png_path)
                if img.size != (32, 32):
                    errors.append(f"{png_path}: size is {img.size}, expected (32, 32)")
                if img.mode != "P":
                    errors.append(f"{png_path}: mode is {img.mode}, expected P")
                else:
                    pixel_data = list(img.getdata())
                    unique_nonzero = set(v for v in pixel_data if v != 0)
                    if len(unique_nonzero) > 5:
                        errors.append(
                            f"{png_path}: {len(unique_nonzero)} unique non-zero pixel values, max is 5"
                        )
            except Exception as e:
                errors.append(f"{png_path}: failed to open — {e}")

    # Check 2: traits/index.json is valid JSON with all required fields
    traits_index_path = repo_root / "traits" / "index.json"
    trait_registry = None
    try:
        with open(traits_index_path) as f:
            trait_registry = json.load(f)

        required_trait_fields = [
            "id", "name", "archetype", "palette", "file", "tags",
            "added", "addedBy", "downloads", "combinationsOk", "status",
        ]
        all_ids = []
        for layer, traits in trait_registry.get("traits", {}).items():
            for trait in traits:
                for field in required_trait_fields:
                    if field not in trait:
                        errors.append(f"Trait {trait.get('id', '?')} in {layer} missing field: {field}")
                if "id" in trait:
                    all_ids.append(trait["id"])

        # Check 3: No duplicate trait IDs
        seen = set()
        for tid in all_ids:
            if tid in seen:
                errors.append(f"Duplicate trait ID: {tid}")
            seen.add(tid)

        # Check 4: Every trait file referenced in the registry exists on disk
        for layer, traits in trait_registry.get("traits", {}).items():
            for trait in traits:
                trait_file = repo_root / trait.get("file", "")
                if not trait_file.exists():
                    errors.append(f"Trait {trait['id']}: file {trait['file']} does not exist")

    except json.JSONDecodeError as e:
        errors.append(f"traits/index.json: invalid JSON — {e}")
    except FileNotFoundError:
        errors.append("traits/index.json: file not found")

    # Check 5: palettes/index.json is valid JSON
    palettes_path = repo_root / "palettes" / "index.json"
    try:
        with open(palettes_path) as f:
            json.load(f)
    except json.JSONDecodeError as e:
        errors.append(f"palettes/index.json: invalid JSON — {e}")
    except FileNotFoundError:
        errors.append("palettes/index.json: file not found")

    # Check 6: stats/usage.json is valid JSON
    stats_path = repo_root / "stats" / "usage.json"
    try:
        with open(stats_path) as f:
            json.load(f)
    except json.JSONDecodeError as e:
        errors.append(f"stats/usage.json: invalid JSON — {e}")
    except FileNotFoundError:
        errors.append("stats/usage.json: file not found")

    if errors:
        print("VALIDATION FAILED:")
        for err in errors:
            print(f"  - {err}")
        sys.exit(1)
    else:
        print("All checks passed.")
        sys.exit(0)


if __name__ == "__main__":
    validate()

"""
review.py — Main agent loop for the CC0 pixel art character generator.

Runs as a GitHub Actions cron job. Reads project context, asks Claude to
propose trait-library improvements, executes approved changes, validates,
opens a PR, and writes a run log.
"""

import anthropic
import json
import os
import subprocess
import requests
from datetime import datetime
from pathlib import Path

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

ROOT = Path(__file__).resolve().parent.parent
TRAITS_INDEX = ROOT / "traits" / "index.json"
USAGE_STATS = ROOT / "stats" / "usage.json"
PALETTES_INDEX = ROOT / "palettes" / "index.json"
MANIFESTO = ROOT / "MANIFESTO.md"
AGENT_MD = ROOT / "AGENT.md"
LOGS_DIR = ROOT / "agent" / "logs"
DEPRECATED_DIR = ROOT / "traits" / "deprecated"

LAYER_PREFIX = {
    "heads": "head",
    "bodies": "body",
    "accessories": "acc",
    "eyes": "eyes",
    "mouths": "mouth",
    "backgrounds": "bg",
}

GITHUB_API = "https://api.github.com"


# ---------------------------------------------------------------------------
# Step 1 — Read context
# ---------------------------------------------------------------------------

def read_context():
    """Read every file and API source the agent needs for its assessment."""

    manifesto_text = MANIFESTO.read_text(encoding="utf-8")
    agent_text = AGENT_MD.read_text(encoding="utf-8")

    with open(TRAITS_INDEX, "r", encoding="utf-8") as f:
        trait_registry = json.load(f)

    with open(USAGE_STATS, "r", encoding="utf-8") as f:
        usage_stats = json.load(f)

    with open(PALETTES_INDEX, "r", encoding="utf-8") as f:
        palettes = json.load(f)

    # Most recent 7 log files by filename
    log_files = sorted(LOGS_DIR.glob("*.json"), key=lambda p: p.name)
    recent_log_files = log_files[-7:] if len(log_files) >= 7 else log_files
    recent_logs = []
    for lf in recent_log_files:
        with open(lf, "r", encoding="utf-8") as f:
            recent_logs.append(json.load(f))

    run_number = len(log_files) + 1

    # GitHub issues
    repo = os.environ["GITHUB_REPO"]
    token = os.environ["GITHUB_TOKEN"]
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github+json",
    }

    trait_requests = _fetch_issues(repo, "trait-request", headers)
    bug_reports = _fetch_issues(repo, "bug", headers)

    return {
        "manifesto_text": manifesto_text,
        "agent_text": agent_text,
        "trait_registry": trait_registry,
        "usage_stats": usage_stats,
        "palettes": palettes,
        "recent_logs": recent_logs,
        "trait_requests": trait_requests,
        "bug_reports": bug_reports,
        "run_number": run_number,
    }


def _fetch_issues(repo, label, headers):
    """Return a slim list of open issues for the given label."""
    url = f"{GITHUB_API}/repos/{repo}/issues"
    params = {"labels": label, "state": "open"}
    resp = requests.get(url, headers=headers, params=params, timeout=30)
    resp.raise_for_status()
    issues = resp.json()
    return [
        {"number": i["number"], "title": i["title"], "body": i.get("body", "")}
        for i in issues
    ]


# ---------------------------------------------------------------------------
# Step 2 — Call Claude
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = (
    "You are the trait evolution agent for a CC0 pixel art character generator.\n"
    "Your job is to assess the current state of the trait library and propose up to 3 improvements.\n"
    "You must follow the MANIFESTO exactly. You must respond with valid JSON only — no markdown, no explanation outside the JSON."
)


def build_user_prompt(ctx):
    """Interpolate all context into the user prompt sent to Claude."""
    return f"""MANIFESTO:
{ctx["manifesto_text"]}

AGENT INSTRUCTIONS:
{ctx["agent_text"]}

CURRENT TRAIT REGISTRY:
{json.dumps(ctx["trait_registry"], indent=2)}

PALETTES:
{json.dumps(ctx["palettes"], indent=2)}

USAGE STATS:
{json.dumps(ctx["usage_stats"], indent=2)}

RECENT RUN LOGS (last 7):
{json.dumps(ctx["recent_logs"], indent=2)}

OPEN TRAIT REQUESTS:
{json.dumps(ctx["trait_requests"], indent=2)}

OPEN BUG REPORTS:
{json.dumps(ctx["bug_reports"], indent=2)}

Respond with a JSON object in exactly this format:
{{
  "assessment": "2-3 sentences describing what you observed about the current state of the trait library",
  "confidence": "high|medium|low",
  "changes": [
    {{
      "type": "new_trait|deprecate_trait|update_registry|update_palette",
      "rationale": "why this change improves the library per the manifesto",
      "details": {{}}
    }}
  ],
  "uncertainty": "anything you are unsure about that a human reviewer should check",
  "signals_used": ["list of what data informed your decisions"]
}}

For type "new_trait", details must include:
{{
  "layer": "heads|bodies|accessories|eyes|mouths|backgrounds",
  "name": "snake_case_name",
  "archetype": "wanderer|merchant|militant|scholar|outcast",
  "palette": "wanderer|merchant|militant|scholar|outcast",
  "tags": ["tag1", "tag2"],
  "pixel_spec": {{
    "palette": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],
    "pixels": [[...32 rows of 32 values...]]
  }}
}}

For type "deprecate_trait", details must include:
{{
  "id": "trait_id_to_deprecate",
  "reason": "specific reason this trait is being deprecated"
}}

For type "update_registry", details must include:
{{
  "id": "trait_id",
  "field": "field_name",
  "value": "new_value"
}}

Maximum 3 changes. Only propose changes that genuinely improve the library per the manifesto.
If nothing needs changing, return an empty changes array and say so in assessment."""


def call_claude(ctx):
    """Send context to Claude and return the raw response text."""
    client = anthropic.Anthropic()
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": build_user_prompt(ctx)}],
    )
    return message.content[0].text


# ---------------------------------------------------------------------------
# Step 3 — Parse response
# ---------------------------------------------------------------------------

def parse_response(raw_text):
    """Parse Claude's JSON response, raising on failure."""
    return json.loads(raw_text)


# ---------------------------------------------------------------------------
# Step 4 — Execute changes
# ---------------------------------------------------------------------------

def next_trait_id(registry, layer):
    """Generate the next unique trait ID across ALL layers."""
    max_num = 0
    for layer_key, traits in registry.items():
        if not isinstance(traits, list):
            continue
        for trait in traits:
            tid = trait.get("id", "")
            parts = tid.rsplit("_", 1)
            if len(parts) == 2:
                try:
                    num = int(parts[1])
                    if num > max_num:
                        max_num = num
                except ValueError:
                    pass
    prefix = LAYER_PREFIX.get(layer, layer)
    return f"{prefix}_{str(max_num + 1).zfill(3)}"


def execute_new_trait(change, registry, errors):
    """Create a new trait: write pixel spec, call generator, update registry."""
    details = change["details"]
    layer = details["layer"]
    trait_id = next_trait_id(registry, layer)

    # Write pixel spec to a temp file
    tmp_path = ROOT / "agent" / f"_tmp_{trait_id}.json"
    spec = details["pixel_spec"]
    spec["id"] = trait_id
    spec["name"] = details["name"]
    spec["layer"] = layer
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(spec, f, indent=2)

    # Call generate_trait.py
    try:
        result = subprocess.run(
            ["python", str(ROOT / "agent" / "tools" / "generate_trait.py"), str(tmp_path)],
            capture_output=True,
            text=True,
            check=True,
        )
    except subprocess.CalledProcessError as exc:
        errors.append(f"generate_trait.py failed for {trait_id}: {exc.stderr}")
        tmp_path.unlink(missing_ok=True)
        raise
    finally:
        tmp_path.unlink(missing_ok=True)

    # Add to registry
    new_entry = {
        "id": trait_id,
        "name": details["name"],
        "layer": layer,
        "archetype": details["archetype"],
        "palette": details["palette"],
        "tags": details.get("tags", []),
        "status": "active",
        "added": datetime.utcnow().strftime("%Y-%m-%d"),
    }

    if layer not in registry:
        registry[layer] = []
    registry[layer].append(new_entry)

    return trait_id


def execute_deprecate_trait(change, registry, errors):
    """Deprecate an existing trait if it has been active for at least 7 days."""
    details = change["details"]
    trait_id = details["id"]

    for layer_key, traits in registry.items():
        if not isinstance(traits, list):
            continue
        for trait in traits:
            if trait.get("id") == trait_id:
                # Check age
                added_str = trait.get("added", "")
                if added_str:
                    try:
                        added_date = datetime.strptime(added_str, "%Y-%m-%d")
                        age_days = (datetime.utcnow() - added_date).days
                        if age_days < 7:
                            msg = (
                                f"Skipping deprecation of {trait_id}: "
                                f"only {age_days} days old (minimum 7)"
                            )
                            errors.append(msg)
                            return None
                    except ValueError:
                        pass

                trait["status"] = "deprecated"

                # Move PNG to deprecated/
                png_name = f"{trait_id}.png"
                src = ROOT / "traits" / layer_key / png_name
                DEPRECATED_DIR.mkdir(parents=True, exist_ok=True)
                dst = DEPRECATED_DIR / png_name
                if src.exists():
                    src.rename(dst)

                return trait_id

    errors.append(f"Trait {trait_id} not found in registry")
    return None


def execute_update_registry(change, registry, errors):
    """Update a single field on an existing trait."""
    details = change["details"]
    trait_id = details["id"]
    field = details["field"]
    value = details["value"]

    for layer_key, traits in registry.items():
        if not isinstance(traits, list):
            continue
        for trait in traits:
            if trait.get("id") == trait_id:
                trait[field] = value
                return trait_id

    errors.append(f"Trait {trait_id} not found in registry for update")
    return None


def execute_changes(response, registry):
    """Execute all proposed changes, returning count and error list."""
    changes = response.get("changes", [])
    executed = 0
    errors = []
    generated_pngs = []

    for change in changes:
        change_type = change.get("type")
        try:
            if change_type == "new_trait":
                tid = execute_new_trait(change, registry, errors)
                if tid:
                    executed += 1
                    generated_pngs.append(tid)
            elif change_type == "deprecate_trait":
                tid = execute_deprecate_trait(change, registry, errors)
                if tid:
                    executed += 1
            elif change_type == "update_registry":
                tid = execute_update_registry(change, registry, errors)
                if tid:
                    executed += 1
            else:
                errors.append(f"Unknown change type: {change_type}")
        except Exception as exc:
            errors.append(str(exc))

    # Update lastUpdated if any changes executed
    if executed > 0:
        registry["lastUpdated"] = datetime.utcnow().strftime("%Y-%m-%d")

    # Persist the registry
    with open(TRAITS_INDEX, "w", encoding="utf-8") as f:
        json.dump(registry, f, indent=2)
        f.write("\n")

    return executed, errors, generated_pngs


# ---------------------------------------------------------------------------
# Step 5 — Validate
# ---------------------------------------------------------------------------

def validate():
    """Run the validation script. Returns (passed: bool, output: str)."""
    result = subprocess.run(
        ["python", str(ROOT / "agent" / "tools" / "validate.py")],
        capture_output=True,
        text=True,
    )
    return result.returncode == 0, result.stdout + result.stderr


def rollback(generated_pngs):
    """Restore traits/index.json from git and remove generated PNGs."""
    subprocess.run(
        ["git", "checkout", str(TRAITS_INDEX)],
        cwd=str(ROOT),
        capture_output=True,
    )
    for tid in generated_pngs:
        # Try to remove from every possible layer directory
        for layer_dir in (ROOT / "traits").iterdir():
            if layer_dir.is_dir():
                png = layer_dir / f"{tid}.png"
                png.unlink(missing_ok=True)


# ---------------------------------------------------------------------------
# Step 6 — Open PR
# ---------------------------------------------------------------------------

def open_pr(run_number, response, executed):
    """Create a branch, commit changes, push, and open a GitHub PR."""
    repo = os.environ["GITHUB_REPO"]
    token = os.environ["GITHUB_TOKEN"]
    branch = f"agent/run-{run_number}"

    assessment = response.get("assessment", "")
    confidence = response.get("confidence", "low")
    uncertainty = response.get("uncertainty", "None noted.")
    signals = response.get("signals_used", [])
    changes = response.get("changes", [])

    # Build summary line
    summary_parts = []
    for c in changes:
        ctype = c.get("type", "change")
        name = c.get("details", {}).get("name", c.get("details", {}).get("id", ""))
        summary_parts.append(f"{ctype} {name}".strip())
    one_line = "; ".join(summary_parts) if summary_parts else "no-op"

    # Format changes for PR body
    changes_md = ""
    for i, c in enumerate(changes, 1):
        changes_md += f"### Change {i}: `{c.get('type')}`\n\n"
        changes_md += f"**Rationale:** {c.get('rationale', 'N/A')}\n\n"
        details = c.get("details", {})
        # Show details without pixel data (too large)
        display_details = {
            k: v for k, v in details.items() if k != "pixel_spec"
        }
        changes_md += f"```json\n{json.dumps(display_details, indent=2)}\n```\n\n"

    signals_md = "\n".join(f"- {s}" for s in signals) if signals else "- None"

    body = (
        f"## What I observed\n\n{assessment}\n\n"
        f"## Changes\n\n{changes_md}\n"
        f"## Uncertainty\n\n{uncertainty}\n\n"
        f"## Signals used\n\n{signals_md}\n\n"
        f"---\n*Run #{run_number} \u00b7 Confidence: {confidence}*"
    )

    # Git operations
    _git("config", "user.name", "pixel-agent")
    _git("config", "user.email", "agent@noreply")
    _git("checkout", "-b", branch)
    _git("add", "traits/", "stats/")
    _git("commit", "-m", f"Agent run #{run_number}: {one_line}")
    _git("push", "origin", branch)

    # Open PR via API
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github+json",
    }
    pr_payload = {
        "title": f"[Agent Run #{run_number}] {one_line}",
        "head": branch,
        "base": "main",
        "body": body,
    }
    pr_resp = requests.post(
        f"{GITHUB_API}/repos/{repo}/pulls",
        headers=headers,
        json=pr_payload,
        timeout=30,
    )
    pr_resp.raise_for_status()
    pr_data = pr_resp.json()
    pr_url = pr_data["html_url"]
    pr_number = pr_data["number"]

    # Add label
    requests.post(
        f"{GITHUB_API}/repos/{repo}/issues/{pr_number}/labels",
        headers=headers,
        json={"labels": ["agent-pr"]},
        timeout=30,
    )

    return pr_url


def _git(*args):
    """Run a git command in the project root, raising on failure."""
    result = subprocess.run(
        ["git"] + list(args),
        cwd=str(ROOT),
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} failed: {result.stderr}")
    return result.stdout


# ---------------------------------------------------------------------------
# Step 7 — Write log
# ---------------------------------------------------------------------------

def write_log(run_number, response, changes_executed, pr_url, validation_passed, errors):
    """Write (and optionally push) the run log."""
    log = {
        "run": run_number,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "assessment": response.get("assessment", ""),
        "confidence": response.get("confidence", "low"),
        "changes_planned": len(response.get("changes", [])),
        "changes_executed": changes_executed,
        "pr_url": pr_url or None,
        "validation_passed": validation_passed,
        "errors": errors,
    }

    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    log_path = LOGS_DIR / f"run_{str(run_number).zfill(3)}.json"
    with open(log_path, "w", encoding="utf-8") as f:
        json.dump(log, f, indent=2)
        f.write("\n")

    # If a PR was opened, commit and push the log on the same branch
    if pr_url:
        try:
            _git("add", "agent/logs/")
            _git("commit", "-m", f"Agent run #{run_number}: log")
            _git("push", "origin", f"agent/run-{run_number}")
        except Exception:
            # Non-fatal: the PR already exists; log push is best-effort
            pass

    return log_path


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    response = {}
    run_number = 0
    changes_executed = 0
    pr_url = None
    validation_passed = False
    errors = []
    generated_pngs = []

    try:
        # ------------------------------------------------------------------
        # Step 1 — Read context
        # ------------------------------------------------------------------
        ctx = read_context()
        run_number = ctx["run_number"]

        # ------------------------------------------------------------------
        # Step 2 — Call Claude
        # ------------------------------------------------------------------
        raw = call_claude(ctx)

        # ------------------------------------------------------------------
        # Step 3 — Parse response
        # ------------------------------------------------------------------
        try:
            response = parse_response(raw)
        except json.JSONDecodeError as exc:
            errors.append(f"JSON parse error: {exc}")
            errors.append(f"Raw response (first 500 chars): {raw[:500]}")
            write_log(run_number, response, 0, None, False, errors)
            raise SystemExit(1)

        # ------------------------------------------------------------------
        # Step 4 — Execute changes
        # ------------------------------------------------------------------
        if response.get("changes"):
            registry = ctx["trait_registry"]
            changes_executed, exec_errors, generated_pngs = execute_changes(
                response, registry
            )
            errors.extend(exec_errors)

            # --------------------------------------------------------------
            # Step 5 — Validate
            # --------------------------------------------------------------
            validation_passed, val_output = validate()
            if not validation_passed:
                errors.append(f"Validation failed: {val_output}")
                rollback(generated_pngs)
                write_log(
                    run_number, response, changes_executed, None, False, errors
                )
                raise SystemExit(1)

            # --------------------------------------------------------------
            # Step 6 — Open PR
            # --------------------------------------------------------------
            pr_url = open_pr(run_number, response, changes_executed)
        else:
            # No changes proposed — still counts as a valid, passing run
            validation_passed = True

    except SystemExit:
        raise
    except Exception as exc:
        errors.append(f"Unhandled error: {exc}")

    # ------------------------------------------------------------------
    # Step 7 — Write log (always)
    # ------------------------------------------------------------------
    write_log(run_number, response, changes_executed, pr_url, validation_passed, errors)

    if errors and not validation_passed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

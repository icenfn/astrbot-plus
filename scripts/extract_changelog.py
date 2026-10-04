#!/usr/bin/env python3
"""Emit release version + body (from CHANGELOG.md) as GitHub Actions outputs.

Writes `version=`, `body<<EOF ... EOF` and `should_release=` to stdout so the
workflow can do `python3 scripts/extract_changelog.py >> "$GITHUB_OUTPUT"`.
"""
from __future__ import annotations

import os
import subprocess
import sys

CHANGELOG = "CHANGELOG.md"


def read_changelog() -> str:
    with open(CHANGELOG, encoding="utf-8") as f:
        return f.read()


def parse(content: str) -> tuple[str, str]:
    lines = content.splitlines()
    version = ""
    body_lines: list[str] = []
    capture = False
    for line in lines:
        if line.startswith("## ") and not capture:
            version = line[3:].strip()
            capture = True
            continue
        if capture and line.startswith("## "):
            break
        if capture:
            body_lines.append(line)
    return version, "\n".join(body_lines).strip()


def tag_exists(tag: str) -> bool:
    # When triggered by a tag push, GITHUB_REF_TYPE == "tag".
    if os.environ.get("GITHUB_REF_TYPE") == "tag":
        return False
    try:
        subprocess.run(
            ["git", "rev-parse", tag],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return True
    except Exception:
        return False


def main() -> None:
    version, body = parse(read_changelog())
    if not version:
        sys.exit("CHANGELOG.md: no '## <version>' section found")
    should = "false" if tag_exists(version) else "true"
    print(f"version={version}")
    print("body<<EOF")
    print(body)
    print("EOF")
    print(f"should_release={should}")


if __name__ == "__main__":
    main()

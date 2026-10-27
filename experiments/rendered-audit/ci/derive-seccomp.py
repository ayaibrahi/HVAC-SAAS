#!/usr/bin/env python3
"""Narrow Chromium user-namespace compatibility adjustment, no cap grants."""
import copy
import json
import pathlib
import sys


def derive(profile):
    result = copy.deepcopy(profile)
    if result.get("defaultAction") != "SCMP_ACT_ERRNO":
        raise ValueError("unexpected default action")
    matching = [rule for rule in result["syscalls"] if "chroot" in rule.get("names", [])]
    if len(matching) != 1:
        raise ValueError("unexpected chroot policy")
    rule = matching[0]
    if (rule.get("names") != ["chroot"] or rule.get("action") != "SCMP_ACT_ALLOW"
            or rule.get("args") != [] or rule.get("includes") != {"caps": ["CAP_SYS_CHROOT"]}
            or rule.get("excludes") != {}):
        raise ValueError("unexpected upstream chroot rule")
    rule["includes"] = {}
    return result


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("expected upstream profile and destination")
    source, destination = map(pathlib.Path, sys.argv[1:])
    if source.resolve() == destination.resolve():
        raise SystemExit("refusing to replace upstream profile")
    with destination.open("x", encoding="utf-8") as output:
        json.dump(derive(json.loads(source.read_text(encoding="utf-8"))), output)

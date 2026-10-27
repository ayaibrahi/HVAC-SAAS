import copy
import importlib.util
import json
import pathlib
import unittest

HERE = pathlib.Path(__file__).parent
SPEC = importlib.util.spec_from_file_location("derive_seccomp", HERE / "derive-seccomp.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class SeccompPolicyTests(unittest.TestCase):
    def setUp(self):
        self.original = json.loads((HERE / "seccomp_profile.json").read_text(encoding="utf-8"))

    def test_only_chroot_capability_condition_changes(self):
        actual = MODULE.derive(self.original)
        expected = copy.deepcopy(self.original)
        rules = [rule for rule in expected["syscalls"] if "chroot" in rule["names"]]
        self.assertEqual(len(rules), 1)
        rules[0]["includes"] = {}
        self.assertEqual(actual, expected)
        self.assertEqual(actual["defaultAction"], "SCMP_ACT_ERRNO")
        original_rule = next(rule for rule in self.original["syscalls"] if "chroot" in rule["names"])
        self.assertEqual(original_rule["includes"], {"caps": ["CAP_SYS_CHROOT"]})

    def test_rejects_unexpected_upstream_profile(self):
        for variation in ("missing", "duplicate", "unsafe_default", "extra_syscall"):
            profile = copy.deepcopy(self.original)
            rule = next(rule for rule in profile["syscalls"] if "chroot" in rule["names"])
            if variation == "missing": profile["syscalls"].remove(rule)
            if variation == "duplicate": profile["syscalls"].append(copy.deepcopy(rule))
            if variation == "unsafe_default": profile["defaultAction"] = "SCMP_ACT_ALLOW"
            if variation == "extra_syscall": rule["names"].append("mount")
            with self.subTest(variation=variation), self.assertRaises(ValueError):
                MODULE.derive(profile)

    def test_runner_keeps_isolation_controls(self):
        script = (HERE / "run-linux.sh").read_text(encoding="utf-8")
        for required in ("--network none", "--user 1000:1000", "--read-only", "--cap-drop ALL",
                         "no-new-privileges=true", "--memory 2g", "--cpus 1", "--pids-limit 256",
                         "--ipc private", "--ulimit core=0", "CONTAINER_CLEANUP_PASS"):
            self.assertIn(required, script)
        for forbidden in ("--privileged", "--network host", "--ipc host", "seccomp=unconfined", "--cap-add"):
            self.assertNotIn(forbidden, script)
        renderer = (HERE.parent / "renderer.ts").read_text(encoding="utf-8")
        self.assertIn("chromiumSandbox: true", renderer)
        self.assertNotIn("--no-sandbox", renderer)


if __name__ == "__main__":
    unittest.main()

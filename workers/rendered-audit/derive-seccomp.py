"""Extend the verified Chromium sandbox profile with AF_UNIX-only networking."""
import importlib.util
import json
import pathlib
import sys

sys.dont_write_bytecode = True

source = pathlib.Path(__file__).resolve().parents[2] / 'experiments/rendered-audit/ci'
spec = importlib.util.spec_from_file_location('base_policy', source / 'derive-seccomp.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
profile = module.derive(json.loads((source / 'seccomp_profile.json').read_text()))
# io_uring and legacy socketcall must not provide alternate socket creation.
blocked = {'socket', 'socketpair', 'socketcall', 'io_uring_setup', 'io_uring_enter', 'io_uring_register'}
for rule in profile['syscalls']:
    rule['names'] = [name for name in rule['names'] if name not in blocked]
profile['syscalls'] = [rule for rule in profile['syscalls'] if rule['names']]
profile['syscalls'].append({'names': ['socket', 'socketpair'], 'action': 'SCMP_ACT_ALLOW',
    'args': [{'index': 0, 'value': 1, 'op': 'SCMP_CMP_EQ'}]})
if len(sys.argv) != 2:
    raise SystemExit('Expected new destination')
with pathlib.Path(sys.argv[1]).open('x', encoding='utf-8', newline='\n') as output:
    output.write(json.dumps(profile, sort_keys=True, separators=(',', ':')) + '\n')

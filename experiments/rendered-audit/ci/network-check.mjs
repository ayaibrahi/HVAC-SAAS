import assert from 'node:assert/strict';
import { networkInterfaces } from 'node:os';
import { connect } from 'node:net';

assert.ok(process.getuid() !== 0, 'Non-root required');
assert.ok(Object.values(networkInterfaces()).flat().every((item) => !item || item.internal), 'Only loopback allowed');
// Reserved TEST-NET address, not a real site. No DNS or HTTP request.
const result = await new Promise((resolve) => {
  const socket = connect({ host: '192.0.2.1', port: 443 });
  const finish = (value) => { socket.destroy(); resolve(value); };
  socket.setTimeout(1000, () => finish('timeout'));
  socket.once('connect', () => finish('connected'));
  socket.once('error', (error) => finish(error.code));
});
assert.ok(['ENETUNREACH', 'EHOSTUNREACH'].includes(result), 'Kernel must reject off-loopback connection');
console.log('NETWORK_BOUNDARY_PASS: non-root, loopback-only, kernel rejects off-network TCP');

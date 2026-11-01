import { workerContainerArgs, type LinuxWorkerConfig } from "./linux-worker";

// Trusted, fixed offline probes only. Each stage runs in a fresh container with
// precisely the production image, UID, mounts, sandbox and resource arguments.
export const bootstrapStages = ["container_process", "node_execution", "attach_stdio", "module_imports", "broker_socket", "network_denial", "chromium_sandbox"] as const;
export type BootstrapStage = typeof bootstrapStages[number];
const scripts: Record<Exclude<BootstrapStage, "container_process">, string> = {
  node_execution: `process.stdout.write('OK\\n')`,
  attach_stdio: `process.stdin.setEncoding('utf8');process.stdin.once('data',s=>{if(s==='PING\\n')process.stdout.write('OK\\n');else process.exitCode=1})`,
  module_imports: `Promise.all([import('playwright-core'),import('/opt/worker/dom.mjs')]).then(()=>process.stdout.write('OK\\n'),()=>{process.exitCode=1})`,
  broker_socket: `const n=require('node:net');const s=n.connect('/run/scanvoro/broker.sock');s.on('data',d=>{if(d.toString()==='PONG\\n')process.stdout.write('OK\\n');else process.exitCode=1;s.end()});s.on('error',()=>{process.exitCode=1})`,
  network_denial: `const n=require('node:net');(async()=>{for(const h of ['93.184.216.34','10.0.0.1','169.254.169.254','127.0.0.1','::1'])await new Promise((yes,no)=>{const s=n.connect({host:h,port:443});s.setTimeout(500,()=>{s.destroy();no()});s.once('connect',()=>{s.destroy();no()});s.once('error',e=>e.code==='EPERM'||e.code==='EACCES'?yes():no())});const v=require('node:fs').readFileSync('/proc/self/status','utf8');if(!/^NoNewPrivs:\\s+1$/m.test(v)||!/^Seccomp:\\s+2$/m.test(v)||process.getuid()===0)throw Error();process.stdout.write('OK\\n')})().catch(()=>{process.exitCode=1})`,
  chromium_sandbox: `(async()=>{const {chromium}=await import('playwright-core');const b=await chromium.launch({chromiumSandbox:true,headless:true,timeout:10000,env:{HOME:'/tmp',TMPDIR:'/tmp',PATH:'/usr/local/bin:/usr/bin:/bin'},args:['--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run']});try{const c=await b.newContext({serviceWorkers:'block'});try{const p=await c.newPage();const d=await c.newCDPSession(p);const r=await d.send('Browser.getBrowserCommandLine');if(r.arguments.includes('--no-sandbox')||!r.arguments.includes('--remote-debugging-pipe'))throw Error();process.stdout.write('OK\\n')}finally{await c.close()}}finally{await b.close()}})().catch(()=>{process.exitCode=1})`,
};
export function bootstrapArgs(config: LinuxWorkerConfig, name: string, directory: string, uid: number, gid: number, stage: BootstrapStage) {
  const args = workerContainerArgs(config, name, directory, uid, gid, 30);
  // Only the final program and its arguments differ; preserve the timeout wrapper.
  args.splice(-2, 2, ...(stage === "container_process" ? ["/usr/bin/true"] : ["node", "-e", scripts[stage]]));
  return args;
}

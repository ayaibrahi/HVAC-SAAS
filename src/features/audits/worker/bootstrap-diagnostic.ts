import { sandboxFailureReasons, verifyBrowserSandbox } from "./sandbox-verification";
import { workerContainerArgs, type LinuxWorkerConfig } from "./linux-worker";

// Trusted, fixed offline probes only. Each stage runs in a fresh container with
// precisely the production image, UID, mounts, sandbox and resource arguments.
export const bootstrapStages = ["container_process", "node_execution", "attach_stdio", "runtime_workdir", "playwright_fs_api", "playwright_resolution", "playwright_file_access", "playwright_import", "dom_access", "dom_import", "broker_socket", "network_denial", "chromium_sandbox"] as const;
export type BootstrapStage = typeof bootstrapStages[number];
// These are fixed diagnostic tokens, not raw Chromium output. Prefer concrete
// kernel/filesystem evidence over Playwright's generic "Target closed" wrapper.
export function chromiumFailureHint(message: string): string {
  const text = message.slice(0, 4096) + message.slice(-8192);
  if (/sys_chroot|chroot.*(?:failed|permitted)/i.test(text)) return "chroot";
  if (/sandbox_host_linux/i.test(text)) return "sandbox_host_linux";
  if (/namespace|unshare|clone.*(?:failed|permitted)/i.test(text)) return "namespace";
  if (/seccomp|bad system call|SIGSYS/i.test(text)) return "seccomp";
  if (/crashpad/i.test(text)) return "crashpad";
  if (/\/dev\/shm|shared.memory|SIGBUS/i.test(text)) return "shm";
  if (/zygote/i.test(text)) return "zygote";
  if (/ENOENT|executable doesn't exist|no such file/i.test(text)) return "executable_missing";
  if (/EACCES|permission denied/i.test(text)) return "permission";
  if (/EPERM|operation not permitted/i.test(text)) return "operation_not_permitted";
  if (/EROFS|read.only file system/i.test(text)) return "readonly_filesystem";
  if (/ENOSPC|no space left/i.test(text)) return "storage_exhausted";
  if (/TimeoutError|timed out|timeout.*exceeded/i.test(text)) return "timeout";
  if (/TargetClosedError|target.*(?:closed|crashed)/i.test(text)) return "target_closed";
  return "unclassified";
}
const chromiumHintPattern = sandboxFailureReasons.join("|") + "|chroot|sandbox_host_linux|namespace|seccomp|crashpad|shm|zygote|executable_missing|permission|operation_not_permitted|readonly_filesystem|storage_exhausted|target_closed|timeout|unclassified";
const chromiumStagePattern = "module_import|executable_check|writable_tmp|browser_launch|context_page|sandbox_verify|cleanup";
const allowedErrorCategories = new Set(["ERR_MODULE_NOT_FOUND", "MODULE_NOT_FOUND", "FILE_NOT_FOUND", "PERMISSION_DENIED", "OPERATION_NOT_PERMITTED", "SYNTAX_ERROR", "REFERENCE_ERROR", "TYPE_ERROR", "WORKDIR_MISMATCH", "INVALID_FS_API", "ERR_INVALID_ARG_TYPE", "ERR_PACKAGE_PATH_NOT_EXPORTED", "ERR_REQUIRE_ESM", "ERR_INVALID_PACKAGE_CONFIG", "MISSING_EXPORT", "PROTOCOL", "SANDBOX_VERIFICATION_FAILED", "OTHER"]);
export function bootstrapFailureCategory(output: string, overflow: boolean, code: number | null): string {
  const match = new RegExp(`^ERR:([A-Z_]+)\\n(?:CWD:(?:/opt/worker|unverified)\\n)?(?:MSG:(?:module_resolution|permission|package_configuration|syntax|unclassified)\\n)?(?:SUBSTAGE:(?:${chromiumStagePattern})\\nHINT:(?:${chromiumHintPattern})\\n)?$`).exec(output);
  return overflow ? "output_limit" : code === null ? "start_or_timeout" : match && allowedErrorCategories.has(match[1]) ? match[1] : "exit_or_protocol";
}
export function bootstrapFailureDetail(output: string, stderr: string, stderrOverflow: boolean, code: number | null): string {
  const category = bootstrapFailureCategory(output, false, code);
  const stderrState = stderrOverflow ? "truncated" : stderr.length ? "bounded" : "empty";
  const safeCode = output.match(/^ERR:([A-Z_]+)\n/)?.[1];
  const message = output.match(/^MSG:(module_resolution|permission|package_configuration|syntax|unclassified)$/m)?.[1] ?? "unavailable";
  const exception = safeCode && allowedErrorCategories.has(safeCode) ? safeCode : "unavailable";
  const stderrCode = stderr.slice(0, 4096).match(/\b(ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND|EACCES|EPERM|ENOENT|ERR_PACKAGE_PATH_NOT_EXPORTED|ERR_INVALID_PACKAGE_CONFIG|ERR_INVALID_ARG_TYPE|ERR_REQUIRE_ESM)\b/)?.[1] ?? "unavailable";
  stderr = stderr.slice(0, 4096);
  const stderrHint = /cannot find (?:module|package)|module_not_found/i.test(stderr) ? "module_resolution" :
    /unhandled(?: promise)? rejection/i.test(stderr) ? "unhandled_rejection" :
    /permission denied|eacces|eperm/i.test(stderr) ? "permission" :
    /invalid package config/i.test(stderr) ? "package_configuration" :
    /syntaxerror/i.test(stderr) ? "syntax" : stderr.length ? "present" : "empty";
  const substage = new RegExp(`^SUBSTAGE:(${chromiumStagePattern})$`, "m").exec(output)?.[1]
    ?? [...stderr.matchAll(new RegExp(`^CHROMIUM_STAGE:(${chromiumStagePattern})$`, "gm"))].at(-1)?.[1];
  const hint = new RegExp(`^HINT:(${chromiumHintPattern})$`, "m").exec(output)?.[1];
  const chromiumDetail = substage ? ` substage=${substage} chromium_hint=${hint ?? chromiumFailureHint(stderr)}` : "";
  return `cwd=${/^CWD:\/opt\/worker$/m.test(output + "\n" + stderr) ? "/opt/worker" : "unverified"} stderr=${stderrState} stderr_code=${stderrCode} stderr_hint=${stderrHint} exception=${exception} message=${message} category=${category}${chromiumDetail}`;
}
// Only finite error codes leave the container; never output messages or paths.
const safeError = `const sandboxReasons=${JSON.stringify(sandboxFailureReasons)};const verifyBrowserSandbox=${verifyBrowserSandbox.toString()};let failed=false;let chromiumStage;const atStage=s=>{chromiumStage=s;process.stderr.write('CHROMIUM_STAGE:'+s+'\\n')};const chromiumHint=${chromiumFailureHint.toString()};const fail=e=>{if(failed)return;failed=true;const c=e?.code;const x=c==='SANDBOX_VERIFICATION_FAILED'?'SANDBOX_VERIFICATION_FAILED':c==='ERR_MODULE_NOT_FOUND'?'ERR_MODULE_NOT_FOUND':c==='MODULE_NOT_FOUND'?'MODULE_NOT_FOUND':c==='ENOENT'?'FILE_NOT_FOUND':c==='EACCES'?'PERMISSION_DENIED':c==='EPERM'?'OPERATION_NOT_PERMITTED':c==='ERR_INVALID_ARG_TYPE'?'ERR_INVALID_ARG_TYPE':c==='ERR_PACKAGE_PATH_NOT_EXPORTED'?'ERR_PACKAGE_PATH_NOT_EXPORTED':c==='ERR_REQUIRE_ESM'?'ERR_REQUIRE_ESM':c==='ERR_INVALID_PACKAGE_CONFIG'?'ERR_INVALID_PACKAGE_CONFIG':c==='MISSING_EXPORT'?'MISSING_EXPORT':c==='PROTOCOL'?'PROTOCOL':e?.name==='SyntaxError'?'SYNTAX_ERROR':e?.name==='ReferenceError'?'REFERENCE_ERROR':e?.name==='TypeError'?'TYPE_ERROR':'OTHER';const m=typeof e?.message==='string'?e.message.slice(0,512):'';const hint=/cannot find (?:module|package)/i.test(m)?'module_resolution':/EACCES|permission denied/i.test(m)?'permission':/invalid package config/i.test(m)?'package_configuration':e?.name==='SyntaxError'?'syntax':'unclassified';process.stdout.write('ERR:'+x+'\\nCWD:'+(process.cwd()==='/opt/worker'?'/opt/worker':'unverified')+'\\nMSG:'+hint+'\\n'+(chromiumStage?'SUBSTAGE:'+chromiumStage+'\\nHINT:'+(sandboxReasons.includes(e?.reason)?e.reason:chromiumHint((e?.name??'')+' '+(typeof e?.message==='string'?e.message:'')))+'\\n':''));process.exitCode=1};`;
const scripts: Record<Exclude<BootstrapStage, "container_process">, string> = {
  node_execution: `process.stdout.write('OK\\n')`,
  attach_stdio: `process.stdin.setEncoding('utf8');process.stdin.once('data',s=>{if(s==='PING\\n')process.stdout.write('OK\\n');else fail({code:'PROTOCOL'})})`,
  runtime_workdir: `try{if(process.cwd()!=='/opt/worker'){process.stdout.write('ERR:WORKDIR_MISMATCH\\n');process.exitCode=1}else process.stdout.write('OK\\n')}catch(e){fail(e)}`,
  playwright_fs_api: `try{const f=require('node:fs');if(typeof f.accessSync!=='function'||typeof f.constants?.R_OK!=='number'){process.stdout.write('ERR:INVALID_FS_API\\n');process.exitCode=1}else process.stdout.write('OK\\n')}catch(e){fail(e)}`,
  // Match runtime.mjs's package boundary and work in either Node eval mode.
  playwright_resolution: `import('node:module').then(({createRequire})=>{createRequire(process.cwd()+'/package.json').resolve('playwright-core');process.stdout.write('OK\\n')},fail).catch(fail)`,
  playwright_file_access: `Promise.all([import('node:module'),import('node:fs')]).then(([{createRequire},{accessSync,constants}])=>{const p=createRequire(process.cwd()+'/package.json').resolve('playwright-core');accessSync(p,constants.R_OK);process.stdout.write('OK\\n')},fail).catch(fail)`,
  playwright_import: `import('playwright-core').then(m=>{if(!m.chromium||typeof m.chromium.launch!=='function')return fail({code:'MISSING_EXPORT'});process.stdout.write('OK\\n')},fail).catch(fail)`,
  dom_access: `try{const f=require('node:fs');const p='/opt/worker/dom.mjs';f.accessSync(p,f.constants.R_OK);if(!f.statSync(p).isFile())throw Error();process.stdout.write('OK\\n')}catch(e){fail(e)}`,
  dom_import: `import('/opt/worker/dom.mjs').then(m=>{if(typeof m.collectRenderedDocument!=='function')return fail({code:'MISSING_EXPORT'});process.stdout.write('OK\\n')},fail).catch(fail)`,
  broker_socket: `const n=require('node:net');const s=n.connect('/run/scanvoro/broker.sock');s.on('data',d=>{if(d.toString()==='PONG\\n')process.stdout.write('OK\\n');else fail({code:'PROTOCOL'});s.end()});s.on('error',fail)`,
  network_denial: `const n=require('node:net');(async()=>{for(const h of ['93.184.216.34','10.0.0.1','169.254.169.254','127.0.0.1','::1'])await new Promise((yes,no)=>{const s=n.connect({host:h,port:443});s.setTimeout(500,()=>{s.destroy();no(new Error())});s.once('connect',()=>{s.destroy();no(new Error())});s.once('error',e=>e.code==='EPERM'||e.code==='EACCES'?yes():no(e))});const v=require('node:fs').readFileSync('/proc/self/status','utf8');if(!/^NoNewPrivs:\\s+1$/m.test(v)||!/^Seccomp:\\s+2$/m.test(v)||process.getuid()===0)throw Error();process.stdout.write('OK\\n')})().catch(fail)`,
  chromium_sandbox: `(async()=>{
    let b,c;
    try {
      atStage('module_import');
      const {chromium}=await import('playwright-core');
      atStage('executable_check');
      const {createRequire}=await import('node:module');
      const {accessSync,constants,mkdtempSync,writeFileSync,unlinkSync,rmdirSync}=await import('node:fs');
      // Match the pinned 1.64.0 launcher's headless=true default, NOT
      // chromium.executablePath(), which points at the full browser instead.
      const {registry}=createRequire(process.cwd()+'/package.json')('playwright-core/lib/coreBundle');
      const executable=registry.registry.findExecutable('chromium-headless-shell').executablePath();
      accessSync(executable,constants.R_OK|constants.X_OK);
      atStage('writable_tmp');
      for(const base of ['/tmp','/dev/shm']){
        const directory=mkdtempSync(base+'/scanvoro-bootstrap-');
        try{writeFileSync(directory+'/probe','fixture',{flag:'wx',mode:0o600});unlinkSync(directory+'/probe')}
        finally{rmdirSync(directory)}
      }
      atStage('browser_launch');
      b=await chromium.launch({chromiumSandbox:true,headless:true,timeout:10000,env:{HOME:'/tmp',TMPDIR:'/tmp',PATH:'/usr/local/bin:/usr/bin:/bin'},args:['--enable-automation','--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run']});
      atStage('context_page');
      c=await b.newContext({serviceWorkers:'block'});
      await c.newPage();
      atStage('sandbox_verify');
      const reason=await verifyBrowserSandbox(b);
      if(reason)throw Object.assign(new Error('Sandbox verification failed'),{code:'SANDBOX_VERIFICATION_FAILED',reason});
    } catch(e){fail(e)}
    finally{
      // Preserve the original meaningful error if cleanup fails too. The
      // enclosing host/container deadlines still bound a stalled close.
      atStage('cleanup');
      try{if(c)await c.close()}catch(e){fail(e)}
      try{if(b)await b.close()}catch(e){fail(e)}
    }
    if(!failed)process.stdout.write('OK\\n');
  })().catch(fail)`,
};
export function bootstrapArgs(config: LinuxWorkerConfig, name: string, directory: string, uid: number, gid: number, stage: BootstrapStage) {
  const args = workerContainerArgs(config, name, directory, uid, gid, 30);
  // Only the final program and its arguments differ; preserve the timeout wrapper.
  args.splice(-2, 2, ...(stage === "container_process" ? ["/usr/bin/true"] : ["node", "-e", `${safeError}process.on('uncaughtException',fail);process.on('unhandledRejection',fail);process.stderr.write('CWD:'+(process.cwd()==='/opt/worker'?'/opt/worker':'unverified')+'\\n');${scripts[stage]}`]));
  return args;
}

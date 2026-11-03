FROM mcr.microsoft.com/playwright:v1.64.0-noble@sha256:bc72a8df40831ded821e3cbc79c318c21b44d6e51dff9fd89ace7a8249c5b462
WORKDIR /opt/worker
# Build context is explicitly assembled from these five public source files.
# The host stages these public files under umask 077. Do not inherit 0600
# root-owned modes: the runtime uses a non-root UID (not necessarily pwuser).
COPY --chmod=0644 package.json package-lock.json ./
RUN npm ci --include=dev --ignore-scripts --no-audit --no-fund --fetch-retries=0 --fetch-timeout=30000 --registry=https://registry.npmjs.org
COPY --chmod=0644 dom.ts runtime.mjs ./
RUN node --input-type=module -e "import ts from 'typescript'; import fs from 'node:fs'; fs.writeFileSync('dom.mjs', ts.transpileModule(fs.readFileSync('dom.ts','utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText)"
USER pwuser
RUN node --input-type=module -e "import fs from 'node:fs'; for (const p of ['package.json','runtime.mjs','dom.mjs']) fs.accessSync(p,fs.constants.R_OK); const p=await import('playwright-core'); const d=await import('./dom.mjs'); if(typeof p.chromium?.launch!=='function'||typeof d.collectRenderedDocument!=='function') process.exit(1)"
# Controller supplies a bounded timeout command; no shell or external configuration.
ENTRYPOINT []

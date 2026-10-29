FROM mcr.microsoft.com/playwright:v1.64.0-noble@sha256:bc72a8df40831ded821e3cbc79c318c21b44d6e51dff9fd89ace7a8249c5b462
WORKDIR /opt/worker
# Build context is explicitly assembled from these five public source files.
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund --fetch-retries=0 --fetch-timeout=30000 --registry=https://registry.npmjs.org
COPY dom.ts runtime.mjs ./
RUN node --input-type=module -e "import ts from 'typescript'; import fs from 'node:fs'; fs.writeFileSync('dom.mjs', ts.transpileModule(fs.readFileSync('dom.ts','utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText)"
USER pwuser
# Controller supplies a bounded timeout command; no shell or external configuration.
ENTRYPOINT []

# Official v1.64.0-noble linux/amd64 manifest, resolved from Microsoft MCR.
FROM mcr.microsoft.com/playwright:v1.64.0-noble@sha256:bc72a8df40831ded821e3cbc79c318c21b44d6e51dff9fd89ace7a8249c5b462
WORKDIR /opt/prototype
COPY package.json package-lock.json ./
# Only preparation has network access. No lifecycle scripts or application deps.
RUN npm ci --ignore-scripts --no-audit --no-fund --registry=https://registry.npmjs.org --fetch-retries=0 --fetch-timeout=30000
COPY tsconfig.json extract.ts fixture-server.ts renderer.ts prototype.test.ts ./
RUN npm run build
COPY ci/container-entry.sh ci/network-check.mjs /opt/ci/
USER pwuser
ENTRYPOINT ["/bin/bash", "/opt/ci/container-entry.sh"]

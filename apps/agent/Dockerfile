# The runner as Cloudflare starts it: Node, the Claude Agent SDK, and one file.
FROM node:24-slim

WORKDIR /app

COPY package.json ./
# The SDK brings its own Claude Code program for this platform.
RUN npm install --omit=dev --no-audit --no-fund

COPY src ./src

ENV PORT=8080
EXPOSE 8080

# Claude Code keeps its state in the home folder, so it needs one it owns.
USER node

CMD ["node", "src/server.ts"]

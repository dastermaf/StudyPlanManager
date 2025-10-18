FROM node:20-alpine

WORKDIR /app

RUN npm install -g @go-task/cli

COPY package*.json ./
COPY Taskfile.yaml ./
COPY tsconfig.json ./

RUN npm ci

COPY src/ ./src/

RUN task build

RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001 && \
    chown -R appuser:nodejs /app

USER appuser

CMD ["npm", "start"]
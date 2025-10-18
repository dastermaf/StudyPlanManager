FROM node:20-alpine

WORKDIR /app

RUN npm install -g @go-task/cli

COPY package*.json ./
COPY Taskfile.yaml ./
COPY tsconfig.json ./

RUN echo "=== Проверка наличия Taskfile ===" && \
    ls -la Taskfile.yaml && \
    echo "=== Содержимое Taskfile ===" && \
    cat Taskfile.yaml && \
    echo "=== Проверка работоспособности task ===" && \
    task --list-all

RUN npm ci

COPY src/ ./src/

RUN task build

RUN addgroup -g 1001 -S nodejs && \
    adduser -S -G nodejs -u 1001 -h /home/appuser -s /sbin/nologin appuser && \
    mkdir -p /home/appuser && \
    chown -R appuser:nodejs /app /home/appuser

USER appuser

CMD ["npm", "start"]
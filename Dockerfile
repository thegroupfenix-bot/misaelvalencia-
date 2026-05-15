FROM node:20-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY glv-connect/backend/package*.json ./
RUN npm install
COPY glv-connect/backend/ .

FROM node:20-slim
WORKDIR /app
COPY --from=builder /app .
EXPOSE 3001
CMD ["node", "server.js"]

# build v2026.05.17-2
FROM node:20 AS frontend-builder
WORKDIR /frontend
COPY glv-connect/frontend/package*.json ./
RUN npm install
COPY glv-connect/frontend/ .
ENV VITE_API_URL=""
RUN npm run build

FROM node:20
WORKDIR /app
COPY glv-connect/backend/package*.json ./
RUN npm install
COPY glv-connect/backend/ .
COPY --from=frontend-builder /frontend/dist ./public
EXPOSE 8080
CMD ["node", "server.js"]

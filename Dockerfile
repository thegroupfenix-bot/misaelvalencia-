FROM node:20
WORKDIR /app
COPY glv-connect/backend/package*.json ./
RUN npm install
COPY glv-connect/backend/ .
CMD ["node", "server.js"]

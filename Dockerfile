FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --no-audit --no-fund

COPY --chown=node:node . .
RUN npm run build

USER node
EXPOSE 5000

CMD ["node", "server.js"]

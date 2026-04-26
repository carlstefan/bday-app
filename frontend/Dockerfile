FROM node:20-alpine

WORKDIR /app

COPY --chown=node:node package.json ./
RUN npm install && chown -R node:node /app

COPY --chown=node:node public/ ./public/
COPY --chown=node:node src/ ./src/
COPY --chown=node:node index.html ./
COPY --chown=node:node vite.config.js ./

USER node

EXPOSE 5173

CMD ["npm", "run", "dev"]

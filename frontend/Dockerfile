FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY --chown=node:node src/ ./src/
COPY --chown=node:node index.html ./
COPY --chown=node:node vite.config.js ./

USER node

EXPOSE 5173

CMD ["npm", "run", "dev"]

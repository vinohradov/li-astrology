FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
COPY assets/ ./assets/
RUN npm run build
RUN npm prune --omit=dev
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/index.js"]

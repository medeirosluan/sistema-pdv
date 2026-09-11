FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/desktop/package.json apps/desktop/package.json

RUN npm ci

COPY . .

RUN npm run prisma:generate --workspace apps/api
RUN npm run build --workspace apps/api

WORKDIR /app/apps/api
ENV NODE_ENV=production
EXPOSE 3000

RUN chmod +x docker-entrypoint.sh
CMD ["sh", "docker-entrypoint.sh"]

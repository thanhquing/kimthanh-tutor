FROM node:20-bookworm-slim

WORKDIR /app/tutor-api

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    openssl \
    postgresql-client \
  && rm -rf /var/lib/apt/lists/*

COPY tutor-api/package*.json ./
RUN npm ci

COPY tutor-api ./
RUN npx prisma generate && npm run build

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/main.js"]

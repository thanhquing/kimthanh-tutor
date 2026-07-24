FROM node:20-bookworm-slim

WORKDIR /app/tutor-api

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    openssl \
    postgresql-client \
  && rm -rf /var/lib/apt/lists/*

# Build context = thư mục tutor-api (xem docker-compose.yml `context: .`).
COPY package*.json ./
RUN npm ci

COPY . ./
RUN npx prisma generate && npm run build

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push --accept-data-loss && npx prisma db execute --file prisma/constraints.sql && node dist/main.js"]

# syntax=docker/dockerfile:1

FROM node:20-bookworm AS next-builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 \
    API_URL=http://127.0.0.1:8000 \
    DATABASE_URL=mysql://placeholder:placeholder@127.0.0.1:3306/railway \
    JWT_SECRET=build-time-placeholder

RUN npx prisma generate && npm run build

FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    ENVIRONMENT=production \
    API_URL=http://127.0.0.1:8000 \
    NEXT_TELEMETRY_DISABLED=1

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
  && apt-get install -y --no-install-recommends nodejs \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

COPY backend /app/backend
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

COPY --from=next-builder /app/.next/standalone ./
COPY --from=next-builder /app/.next/static ./.next/static
COPY --from=next-builder /app/public ./public

EXPOSE 3000

CMD ["/app/start.sh"]

# syntax=docker/dockerfile:1
# Railway (or any Docker host) builds this image. The base image ships the C++
# toolchain that better-sqlite3 needs when no prebuilt binary matches.
FROM node:20-bookworm

# pnpm version is pinned by "packageManager" in package.json
RUN corepack enable

WORKDIR /app

# Railway passes service variables to the Docker build as build args, but a
# Dockerfile must opt in per variable. NEXT_PUBLIC_* values are inlined into
# the bundle by Next.js at build time, so they must be present here. Secrets
# (CLIENT_SECRET, SECRET_COOKIE_PASSWORD, DATABASE_URL) stay runtime-only —
# they are injected by Railway when the container starts.
ARG NEXT_PUBLIC_DEPLOY_URL
ARG NEXT_PUBLIC_GRAPH_API_URL
ARG NEXT_PUBLIC_ADMIN_URL
ARG NEXT_PUBLIC_CLIENT_ID
ENV NEXT_PUBLIC_DEPLOY_URL=$NEXT_PUBLIC_DEPLOY_URL \
    NEXT_PUBLIC_GRAPH_API_URL=$NEXT_PUBLIC_GRAPH_API_URL \
    NEXT_PUBLIC_ADMIN_URL=$NEXT_PUBLIC_ADMIN_URL \
    NEXT_PUBLIC_CLIENT_ID=$NEXT_PUBLIC_CLIENT_ID

# Dependencies first so Docker can cache this layer.
# pnpm-workspace.yaml must come along: pnpm 10 keeps `overrides` /
# `onlyBuiltDependencies` there, and --frozen-lockfile compares them
# against the lockfile.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Sources. .dockerignore keeps node_modules/.next/.env and the Windows-built
# Prisma client out — `prisma generate` rebuilds it for Linux below.
COPY . .

# prisma generate (client output is gitignored) + next build
RUN pnpm build

ENV PORT=3000
EXPOSE 3000

# `pnpm start` = `prisma db push && next start` — keeps the SQLite schema in
# sync on the mounted volume (/data) on every boot.
CMD ["pnpm", "start"]

# LARE edge image: build the React SPA, serve it + proxy /api via nginx.
# Build context is the REPO ROOT:
#   docker build -f deploy/web.Dockerfile -t lare-web .

# ---- stage 1: build the Vite SPA ----
FROM node:20-slim AS build
WORKDIR /ui
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci || npm install
COPY frontend/ ./
# The app calls the API at the relative path /api, so no build-time API URL is
# needed — nginx serves SPA and API from the same origin.
RUN npm run build

# ---- stage 2: nginx serving the build ----
FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /ui/dist /usr/share/nginx/html
EXPOSE 80

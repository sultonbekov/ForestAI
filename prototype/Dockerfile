# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# Bog'liqliklarni o'rnatish (kesh uchun alohida qatlam)
COPY package.json package-lock.json* ./
RUN npm install

# Manba kodini nusxalash va build
COPY . .
RUN npm run build

# ---- Serve stage (nginx) ----
FROM nginx:1.27-alpine AS serve

# SPA uchun nginx konfiguratsiyasi
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Build natijasini nginx public papkasiga
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

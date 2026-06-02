# Development stage
FROM node:20-alpine AS development

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

EXPOSE 3000

# Build stage
FROM development AS builder

RUN npm run build

# Production stage
FROM nginx:alpine AS production

COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
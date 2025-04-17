FROM node:18
WORKDIR /app
COPY . .
RUN npm install
ENV PORT=8080
CMD ["node", "server_use_cookie.js"]

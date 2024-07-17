FROM node:16.18-alpine

WORKDIR /app/

COPY App-backend/package.json .
COPY App-backend/package-lock.json .

RUN npm install

COPY App-backend/ .

CMD ["node", "server.js"]

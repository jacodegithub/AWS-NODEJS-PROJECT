# gordian-orders-backend

## Pre Requisites
1. You should have node v16 or higher installed to run this server.
2. Setup MongoDB on Mongo Atlas

## Local Setup Instructions

1. Make sure you have the correct .env file for development and it has all the correct configurations.
2. `cd App-backend`
3. `npm install` will download all dependencies
4. `npm start` will run the server

## Production deployment
For production deployment, we use Docker to build and run an image of our backend server.

We use nginx as reverse proxy on an EC2 instance and certbot to generate certificates for connecting the server with a custom domain.

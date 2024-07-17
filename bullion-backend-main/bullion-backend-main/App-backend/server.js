require('rootpath')();
require("dotenv").config();
const express = require('express');
const morgan = require("morgan");
const app = express();
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const Sentry = require('@sentry/node')
const cron = require('./jobs/index');
app.use(morgan("common"));

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.ENVIRONMENT,
  integrations: []
});

const api_routes = require('./users/order');
const errorHandler = require('_middleware/error-handler');
// const order_routes = require('./users/orders_controller')
const firebase_routes = require('./users/firebaseController');
const webhook_routes = require('./users/webhook_controller');
const misc_routes = require('./routes/MiscRoutes');
const admin_routes = require('./users/adminUser.controller');
const wallet_routes = require('./users/wallet_controller');
const bullion_routes = require('./users/bullionController');
const bullionRoutesv2 = require('./users/bullionControllerv2');
const serviceability_routes = require('./controllers/serviceabilityController');
const web_notification_routes = require('./controllers/webNotificationsController');
const pushNotificationRoutes = require('./controllers/pushNotificationController');
const ReferralsController = require('./controllers/ReferralController');
const noticesController = require('./controllers/noticesController')

// Initialize the cron job handler
cron.start();

app.use(Sentry.Handlers.requestHandler());

// allow cors requests from any origin and with credentials
app.use(cors({ origin: (origin, callback) => callback(null, true), credentials: true }));

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());

app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type,Authorization");

  next();
});

app.use('/', api_routes);
// app.use("/", order_routes);
app.use("/", firebase_routes);

app.use("/", webhook_routes);
app.use("/", misc_routes);
app.use('/', admin_routes);
app.use("/", wallet_routes);
app.use("/", bullion_routes);
app.use("/api/v2/bullion/", bullionRoutesv2);
app.use("/api/v1/", serviceability_routes);
// api routes
app.use('/users', require('./users/users.controller'));
app.use('/bussinessusers', require('./users/bussinessuser.controller'));
app.use('/api/v1/notifications', web_notification_routes);
app.use('/api/v1/notifications', pushNotificationRoutes);
app.use('/api/v1/referrals/', ReferralsController);
app.use('/api/v1/notices', noticesController)


app.use(Sentry.Handlers.errorHandler({
  shouldHandleError(error) {
    if (error.status >= 400) {
      return true;
    }
    return false;
  }
}));

// global error handler
app.use(errorHandler);

// start server
const port = process.env.USER_PORT
app.listen(port, () => {
  console.log('Server listening on port ' + port);
});

const { createLogger, format, transports } = require("winston");
const {  combine, label, json } = format;
require("winston-daily-rotate-file");

const CATEGORY = "Log Rotation";

//DailyRotateFile func()
const fileRotateTransport = new transports.DailyRotateFile({
  filename: "logs/%DATE%.log",
  format: combine(
    format.timestamp({ format: "MMM-DD-YYYY HH:mm:ss" }),
    format.align(),
    format.printf((info) => `${info.level}: ${[info.timestamp]}: ${info.message}`)
  ),
  datePattern: "YYYY-MM-DD",
  maxFiles: "14d",
});

const logger = createLogger({
  level: "debug",
  format: combine(
    format.timestamp({ format: "MMM-DD-YYYY HH:mm:ss" }),
    format.align(),
    format.printf((info) => `${info.level}: ${[info.timestamp]}: ${info.message}`)
  ),
  transports: [fileRotateTransport, new transports.Console()],
});

module.exports = logger;

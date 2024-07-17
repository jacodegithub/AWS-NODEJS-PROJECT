const { parentPort } = require('worker_threads')
const notificationService = require('../services/PushNotificationService')
const bullionService = require('../services/BullionService')
const userService = new (require('../users/UserService'))()
const Enums = require('../_helpers/Enums')
const logger = require('../_helpers/logger')
require('dotenv').config()
const mongoose = require('mongoose')
const { isServiceable } = require('../_middleware/utils')
const io = require('socket.io-client');

(async () => {
  try {
    await connectDb()

    const isBullionUp = await isBullionServiceable()

    if (isBullionUp) {
      const userIds = await userService.find({ role: Enums.Roles.Bussiness }, { _id: 1 })
      const userIdList = userIds.map((user) => user._id)

      const items = await bullionService.getItems()
      const bullionItems = items.filter((item) => item.type === 'bullion')

      const notification = await createNotificationMessage(bullionItems)
      if (notification) {
        logger.info(JSON.stringify(notification))
        await notificationService.sendNotifications(userIdList, notification)
      }
    }

    if (parentPort) parentPort.postMessage('done')
    else process.exit(0)
  } catch (error) {
    console.error(error)
    cancel()
  }
})()

function getCheapestQuote(item, traderQuotes) {
  let cheapestQuote
  for (let i = 0; i < traderQuotes.length; i++) {
    const currentQuote = traderQuotes[i]
    if (cheapestQuote) {
      if ((currentQuote.quote && currentQuote.quote !== 0) && getStandardizedPrice(currentQuote, item) < getStandardizedPrice(cheapestQuote, item)) {
        cheapestQuote = currentQuote
      }
    } else {
      if (currentQuote.quote && currentQuote.quote !== 0) { cheapestQuote = currentQuote }
    }
  }

  return cheapestQuote
}

function getStandardizedPrice(traderQuote, item) {
  const { quote, quoteUnitInGram } = traderQuote
  return ((quote * item.baseTradingWeightInGram) / quoteUnitInGram)
}

async function connectDb() {
  const connectionOptions = { useCreateIndex: true, useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false }
  mongoose.connect(process.env.MONGO_URL, connectionOptions)

  mongoose.connection.on('connected', () => {
    console.log('cron Database is connected')
  })
}

async function fetchQuoteForItemFromSocket(item) {
  const socket = io(process.env.RATESERVER_URL,
    { path: '/socket.io' })

  try {
    await new Promise((resolve, reject) => {

      const timeoutId = setTimeout(() => {
        socket.close()
        reject(new Error('Socket connection timeout'))
      }, 10000)

      socket.on('connect', () => {
        clearTimeout(timeoutId)
        resolve()
      })

      socket.on('connect_error', (error) => {
        reject(error)
      })
    })

    socket.emit('subscribe', item.exchangeTradingSymbol)

    let quotes

    await new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        socket.close()
        reject(new Error('Data reception timeout'))
      }, 10000)

      socket.on(item.exchangeTradingSymbol, (receivedData) => {
        quotes = receivedData
        socket.close()
        clearTimeout(timeoutId)
        resolve()
      })
    })

    return quotes
  } catch (error) {
    console.error('Error:', error.message)
    throw error
  } finally {
    socket.close()
  }
}

function cancel() {
  if (parentPort) {
    parentPort.postMessage('Cancelling job because of error')
    process.exit(0)
  } else process.exit(0)
}

async function createNotificationMessage(bullionItems) {
  const now = new Date()
  const hours = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })

  const cheapestQuotes = await getCheapestQuotes(bullionItems)

  const notificationTitle = buildNotificationTitle(cheapestQuotes)
  const notificationBody = 'Lowest live rates ➡️ ' + hours + ' | Tap to check now 📊'

  if (notificationTitle.length > 0) {
    return { title: notificationTitle, body: notificationBody }
  }
  return null
}

async function getCheapestQuotes(bullionItems) {
  const cheapestQuotes = []
  for (let i = 0; i < bullionItems.length; i++) {
    const item = bullionItems[i]
    const traderQuotes = await fetchQuoteForItemFromSocket(item)
    const cheapestQuote = getCheapestQuote(item, traderQuotes)
    cheapestQuotes.push({
      item,
      traderQuote: cheapestQuote
    })
  }
  return cheapestQuotes
}

function buildNotificationTitle(cheapestQuotes) {
  let title = ''
  for (let i = 0; i < cheapestQuotes.length; i++) {
    const quote = cheapestQuotes[i]
    if (quote.traderQuote) {
      title += quote.item.name + ': ' + '₹' + (quote.traderQuote.quote * quote.traderQuote.baseTradingWeightInGram / quote.traderQuote.quoteUnitInGram) + ' | '
    }
  }
  return title
}

async function isBullionServiceable() {
  const isBullionUp = await isServiceable('bullion')
  return isBullionUp
}

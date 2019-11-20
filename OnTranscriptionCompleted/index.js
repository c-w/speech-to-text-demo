const Main = require('./main')
const process = require('process')

module.exports = async function (context, req) {
  const main = new Main({
    webhookSecret: process.env.WEBHOOK_SECRET,
    log: context.log
  })

  await main.run({ headers: req.headers, body: req.body })
}

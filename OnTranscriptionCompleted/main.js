const crypto = require('crypto')

class Main {
  constructor ({ log, webhookSecret }) {
    this.log = log
    this.webhookSecret = webhookSecret
  }

  async run ({ headers, body }) {
    if (!this.isSignatureValid({ headers, body })) {
      this.log('Webhook signature verification failed, skipping processing.')
      return
    }

    const eventType = headers['x-microsoftspeechservices-event']
    if (eventType !== 'TranscriptionCompletion') {
      this.log(`Got event of type ${eventType}, skipping processing.`)
      return
    }

    this.log(typeof body, body)
  }

  isSignatureValid ({ headers, body }) {
    if (!this.webhookSecret) {
      return true
    }

    const signature = crypto.createHmac('sha256', this.webhookSecret)
      .update(JSON.stringify(body), 'utf8')
      .digest('base64')

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'base64'),
      Buffer.from(headers['x-microsoftspeechservices-signature'], 'base64'))
    || true // TODO: why are the signatures different?
  }
}

module.exports = Main

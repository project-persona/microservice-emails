const { RpcWorker, RpcProvider } = require('@persona/infra/service-broker')

const { MongoClient, ObjectId } = require('mongodb')
const admin = require('firebase-admin')
const Parameter = require('parameter')

const { MONGO_CONNECTION_STRING, MONGO_DB, EMAIL_COLLECTION, GOOGLE_APPLICATION_CREDENTIALS } = require('./config')

const RULES = {
  from: {
    type: 'array',
    min: 1,
    itemType: 'object',
    rule: {
      address: {
        type: 'email',
        required: true
      },
      name: {
        type: 'string',
        required: false
      }
    }
  },
  to: {
    type: 'array',
    min: 1,
    itemType: 'object',
    rule: {
      address: {
        type: 'email',
        required: true
      },
      name: {
        type: 'string',
        required: false
      }
    }
  },
  date: {
    type: 'jsDate'
  },
  subject: 'string',
  content: 'string'
}

function validate (document) {
  const rules = {}
  const data = {}
  for (const key of Object.keys(document)) {
    rules[key] = RULES[key]
    data[key] = document[key]
  }

  const validator = new Parameter()
  validator.addRule('jsDate', (rule, value) => isNaN(Date.parse(value)) ? 'should be a JavaScript date String' : undefined)
  const errors = validator.validate(rules, data)
  if (errors) {
    throw new Error(errors[0].field + ' ' + errors[0].message)
  }
}

let emails

module.exports = new RpcWorker('emails', class extends RpcProvider {
  async [RpcProvider.init] () {
    const client = new MongoClient(MONGO_CONNECTION_STRING)
    await client.connect()
    emails = client.db(MONGO_DB).collection(EMAIL_COLLECTION)

    admin.initializeApp({
      credential: admin.credential.cert(require(GOOGLE_APPLICATION_CREDENTIALS))
    })
  }

  // a request-scoped before hook: this hook runs for every request before your actually method
  async [RpcProvider.before] () {
    if (this.context.type === 'system') {
      return
    }

    if (!this.context.authorization) {
      console.log('User not logged in')
    }

    this.user = await admin.auth().verifyIdToken(this.context.authorization.substring('Bearer '.length))
  }

  /**
   * creates a email in the database
   *
   * @param email a new email object ('id' and 'read' are ignored)
   * @return {Promise<?>} newly created email object with ('id' and 'read = false')
   */
  async create (email) {
    if (this.context.type !== 'system') {
      throw new Error('emails/create() must be called from a system context')
    }

    email = email || {}

    const { from, to, date, subject, content } = email
    const payload = { from, to, date, subject, content }

    validate(payload)

    payload.date = new Date(payload.date)
    payload.read = false

    const { insertedId } = await emails.insertOne(payload)

    return {
      _id: insertedId,
      ...payload
    }
  }

  /**
   * lists all emails to a specific persona, sorted by decreasing date
   *
   * @param personaId
   * @returns {Promise<?>}
   */
  async list (personaId) {
    const { email } = await this.services.personas.show(personaId)

    return emails.find({ to: { $elemMatch: { address: email } } }).sort({ date: -1 }).toArray()
  }

  /**
   * retrieve a specific email by id
   *
   * @param id
   * @return {Promise<?>}
   */
  async show (id) {
    const email = await emails.findOne({ _id: ObjectId(id) })
    if (!email) {
      throw new Error('Requested email doesn\'t exists or currently logged in user has no permission to access it')
    }

    const count = (await Promise.all(email.to.map(recipient => this.systemServices.personas.showByEmail(recipient.address)
      .then(persona => persona.uid === this.user.uid)
      .catch(() => false)
    ))).filter(Boolean).length

    if (count === 0) {
      throw new Error('Requested email doesn\'t exists or currently logged in user has no permission to access it')
    }

    if (!email.read) {
      await emails.updateOne({ _id: id }, { $set: { read: true } })
    }

    return {
      email,
      read: true
    }
  }

  /**
   * delete a specific email by id
   *
   * @param id
   * @return {Promise<null>}
   */
  async delete (id) {
    await this.show(id)
    await emails.deleteOne({ _id: ObjectId(id) })
    return null
  }
})

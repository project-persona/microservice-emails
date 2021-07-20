const { RpcWorker, RpcProvider } = require('@persona/infra/service-broker')

const { MongoClient } = require('mongodb')
const admin = require('firebase-admin')
const Parameter = require('parameter')

const { MONGO_CONNECTION_STRING, MONGO_DB, MONGO_COLLECTION } = require('./config')

const RULES = {
  id: {
    type: 'string',
    format: /^[0-9a-f]{24}$/ // mongodb object id,
  },
  from: [{
    address: 'email',
    name: {
      type: 'string',
      required: false
    }
  }],
  to: [{
    address: 'email',
    name: {
      type: 'string',
      required: false
    }
  }],
  date: {
    type: 'jsDate'
  },
  subject: 'string',
  content: 'string',
  read: 'boolean'
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
    emails = client.db(MONGO_DB).collection(MONGO_COLLECTION)
  }

  // a request-scoped before hook: this hook runs for every request before your actually method
  async [RpcProvider.before] () {
    if (this.context.type === 'system') {
      return
    }

    if (!this.context.authorization) {
      console.log('User not logged in')
    }

    await admin.auth().verifyIdToken(this.context.authorization)
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

    // TODO: lookup persona by email making sure one exists

    const { from, to, date, subject, content } = email
    validate({ from, to, date, subject, content })

    const { insertedId } = await emails.insertOne({ from, to, date, subject, content, read: false })
    return { _id: insertedId, from, to, date, subject, content, read: false }
  }

  /**
   * lists all emails to a specific persona
   *
   * @param personaId
   * @returns {Promise<?>}
   */
  async list (personaId) {
    // TODO: lookup persona by personaId and verify access
    // const { email } = await this.services.show(personaId)
    const email = 'foo@bar.com'

    return emails
      .find({ to: { $elemMatch: { address: email } } })
      .toArray()
  }

  /**
   * retrieve a specific email by id
   *
   * @param id
   * @return {Promise<?>}
   */
  async show (id) {
    const email = await emails.findOne({ _id: id })
    if (!email) {
      throw new Error(`Email with id = ${id} doesn't exist!`)
    }

    // TODO: lookup persona by email making sure logged in user has access to it

    await emails.updateOne({ _id: id }, { read: true })
    return email
  }

  /**
   * delete a specific email by id
   *
   * @param id
   * @return {Promise<void>}
   */
  async delete (id) {
    const email = await emails.findOne({ _id: id })
    if (!email) {
      throw new Error(`Email with id = ${id} doesn't exist!`)
    }

    // TODO: lookup persona by email making sure logged in user has access to it

    await emails.deleteOne({ _id: id })
    return null
  }
})

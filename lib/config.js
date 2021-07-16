module.exports = {
  // See https://docs.mongodb.com/manual/reference/connection-string/
  MONGO_CONNECTION_STRING: process.env.MONGO_CONNECTION_STRING || 'mongodb://localhost:27017',
  MONGO_DB: process.env.MONGO_DB || 'persona',
  MONGO_COLLECTION: process.env.MONGO_TABLE || 'emails'
}

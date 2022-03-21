const mongoose = require('mongoose')

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/A2api'

mongoose.connect(mongoURI, {});

module.exports = { mongoose }
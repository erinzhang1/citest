const mongoose = require('mongoose')

const timeSeriesSchema = new mongoose.Schema({
    name: String,
    country: String,
    regions: String,
    date: Date,
    deaths: Number,
    confirmed: Number,
    recovered: Number,
})

const TimeSeries = mongoose.model('time_series', timeSeriesSchema)
module.exports = { TimeSeries }
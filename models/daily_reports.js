const mongoose = require('mongoose')

const dailyreportsSchema = new mongoose.Schema({
    dailyreport_name: String,
    Province_State: String,
    Country_Region: String,
    date: Date,
    Last_Update: String,
    confirmed: Number,
    deaths: Number,
    recovered: Number,
    active: Number,
    Combined_Key: String
})

const DailyReports = mongoose.model('daily_reports', dailyreportsSchema)
module.exports = { DailyReports }
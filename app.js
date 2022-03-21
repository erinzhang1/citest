const log = console.log
const path = require('path')

const express = require('express')

// starting the express server
const app = express();

// mongoose and mongo connection
const { mongoose } = require('./db/mongoose')
mongoose.set('bufferCommands', false);

// import the mongoose models
const { TimeSeries } = require("./models/time_series");
const { DailyReports } = require("./models/daily_reports")

// to validate object IDs
const { ObjectID } = require('mongodb')

const bodyParser = require('body-parser');
const { getSystemErrorMap } = require('util');

// checks for first error returned by promise rejection if Mongo database suddently disconnects
function isMongoError(error) {
	return typeof error === 'object' && error !== null && error.name === "MongoNetworkError"
}

// middleware to set timeout
app.use(function (req, res, next) {
	req.setTimeout(5000);
	res.setTimeout(5000);
	next();
});

// middleware for parsing raw text buffer data into string(text)
const rawdataParser = (req, res, next) => {
	var data = "";
	req.on('data', function (chunk) { data += chunk })
	req.on('end', function () {
		req.rawBody = data;
		next();
	})
}

// middleware for mongo connection error for routes that need it
// const mongoChecker = (req, res, next) => {
//     // check mongoose connection established.
//     if (mongoose.connection.readyState != 1) {
//         log('Issue with mongoose connection')
//         res.status(500).send('Internal server error')
//         return;
//     } else {
//         next()  
//     }   
// }

// upload or update a dailyreport
app.post('/daily_reports/:dailyreport_name', rawdataParser, async (req, res) => {

	// check mongoose connection established.
	if (mongoose.connection.readyState != 1) {
		log('Issue with mongoose connection')
		res.status(500).send('Internal server error')
		return;
	}

	const dailyreport_name = req.params.dailyreport_name

	// check name
	if (dailyreport_name === "") {
		res.status(422).send("Invalid file contents")
		return
	}

	const body = req.rawBody

	// use python to read csv, get a Object
	const spawn = require('child_process').spawn;
	const ls = spawn('python', ['./python/daily_reports.py', body]);

	ls.stdout.on('data', (data) => {
		// TODO: need to consider python err
		const output = data.toString()
		if (output === "error\r\n") {
			res.status(422).send("Invalid file contents")
			return
        }
		const arr = JSON.parse(output)

		let error = undefined
		arr.forEach(async ele => {
			try {
				const new_info = {
					dailyreport_name: dailyreport_name,
					Province_State: ele.Province_State,
					Country_Region: ele.Country_Region,
					date: new Date(ele.date),
					Last_Update: ele.Last_Update,
					confirmed: ele.Confirmed,
					deaths: ele.Deaths,
					recovered: ele.Recovered,
					active: ele.Active,
					Combined_Key: ele.Combined_Key
				}
				if (new_info.Province_State === "" || new_info.Country_Region === "" || new_info.Last_Update === "") {
					res.status(422).send("Invalid file contents")
					error = 422
					return
				}
				const update_doc = await DailyReports.findOneAndReplace(
					{ dailyreport_name: dailyreport_name, Province_State: new_info.Province_State, Country_Region: new_info.Country_Region, date: new_info.date },
					new_info,
					{ new: true, useFindAndModify: false })
				if (!update_doc) {
					const new_daily_report = new DailyReports(new_info)
					await new_daily_report.save()
				}
			} catch (err) {
				log(err)
				if (isMongoError(err)) {
					res.status(500).send('Internal server error')
					error = 500
				} else {
					res.status(400).send("Malformed request")
					error = 400
				}
				return
			}
		})
		if (!error) {
			res.status(200).send("Upload successful")
		}
	});
})

// retrieve a report
app.get('/daily_reports/:dailyreport_name', bodyParser.json(), async (req, res) => {
	// check mongoose connection established.
	if (mongoose.connection.readyState != 1) {
		log('Issue with mongoose connection')
		res.status(500).send('Internal server error')
		return;
	}

	const dailyreport_name = req.params.dailyreport_name

	const start_date = req.query.start_date
	const end_date = req.query.end_date
	const countries = req.query.countries
	const regions = req.query.regions
	const combined_key = req.query.combined_key
	if(!req.query.data_type) {
		req.query.data_type = 'active,confirmed,deaths,recovered'
	} else {
		const temperrorcheck = req.query.data_type.split(',').every(ele => {
			return ['active', 'confirmed', 'deaths', 'recovered'].includes(ele)
		})

		if (!temperrorcheck) {
			res.status(400).send("Malformed request")
			return
		}
	}
	if(!req.query.format){
		req.query.format = 'csv'
	}
	const format = req.query.format

	// console.log(query)

	try {
		// deal with input data
		const data_type = req.query.data_type.split(',')
		const countries_query = countries ? { Country_Region: { $in: countries.split(',') } } : {}
		const regions_query = regions ? { Province_State: { $in: regions.split(',') } } : {}
		const combinedKey_query = combined_key ? { combined_key: combined_key } : {}
		const start_query = start_date ? { date: { $gte: new Date(req.query.start_date) } } : {}
		const end_query = end_date ? { date: { $lte: new Date(req.query.end_date) } } : {}
		const name_query = { dailyreport_name: dailyreport_name }

		const query = {
			$and: [
				countries_query,
				regions_query,
				combinedKey_query,
				start_query,
				end_query,
				name_query
			]
		}
		// find from database
		const daily_reports = await DailyReports.find(query)

		// console.log(daily_reports)
		// if no data find, send 404 error
		if (daily_reports.length === 0) {
			res.status(404).send("No data was found with given condition")
			return
		}
		// get sum of all report data
		let report_result = {}
		daily_reports.forEach((report) => {
			data_type.forEach((type) => {
				if (report_result[type] !== undefined) {
					report_result[type] += report[type]
				} else {
					report_result[type] = report[type]
				}
			})
		})
		if (format === "json") {
			// get return value in json format
			res.status(200).send(report_result)
		} else if (format === 'csv') {
			// get return value in csv format
			let header = ""
			let return_value = ""
			data_type.forEach((type) => {
				if (type !== data_type[data_type.length - 1]) {
					header += type + ","
					return_value += report_result[type] + ","
				} else {
					header += type
					return_value += report_result[type]
				}
			})
			let result = header + "\r\n" + return_value
			res.status(200).send(result)
		} else {
			res.status(400).send("Malformed request")
        }
	} catch (err) {
		log(err)
		if (isMongoError(err)) {
			res.status(500).send('Internal server error')
		} else {
			res.status(400).send("Malformed request")
		}
	}
})

// delete a daily report
app.delete('/daily_reports/:dailyreport_name', async (req, res) => {
	// check mongoose connection established.
	if (mongoose.connection.readyState != 1) {
		log('Issue with mongoose connection')
		res.status(500).send('Internal server error')
		return;
	}

	const dailyreport_name = req.params.dailyreport_name

	try {
		const remove_item = await DailyReports.deleteMany({ dailyreport_name: dailyreport_name })
		// send 404 if no item was removed
		if (remove_item.deletedCount === 0) {
			res.status(404).send("Dailyreports not found")
		} else {
			res.status(200).send("Sucessfully deleted")
		}
	} catch (err) {
		log(err)
		if (isMongoError(err)) {
			res.status(500).send('Internal server error')
		} else {
			res.status(400).send("Malformed request")
		}
	}
})

// upload or update a time series report
app.post('/time_series/:timeseries_name/:data_type', rawdataParser, async (req, res) => {

	// if (mongoose.connection.readyState != 1) {
	// 	log('Issue with mongoose connection')
	// 	res.status(500).send('Internal server error')
	// 	return;
	// }

	// Params
	const timeseries_name = req.params.timeseries_name
	const data_type = req.params.data_type
	if (!['deaths', 'confirmed', 'recovered'].includes(data_type)) {
		console.log(data_type)
		res.status(400).send("Invalid data type")
		return
	}

	// Bodies
	const scsv = req.rawBody
	// console.log(scsv)

	const spawn = require('child_process').spawn;
	const ls = spawn('python', ['./python/time_series.py', scsv]);

	ls.stdout.on('data', async (data) => {
		const output = data.toString()
		// console.log(JSON.stringify(output))
		if (output === "error\r\n"){
			res.status(422).send("Invalid file contents")
			return
		}

		// console.log(output)
		const arr = JSON.parse(output)

		await Promise.all(arr.map(async ele => {
			// console.log(ele)
			const query = {
				'name': timeseries_name,
				'country': ele.country,
				'regions': ele.province,
				'date': new Date(ele.date),
			}
			const newData = { $set: { [data_type]: ele.val } }
			const options = { upsert: true }
			// console.log(query)
			// console.log(newData)
			try {
				await TimeSeries.findOneAndUpdate(query, newData, options)
			} catch (error) {
				console.log(error);
				res.status(500).send()
				return
			}
		}))
		res.send("Upload successful")
	});
})

app.get('/time_series/:timeseries_name/:data_type', async (req, res) => {

	// if (mongoose.connection.readyState != 1) {
	// 	log('Issue with mongoose connection')
	// 	res.status(500).send('Internal server error')
	// 	return;
	// }

	// Params
	const timeseries_name = req.params.timeseries_name
	const data_type = req.params.data_type

	const start_date = req.query.start_date
	const end_date = req.query.end_date
	const countries = req.query.countries
	const regions = req.query.regions
	if (!req.query.format) {
		req.query.format = 'csv'
	} else {
		if (req.query.format !== 'csv' && req.query.format !== 'json'){
			res.status(400).send("Invalid format type")
			return
		}
	}
	const format = req.query.format

	if (!['deaths', 'confirmed', 'recovered', 'active'].includes(data_type)) {
		console.log(data_type)
		res.status(400).send("Malformed request")
		return
	}

	const countries_query = countries ? { country: { $in: countries.split(',') } } : {}
	const regions_query = regions ? { regions: { $in: regions.split(',') } } : {}
	const start_query = start_date ? { date: { $gte: new Date(start_date) } } : {}
	const end_query = end_date ? { date: { $lte: new Date(end_date) } } : {}
	const name_query = { name: timeseries_name }

	const query = { $and: [
		countries_query,
		regions_query,
		start_query, 
		end_query,
		name_query
	] }


	try {
		// find from database
		const time_series = await TimeSeries.find(query).sort( { date: 1 } )
		if (time_series.length === 0) {
			res.status(404).send("No data was found with given condition")
			return
		}
		const report_result = {}
		const date_list = []
		time_series.forEach((report) => {
			const date_string = report.date.toLocaleDateString("en-US")
			if(!date_list.includes(date_string)){
				date_list.push(date_string)
			}
			if (!report_result[[report['regions'], report['country']]]){
				report_result[[report['regions'], report['country']]] = []
			}
			if(data_type === 'active'){
				if (report['deaths'] === undefined || report['confirmed'] === undefined || report['recovered'] === undefined ) {
					res.status(422).send()
					return
				} else {
					report_result[[report['regions'], report['country']]].push(report['confirmed'] - report['deaths'] - report['recovered'])
				}
			} else {
				if (report[data_type] === undefined){
					res.status(422).send()
					// console.log(report)
					return
				} else {
					report_result[[report['regions'], report['country']]].push(report[data_type])
				}	
			}
			// console.log(report)
			// console.log(report_result)
		})
		if (format === 'csv') {
			const header = ['Province/State','Country/Region']
			header.push(...date_list)
			const body = []
			for (const [key, value] of Object.entries(report_result)) {
				// console.log(key, value)
				const prov = key.split(',')[0]
				const country = key.split(',')[1]
				const temp = [prov, country]
				temp.push(...value)
				body.push(temp.join(','))
			}
			// console.log(body)
			const result = header.join(',') + '\r\n' + body.join('\r\n')
			res.status(200).send(result)
			return
		} else {
			result = {}
			// console.log(report_result)
			for (const [key, value] of Object.entries(report_result)) {
				// console.log(key, value)
				const prov = key.split(',')[0]
				const country = key.split(',')[1]
				const temp = value.map(function(e, i) {
					return {[date_list[i]]: e}
				})
				// console.log(temp)
				result[[prov, country]] = temp
			}
			res.status(200).send(result)
			return
		}
		// console.log(report_result)
		// console.log(date_list)

	} catch (err) {
		log(err)
		if (isMongoError(err)) {
			res.status(500).send('Internal server error')
		} else {
			res.status(400).send("Malformed request")
		}
    }
})

app.delete('/time_series/:timeseries_name', async (req, res) => {
	// check mongoose connection established.
	if (mongoose.connection.readyState != 1) {
		log('Issue with mongoose connection')
		res.status(500).send('Internal server error')
		return;
	}

	const timeseries_name = req.params.timeseries_name

	try {
		const remove_item = await TimeSeries.deleteMany({ name: timeseries_name })
		// send 404 if no item was removed
		if (remove_item.deletedCount === 0) {
			res.status(404).send("Time Series not found")
		} else {
			res.status(200).send("Sucessfully deleted")
		}
	} catch (err) {
		log(err)
		if (isMongoError(err)) {
			res.status(500).send('Internal server error')
		} else {
			res.status(400).send("Malformed request")
		}
	}
})

module.exports = app;
const request = require("supertest");
const app = require("./app");
const { MongoClient } = require('mongodb');

async function testDailyReportPost(name, body, expectStatus, expectOutput) {
    const url = '/daily_reports/' + name

    const headers = {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json'
    }

    const res = await request(app).post(url).set(headers).send(body)

    expect(res.status).toBe(expectStatus);
    expect(res.text).toEqual(expectOutput);
}

async function testDailyReportGet(name, body, expectStatus, expectOutput) {
    const url = '/daily_reports/' + name
    const res = await request(app).get(url).query(body)

    expect(res.status).toBe(expectStatus);
    expect(res.text).toEqual(expectOutput);
}

async function testDailyReportDelete(name, expectStatus, expectOutput) {
    const url = '/daily_reports/' + name
    const res = await request(app).delete(url)

    expect(res.status).toBe(expectStatus);
    expect(res.text).toEqual(expectOutput);
}


// post test data
let normalPostBody = 'FIPS,Admin2,Province_State,Country_Region,Last_Update,Lat,Long_,Confirmed,Deaths,Recovered,Active,Combined_Key,Incidence_Rate,Case-Fatality_Ratio\r\n' + 
    '45001,Abbeville,South Carolina,US,2020-06-06 02:33:00,34.22333378,-82.46170658,47,0,0,47,"Abbeville, South Carolina, US",191.625555510254,0.0\r\n' +
    '22001,Acadia,Louisiana,US,2020-06-06 02:33:00,30.2950649,-92.41419698,467,26,0,441,"Acadia, Louisiana, US",752.6795068095737,5.56745182012848'
let updatePostBody = "FIPS,Admin2,Province_State,Country_Region,Last_Update,Lat,Long_,Confirmed,Deaths,Recovered,Active,Combined_Key,Incidence_Rate,Case-Fatality_Ratio\r\n" +
    '45001,Abbeville,South Carolina,US,2020-06-06 02:33:00,34.22333378,-82.46170658,50,0,0,50,"Abbeville, South Carolina, US",191.625555510254,0.0'
let wrongPostBody = ""

// get test data
let noDataInput = {
    "start_date": "2023-01-01",
    "end_date": "2022-09-09",
    "countries": "US,Canada",
    "regions": "South Carolina",
    "combined_key": "Abbeville, South Carolina, US",
    "data_type": "deaths,confirmed,active,recovered",
    "format": "csv"
}
let wrongFormat = {
    "start_date": "2000-01-01",
    "end_date": "2022-09-09",
    "countries": "US,Canada",
    "regions": "South Carolina",
    "combined_key": "Abbeville, South Carolina, US",
    "data_type": "death,confirm,active,recover",
    "format": "csv"}
let normalDataCsv = {
    "start_date": "2000-01-01",
    "end_date": "2022-09-09",
    "countries": "US,Canada",
    "regions": "South Carolina",
    "combined_key": "Abbeville, South Carolina, US",
    "data_type": "deaths,confirmed,active,recovered",
    "format": "csv"
}
let normalCsvExcept = "deaths,confirmed,active,recovered\r\n0,50,50,0"


describe('Daily Reports get test', () => {
    let connection;

    beforeAll(async () => {
        connection = await MongoClient.connect('mongodb://localhost:27017/A2api', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        db = await connection.db("A2api");
    });
    // post test
    test('post normal data', async () => { await testDailyReportPost("dailyreport_name_1", normalPostBody, 200, "Upload successful") })
    test('post update input', async () => { await testDailyReportPost("dailyreport_name_1", updatePostBody, 200, "Upload successful") })
    test('post wrong format', async () => { await testDailyReportPost("dailyreport_name_1", wrongPostBody, 422, "Invalid file contents") })
    // get test
    test('get normal data', async () => { await testDailyReportGet("dailyreport_name_1", normalDataCsv, 200, normalCsvExcept) })
    test('get no data input', async () => { await testDailyReportGet("dailyreport_name_1", noDataInput, 404, "No data was found with given condition") })
    test('get wrong format', async () => { await testDailyReportGet("dailyreport_name_1", wrongFormat, 400, "Malformed request") })
    // delete test
    test('delete exist', async () => { await testDailyReportDelete("dailyreport_name_1", 200, "Sucessfully deleted") })
    test('delete not exist', async () => { await testDailyReportDelete("11111", 404, "Dailyreports not found") })

    afterAll(async () => {
        await connection.close();
    });
})
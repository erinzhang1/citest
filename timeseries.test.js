const request = require("supertest");
const app = require("./app");
const { MongoClient } = require('mongodb');

async function testTimeSeriesPost(timeseries_name, data_type, body, expectStatus, expectOutput) {
    const url = `/time_series/${timeseries_name}/${data_type}`

    const headers = {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json'
    }

    const res = await request(app).post(url).set(headers).send(body)

    expect(res.status).toBe(expectStatus);
    expect(res.text).toEqual(expectOutput);
}

async function testTimeSeriesGet(timeseries_name, data_type, query, expectStatus, expectOutput) {
    const url = `/time_series/${timeseries_name}/${data_type}` + query
    const res = await request(app).get(url)

    expect(res.status).toBe(expectStatus);
    expect(res.text).toEqual(expectOutput);
}

async function testTimeSeriesDelete(timeseries_name, expectStatus, expectOutput) {
    const url = `/time_series/${timeseries_name}`
    const res = await request(app).delete(url)

    expect(res.status).toBe(expectStatus);
    expect(res.text).toEqual(expectOutput);
}


// post test data
let normalPostBody = 'Province/State,Country/Region,Lat,Long,1/22/20,1/23/20,1/24/20\r\n' + 
    ',Afghanistan,33.93911,67.709953,1,2,3\r\n' + 
    ',Canada,32,32,0,0,1'
let updatePostBody = 'Province/State,Country/Region,Lat,Long,1/22/20,1/23/20,1/24/20,1/26/20\r\n' + 
    ',Afghanistan,33.93911,67.709953,1,2,3,9\r\n' + 
    ',Canada,32,32,0,0,1,2'
let wrongPostBody = 'Province/StateCountry/Region,Lat,Long,1/22/20,1/23/20,1/24/20,1/26/20\r\n' + 
    ',Afghanistan,33.93911,67.709953,1,2,3,9\r\n'

// get test data
let getAll = 'Province/State,Country/Region,1/22/2020,1/23/2020,1/24/2020,1/26/2020\r\n' + 
    ',Afghanistan,1,2,3,9\r\n' + 
    ',Canada,0,0,1,2'
let getCanada = 'Province/State,Country/Region,1/22/2020,1/23/2020,1/24/2020,1/26/2020\r\n' + 
    ',Canada,0,0,1,2'
let getMidDate = 'Province/State,Country/Region,1/23/2020,1/24/2020\r\n' + 
    ',Afghanistan,2,3\r\n' + 
    ',Canada,0,1'


describe('Time Series get test', () => {
    let connection;

    beforeAll(async () => {
        connection = await MongoClient.connect('mongodb://localhost:27017/A2api', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        db = await connection.db("A2api");
    });
    // post test
    test('post normal data', async () => { await testTimeSeriesPost("timeseries_name_1", 'deaths', normalPostBody, 200, "Upload successful") })
    test('post update input', async () => { await testTimeSeriesPost("timeseries_name_1", 'deaths', updatePostBody, 200, "Upload successful") })
    test('post data type', async () => { await testTimeSeriesPost("timeseries_name_1", 'death', updatePostBody, 400, "Invalid data type") })
    test('post wrong data', async () => { await testTimeSeriesPost("timeseries_name_1", 'deaths', wrongPostBody, 422, "Invalid file contents") })

    // get test
    test('get all data', async () => { await testTimeSeriesGet("timeseries_name_1", 'deaths', '', 200, getAll) })
    test('get country data', async () => { await testTimeSeriesGet("timeseries_name_1", 'deaths', '?countries=Canada', 200, getCanada) })
    test('get date data', async () => { await testTimeSeriesGet("timeseries_name_1", 'deaths', '?start_date=1/23/20&end_date=1/24/20', 200, getMidDate) })
    test('get wrong data', async () => { await testTimeSeriesGet("timeseries_name_1", 'death', '', 400, "Malformed request") })
    
    // delete test
    test('delete exist', async () => { await testTimeSeriesDelete("timeseries_name_1", 200, "Sucessfully deleted") })
    test('delete not exist', async () => { await testTimeSeriesDelete("11111", 404, "Time Series not found") })

    afterAll(async () => {
        await connection.close();
    });
})
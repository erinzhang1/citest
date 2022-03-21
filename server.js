'use strict';
const app = require("./app");
const log = console.log

const port = process.env.PORT || 5000
app.listen(port, () => {
	log(`Listening on port ${port}...`)
})
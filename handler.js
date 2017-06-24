'use strict';



var AWS = require('aws-sdk');
const fh = new AWS.Firehose();

module.exports.tracker = (event, context, callback) => {
	console.log(event);
	let data = {
		ip: event.requestContext.identity.sourceIp,
		path: event.requestContext.path,
		referer: event.headers['Referer'],
		agent: event.headers['User-Agent'],
		accept: event.headers['Accept'],
		language: event.headers['Accept-Language'],
		encoding: event.headers['Accept-Encoding'],
		country: event.headers['CloudFront-Viewer-Country'],
		params: event.queryStringParameters,
	};
	if (event.headers['CloudFront-Is-Desktop-Viewer']) {
		data['device'] = 'desktop'
	} else if (event.headers['CloudFront-Is-Mobile-Viewer']) {
		data['device'] = 'mobile'
	} else {
		data['device'] = 'other'
	}
	// split cookie header
	if (event.headers['Cookie']) {
		data.cookies = event.headers['Cookie'].split(';').map((x) => {
			return x.trim().split(/(=)/);
		}).reduce(
			(a, b) => { a[b[0]] = b.slice(2).join('').replace(/^"(.*)"$/, '$1'); return a; }, {}
			)

	}
	data['@timestamp'] = new Date().toISOString();
	var jsonDoc = JSON.stringify(data);
	console.log(data);
	const response = {
		statusCode: 200,
		headers: {
			'Content-Type': 'image/gif',
			'Cache-Control' : 'no-cache'
		},
		body: "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
		isBase64Encoded: true
	};

	fh.putRecord({
		DeliveryStreamName: process.env.STREAM_NAME,
		Record: { Data: jsonDoc }
	}).promise().then(data => {
		console.log(data);
		if (data.RecordId) {
			response.headers['RecordId'] = data.RecordId;
		}
	}).catch(error => {
		console.log(error);
	}).then(() => callback(null, response));
};

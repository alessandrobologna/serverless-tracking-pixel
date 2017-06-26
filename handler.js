'use strict';

const AWS = require('aws-sdk');
const uuidv4 = require('uuid/v4');
const crypto = require('crypto');
const fh = new AWS.Firehose();
const kms = new AWS.KMS();

module.exports.tracker = (event, context, callback) => {
	console.info("Event", event);
	let response = {
		statusCode: 200,
		headers: {
			'Content-Type': 'image/gif',
			'Cache-Control' : 'no-cache'
		},
		body: "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
		isBase64Encoded: true
	};
	let requestData = {
		ip: event.requestContext.identity.sourceIp,
		path: event.requestContext.path,
		referer: event.headers['Referer'],
		agent: event.headers['User-Agent'],
		accept: event.headers['Accept'],
		language: event.headers['Accept-Language'],
		encoding: event.headers['Accept-Encoding'],
		country: event.headers['CloudFront-Viewer-Country'],
		params: event.queryStringParameters,
		cookies: {}
	};
	if (event.headers['CloudFront-Is-Desktop-Viewer']) {
		requestData['device'] = 'desktop'
	} else if (event.headers['CloudFront-Is-Mobile-Viewer']) {
		requestData['device'] = 'mobile'
	} else {
		requestData['device'] = 'other'
	}
	// split cookie header
	if (event.headers['Cookie']) {
		requestData.cookies = event.headers['Cookie'].split(';').map((x) => {
			return x.trim().split(/(=)/);
		}).reduce(
			(a, b) => { a[b[0]] = b.slice(2).join('').replace(/^"(.*)"$/, '$1'); return a; }, {}
			)

	}
	
	function maybeDecrypt() {
		if (process.env.COOKIE_NAME && process.env.SIGNATURE) {
			return  kms.decrypt({
  				CiphertextBlob: Buffer(process.env.SIGNATURE, 'base64')
			}).promise() 
		} else {
			return Promise.resolve(); 
		}
	}

	// optional processing of tracking cookie
	var promise = maybeDecrypt(); 
	
	promise.then(res => {
		console.info("Res", res)
		if (res && res.Plaintext) {
			const secret = String(res.Plaintext)
			let tracking = requestData.cookies[process.env.COOKIE_NAME];
			let splitted = tracking ? tracking.split('/') : undefined;
			// function to determine if the cookie exists and is valid
			function verify(segments, secret) {
				return segments.length === 2 && (crypto.createHmac('sha256', secret).update(segments[0]).digest('hex')===segments[1]); 
			}	
			// verify the cookie
			if (!(splitted && verify(splitted,secret))) {
				// add a tracking cookie
				let uuid  = uuidv4();
				let sign = crypto.createHmac('sha256', secret).update(uuid).digest('hex');
				response.headers['Set-Cookie']=process.env.COOKIE_NAME + "=" + uuid + "/" + sign +"; path=/; HttpOnly; Secure; Max-Age=31536000";
				requestData['uuid'] = uuid;
			} else {
				requestData['uuid'] = splitted[0];
			}
			delete requestData.cookies[process.env.COOKIE_NAME];
		}
	}).catch(error => {
		console.error("KMS error", error);
	}).then(() => {
		requestData['@timestamp'] = new Date().toISOString();
		console.info("Firehose data", requestData);
		fh.putRecord({
			DeliveryStreamName: process.env.STREAM_NAME,
			Record: { Data: JSON.stringify(requestData) }
		}).promise().then(data => {
			console.info("Firehose response", data);
			if (data.RecordId) {
				response.headers['RecordId'] = data.RecordId;
			}
		}).catch(error => {
			console.error("Firehose error", error);
		}).then(() => callback(null, response));
	})
};

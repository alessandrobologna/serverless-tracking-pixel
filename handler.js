'use strict';

const AWSXRay = require('aws-xray-sdk-core');
const AWS = AWSXRay.captureAWS(require('aws-sdk'));
//const AWS = require('aws-sdk');
const uuidv4 = require('uuid/v4');
const crypto = require('crypto');
const fh = new AWS.Firehose();
const kms = new AWS.KMS();

// function to determine if the cookie exists and is valid
const verify = (segments, secret) => {
	return segments.length === 2 && (crypto.createHmac('sha256', secret).update(segments[0]).digest('hex') === segments[1]);
}

let secret = undefined

const decrypt = () => {
	if (!secret) {
		return kms.decrypt({
			CiphertextBlob: new Buffer(process.env.SIGNATURE, 'base64')
		}).promise()
	} else {
		return Promise.resolve(secret);
	}
}

const cookify = (res, requestData, response) => {
	secret = String(res.Plaintext);
	let tracking = requestData.cookies[process.env.COOKIE_NAME];
	let splitted = tracking ? tracking.split('/') : undefined;
	// verify the cookie
	if (!(splitted && verify(splitted, secret))) {
		// add a tracking cookie
		let uuid = uuidv4();
		let sign = crypto.createHmac('sha256', secret).update(uuid).digest('hex');
		response.headers['Set-Cookie'] = process.env.COOKIE_NAME + "=" + uuid + "/" + sign + "; path=/; HttpOnly; Secure; Max-Age=31536000";
		requestData['uuid'] = uuid;
	}
	else {
		requestData['uuid'] = splitted[0];
	}
	delete requestData.cookies[process.env.COOKIE_NAME];
}


module.exports.tracker = (event, context, callback) => {
	let response = {
		statusCode: 200,
		headers: {
			'Content-Type': 'image/gif',
			'Cache-Control': 'no-cache'
		},
		body: "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
		isBase64Encoded: true
	};
	let requestData = event;
	// split cookie header
	if (event.headers['Cookie']) {
		requestData.cookies = event.headers['Cookie'].split(';').map((x) => {
			return x.trim().split(/(=)/);
		}).reduce(
			(a, b) => { a[b[0]] = b.slice(2).join('').replace(/^"(.*)"$/, '$1'); return a; }, {}
			)
	}

	decrypt().then(res => {
		cookify(res, requestData, response);
	}).catch(error => {
		console.error("KMS error", error);
	}).then(() => {
		requestData['@timestamp'] = new Date().toISOString();
		fh.putRecord({
			DeliveryStreamName: process.env.STREAM_NAME,
			Record: { Data: JSON.stringify(requestData) }
		}).promise().then(data => {
			if (data.RecordId) {
				response.headers['X-RecordId'] = data.RecordId;
			}
		}).catch(error => {
			console.error("Firehose error", error);
		}).then(() => callback(null, response));
	})
};



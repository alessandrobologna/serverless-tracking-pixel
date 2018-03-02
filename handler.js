'use strict';

const AWSXRay = require('aws-xray-sdk-core');
const AWS = AWSXRay.captureAWS(require('aws-sdk'));
//const AWS = require('aws-sdk');
const uuidv4 = require('uuid/v4');
const crypto = require('crypto');
const kinesis = new AWS.Kinesis();
const kms = new AWS.KMS();

// function to determine if the cookie exists and is valid
const verify = (cookie, secret) => {
	let segments = cookie.split('/');
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

const setCookie = (response) => {
	let uuid = uuidv4();
	let sign = crypto.createHmac('sha256', secret).update(uuid).digest('hex');
	response.headers['Set-Cookie'] = process.env.COOKIE_NAME + "=" + uuid + "/" + sign + "; path=/; HttpOnly; Secure; Max-Age=31536000";
	return uuid;
}

const cookify = (res, requestData, response) => {
	secret = String(res.Plaintext);
	if (requestData.cookies && requestData.cookies[process.env.COOKIE_NAME]) {
		let cookie = requestData.cookies[process.env.COOKIE_NAME]; 
		delete requestData.cookies[process.env.COOKIE_NAME];
		if (!verify(cookie, secret)) {
			return setCookie(response)
		} else {
			return cookie.split('/')[0] 
		}
	} else {
		return setCookie(response)
	}
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

	let uuid = undefined;
	decrypt().then(res => {
		uuid = cookify(res, requestData, response);
	}).catch(error => {
		console.error("KMS error", error);
	}).then(() => {
		requestData['@timestamp'] = new Date().toISOString();
		requestData['uuid'] = uuid;
		kinesis.putRecord({
			Data: JSON.stringify(requestData),
			PartitionKey: uuid,
			StreamName: process.env.STREAM_NAME
		}).promise().then(data => {
			console.log(data);
			if (data.SequenceNumber) {
				response.headers['X-SequenceNumber'] = data.SequenceNumber;
			}
		}).catch(error => {
			console.error("Kinesis error", error);
		}).then(() => callback(null, response));
	})
};





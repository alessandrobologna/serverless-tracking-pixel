# serverless-tracking-pixel
experimental tracking pixel implementation using serverless

## What does it do

This project implements a lambda/api gateway microservice that serving a 1x1 transparent gif, while capturing request context information, pushing them to Kinesis Firehose and from there to a ElasticSearch Service cluster.
All the resources required are built using serverless and the built in CloudFormation support. Please note that the ElasticSearch cluster is built, by default, with no permissions to access it. You may want to add permissions in the CloudFormation template or, once it's built, in the AWS console.
 
### Requirements:

```bash
$ npm install -g serverless
$ npm install --save-dev serverless-apigw-binary
```

### Deployment

Deploying the project requires two environment variables to be defined, to provide a namespace for the resources created. 
- PROJECT the project name
- STAGE the execution stage (for instance, test, dev, prov)
A simple one line to deploy then is:

```bash
$ PROJECT=myproject STAGE=dev sls deploy
```
Once deployed, note the api gateway url provided, and you can test with a simple curl command:
```curl -v "https://<api-gw-url>/dev/track.gif?foo=1&bar=2" -H "Cookie: some-cookie=1234" -H "Referer: http://www.google.com"
```
where <api-gw-url> is the provided api gateway url.

### Using it on your website.
The simplest way to use this tracking pixel is to embed it in a shared component of your site (for instance, the footer), with something like:

```html
<img src="https://<api-gw-url>/dev/track.gif" style="display:none">
```

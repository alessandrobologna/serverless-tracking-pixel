## Serverless Tracking Pixel
experimental tracking pixel implementation using serverless

## What does it do

This project implements a Lambda/APIGateway microservice that is serving a 1x1 transparent gif, while capturing the request context information, pushing them to Kinesis Firehose and from there to a ElasticSearch Service cluster.
All the resources required are built using the [Serverless Framework](https://serverless.com/) and the built-in CloudFormation support. Please note that the ElasticSearch cluster is built, by default, with no permissions to access it. You may want to add permissions in the CloudFormation template or, once it's built, in the AWS console.
 
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
Once deployed, note the APIGateway url provided, to test the service with a simple curl command:
```bash
$ curl -v "https://<api-gw-url>/dev/track.gif?foo=1&bar=2" -H "Cookie: some-cookie=1234" -H "Referer: http://www.google.com"
```
where <api-gw-url> is the provided APIGateway url.

### Using it on your website.
The simplest way to use this tracking pixel is to embed it in a shared component of your site (for instance, the footer), with something like:

```html
<img src="https://<api-gw-url>/dev/track.gif" style="display:none">
```
Please note that if you are serving the pixel straight from the API gateway, you will not be able to also read cookies that are associated with your domain. If you need to do so, the simplest thing is to do that as a page rule on your CDN, using the API gateway as origin for requests matching `*/track.gif`.

### Adding a tracking UUID cookie
You can also let this service generate a tracking cookie, signed with a secret (to avoid tampering). The secret is encrypted using KMS, and passed as an encrypted environment variable. When you deploy this project, the CloudFormation template will generate a KMS master key and an **alias** for it named `alias/<PROJECT>-<STAGE>/web-tracking`. You can use this master key to encrypt a secret with this command line (which requires the aws cli [installed](http://docs.aws.amazon.com/cli/latest/userguide/installing.html)).
```bash
$ export SIGNATURE=$(aws kms encrypt --key-id <alias> --plaintext 'my secret key' --query 'CiphertextBlob' --output text)
```
where `<alias>` is the alias as describe above.
The next step is to define how you would wish your cookie to be named:
```bash
$ export COOKIE_NAME=myTrackingCookie
```
Run the deploy command again, and now every request that doesn't have a `myTrackingCookie` cookie will be responded with a `Set-Cookie` header, with `myTrackingCookie` set to a random uuid, a `/` separator, and an `HMAC` of the uuid based on the provided `SIGNATURE`.

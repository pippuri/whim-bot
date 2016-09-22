
# MaaS deployment process

## MaaS Stages

MaaS stages

* Dev stage is where our current development happens. This works as a kind of 'sandbox' wher people can try out their own things. It can be broken any time.

* Test is a stage where Travis automatically does a clean deployment of all Serverless functions whenever something is committed to master branch. Test does not exist as a GitHub branch. This is the stage that the mobile app developers can develop against.

* Alpha is the stage that we use internally for testing a release candidate. The functions running in this stage do create real bookings, so be careful when booking!

* Prod is our current production stage, and in future we will have two different production environments (prod and prod-backup) that we toggle between to shorten the maintenance breaks in production. Prod exists on maas-backend core repo as a branch

* Dev / Test  will be using a similar set of environment variables, whereas Alpha Prod use another set.

* Each of the stages will have its own collection of resources suffixed/prefixed with its name. This includes DynamoDB tables, RDS instance + PostgresDB, CloudFormation, Meta synced variables etc...

## Things You Should Know about MaaS DevOps

### Credentials Secrets

Travis uses encrypted credentials for connecting with AWS. We have two different use cases:

* Testing PRs (needs AWS read-only credentials for a S3 bucket for sls meta sync): The credentials are stored in `.secret-aws-travis-pullrequests` and are opened using the encypted secure variable `TRAVIS_CI_SECRET_PULLREQUESTS`
* Auto-deploying to 'test' or 'alpha (needs full AWS read/write credentials): The credentials are stored in `.secret-aws-travis-branch` and Travis opens them using its encypted secure environment variable `TRAVIS_CI_SECRET`.

## Creating an Environment From Scratch

### Creating a Serverless Stage

> Note: DON'T DO IT unless you know what you are doing - we should only need to do this if the whole environment gets wiped out.

1. Make sure you are inside maas-backend folder
2. Do `sls stage create`
3. Follow the Serverless CLI instructions
4. At the end of the operation, it may return an error saying some environment variables are
missing. This is *normal*.
5. Go to `_meta/variables/s-variables-YOUR_NEW_STAGE_NAME_HERE.json` and add in
missing variables. Read s-templates.json as a reference, then add this file to
`.gitignore`.
6. Repeat step 5 with
7. `_meta/variables/s-variables-YOUR_NEW_STAGE_NAME_HERE-euwest1.json`, but do
not add it to `.gitignore`.

> Note: When do step 5 and 6, be careful and check stage name to prevent reoccurence

7. Run `sls resource deploy -s YOUR_NEW_STAGE_NAME_HERE`
8. [Create new RDS table](#creating-new-rds-postgres-instance) if *instructed*
9.  Migrate new knex table following [this instruction](#modifying-postgresql-database)
10. If instructed, redeploy all functions and endpoint to the new stage. You might want to create new npm deploy script. Read package.json script section for reference.

### Creating a New RDS Postgres Instance

1. Login to AWS console
2. Go to RDS (Relational Database Service)
3. From RDS > Instance > Launch DB Instance
4. Choose database type
5. Choose production / dev
6. Modify the instance specification
7. Input settings and advanced settings (samples on username, password etc.
can be found in in `_meta` folder). In Security Group, choose `rds-postgres-maas`.

### Creating CloudFront Configurations

AWS API Gateway creates hard-to-read CloudFront stacks with names like `https://0dlrb3j4eb.execute-api.eu-west-1.amazonaws.com/alpha`. In order to have human readable names, proper SSL credentials etc. we need to have an extra layer of indirection through CloudFront. We direct the traffic from the API Gateway CloudFront into our own, and name our own stack with a human readable name, e.g. `https://tsp.alpha.maas.global` (notice the missing `alpha` in the end - it is intentional).

> Note: This process is done both for maas-backend and maas-transport-booking

The following example describes the process for a sample TSP stage with intended domain name `tsp.alpha.maas.global` and API Gateway CloudFront name `https://0dlrb3j4eb.execute-api.eu-west-1.amazonaws.com/alpha`.

Create a new API Gateway -> Human-readable CloudFront mapping as follows:

1. Login to AWS console, go to CloudFront
2. Click `Create Distribution` Web -> `Get Started`
3. Origin Settings:
  * Type the API Gateway Origin Domain Name, e.g. `https://0dlrb3j4eb.execute-api.eu-west-1.amazonaws.com`
  * Set `Origin Path`, to `/alpha`
  * Set `Origin Protocol Policy` to `HTTPS Only`
4. Default Cache Behavior Settings:
  * Set `Viewer Protocol Policy` to `Redirect HTTP to HTTPS`
  * Set `Allowed HTTP methods` to `GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE`.
  * Set `Forward Headers` to `Whitelist`, add `Accept`, `Authorization` and `X-Api-Key` custom tokens.
  * Set `Object Caching` to `Customize`; set `Minimum TTL=0`, `Maximum TTL=3` and
`Default TTL=3`.
  * Set `Query String Forwarding and Caching` to `Forward all, cache based on all`.
  * Set `Compress Object Automatically` to `Yes` to permit gzip.
5. Distribution Settings:
  * Select `Use Only US, Canada and Europe` for `Price Class`.
  * Select `Custom SSL Certificate` and use an existing SSL
certificate with a matching `Additional names` in AWS Certifications configurations (e.g. `api.alpha.maas.global`
has additional names `*.alpha.maas.global`).
  * Use `tsp.alpha.maas.global` for the `Alternate Domain Names (CNAMEs)`.
6. Click `Create Distribution` and wait for the new distribution to come online.
7. Store the `Domain Name` of the new CloudFront distribtion for the next phase.

Note: These settings assume that the requests send Authorization header. With
header whitelisting, CloudFront caches based on a combination of path, HTTP
headers and query string. With TTL 1000, that means the same query for an
individual (authorized) user will be cached for 1000ms. [Read more](http://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/header-caching.html)

Now you need to map the distribution to a custom CNAME:

1. Go to Route 53
2. Choose `maas.global` hosted zone for editing
3. Click `Create Record Set`
  * Type in the human readable name (e.g. `tsp.alpha`)
  * Choose Alias: `Yes`, and type the domain name, stored in the previous phase for `Alias Target`.
4. Confirm by clicking `Create`.

Note that you may need to wait for a moment until the CloudFront deployment becomes active.

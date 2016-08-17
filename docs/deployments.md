
# MaaS deployment process

### Explaination

    * Dev stage is where our current development happens.

    * Test is a stage where Travis automatically does a clean deployment of all Serverless functions whenever something is committed to master branch. Test does not exist as a Github branch

    * Alpha is the stage that we use internally for testing, and that frontend can be developed against, and that we use internally. Alpha exists on maas-backend core repo as a branch

    * Prod is our current production stage, and in future we will have two different production environments (prod and prod-backup) that we toggle between to shorten the maintenance breaks in production. Prod exists on maas-backend core repo as a branch

    * Dev / Test / Alpha will be using the similar set of environment variables, whereas Prod use another set ( which in theory is brought to use by the users)

    * Each of the stage will have its own collection of resources suffixed/prefixed with its name. This includes DynamoDB tables, RDS instance + PostgresDB, CloudFormation, Meta synced variables etc ...

### The credentials secret

  * Credentials for travis to use on branch build is encrypted inside `.secret-aws-travis-branch` and is opened using the encypted secure variable `TRAVIS_CI_SECRET`

  * Credentials for travis to use on PR build is encrypted inside `.secret-aws-travis-pullrequests` and is opened using the encypted secure variable `TRAVIS_CI_SECRET_PULLREQUESTS`

### The release workflow

1) Developer creates a bugfix, feature or whatever using the normal github workflow in his local fork, and creates his PR
2) Travis runs the tests; another developer checks it out and accepts;
3) Developer merges it to master
4) Travis is invoked by the commit to master, and auto-deploys to "test" stage
5) Lead developer rebases the current test branch into alpha, as a sprint release candidate
6) Lead developer tags a version of alpha as sprint release
7) If Product Owner accepts the tagged release, Lead developer rebases "prod" to it and deploys it to "prod" stage

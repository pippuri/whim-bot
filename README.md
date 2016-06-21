# Maas Serverless API
[![Build Status](https://travis-ci.com/maasglobal/maas-backend.svg?token=qGskzXsqFBCyAJbx73qR&branch=master)](https://travis-ci.com/maasglobal/maas-backend)

The [Maas](http://maas.fi/) API is built with
[Serverless](https://github.com/serverless/serverless) framework. [SC5
Serverless Boilerplate](https://github.com/sc5/sc5-serverless-boilerplate/) was
used as a starting point for the project.

## Development Setup

### Configure Credentials

1. Go to https://maasfi.signin.aws.amazon.com/console
2. Log in with your temporary password
3. Change your password to something secure
4. Go to https://console.aws.amazon.com/iam/home#users
5. Click on your user name (not the checkbox) in the user account listing
6. Select your user account
7. Delete any existing access keys
8. Click *Create Access Key*
9. Add the access key to a new maas section in your `~/.aws/credentials` file (see example below)
10. Secure your credentials with `chmod og-rwx ~/.aws/credentials`

Example:
```
[maas]
aws_access_key_id = <your_fresh_key_id>
aws_secret_access_key = <your_fresh_secret>
```

### Configure Region

1. Add the following maas section to your `~/.aws/config` file
```
[profile maas]
region=eu-west-1
```

### Install Node.js
```
curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.31.0/install.sh | bash
grep -q -F .bashrc .bash_profile || echo 'source .bashrc' >> ~/.bash_profile
nvm install v4
nvm alias default v4
npm install npm -g
```

### Install Serverless

```
npm install -g serverless
```

### Downloading Backend Code

1. Go to https://github.com/maasglobal/maas-backend
2. Click on the *Fork* button
3. Select your personal user account (if prompted)
4. Wait for the forking to happen
5. Authenticate your workstation by adding an SSH key at https://github.com/settings/keys
4. Create a clone on your local workstation (see example below)

```
git clone git@github.com:<your_user_account>/maas-backend.git
cd maas-backend
git remote add upstream git@github.com:maasglobal/maas-backend.git
git pull upstream master
```

Now running `git remote -v` should produce the following output:

```
origin    git@github.com:<your_user_account>/maas-backend.git (fetch)
origin    git@github.com:<your_user_account>/maas-backend.git (push)
upstream    git@github.com:maasglobal/maas-backend.git (fetch)
upstream    git@github.com:maasglobal/maas-backend.git (push)
```

The rest of the documentation will assume that you have this setup.

### Configure Environment and Install Dependencies

```
cd maas-backend # unless you are already there
npm install
echo '{}' > _meta/variables/s-variables-dev.json
AWS_PROFILE=maas sls meta sync -s dev
```
Select "Apply these changes to the local version" at the prompt.
```
echo '{}' > _meta/variables/s-variables-prod.json
AWS_PROFILE=maas sls meta sync -s prod
```
Select "Apply these changes to the local version" at the prompt.
```
sls function autoinstall -a # Installs module dependencies to lambdas
```

IMPORTANT: If you selected the wrong option at the prompt you may have
accidentally deleted the API keys from the cloud. Do not panic however. Take a
deep breath and have a chat with someone else who is working in the project.
The chances are that the API keys are still available on another deployment or
a developer workstation, which will make it possible to upload them back to the
deployment where they got deleted.


### Deploying static files/images to S3 Bucket
```
Add files/folders to client/dist folder
```
Then run the following command:
```
sls client deploy -s dev #stage should be specified
```
# NB DO NOT REMOVE ANY EXISTING FILES/FOLDERS, THE FUNCTION REMOVE EVERYTHING IN THE S3 BUCKET AND REDEPLOY ALL FILES.

### Running Tests

To run the tests you need to first install mocha
```
npm install -g mocha
```

You can then run the tests by simply commanding `mocha`.

The tests are named with sentenses. You can leave tests out by defining any
part of the sentence that matches the tests you want to run. See examples
below.
```
mocha -g TripGo
mocha -g leaveAt
mocha -g "TripGo \(South Finland\) leaveAt request response"
```

### Running a Serverless Function In The Cloud

You can run the *routes-query* function in the cloud as follows
```
AWS_PROFILE=maas sls function run routes-query -d -s dev
```
Example data from file `routes/routes-query/event.json` is used.

### Running a Serverless Function Locally

You can run the *routes-query* function locally as follows
```
AWS_PROFILE=maas sls function run routes-query -s dev
```
Example data from file `routes/routes-query/event.json` is used.

Even though the function runs locally all calls to other lambdas will go to the
actual cloud deployment. To run the entire operation locally, you will need to
use the mocha tests and make sure all AWS calls go through the maas-backend
service bus. The service-bus will then redirect the related calls to local
lambdas and mock services as needed. At the moment some components call AWS
services directly without using the service bus. These need to be modified to
use the service bus before they can be run without the cloud deployment.

Since we'll be doing lots of `sls` commands you may feel the desire to set the
AWS_PROFILE variable more permanently instead of providing it with each command
separately. However, by doing this you will loose control over which commands
are allowed to deploy stuff to the AWS cloud. For example creating a new test
project with Serverless will automatically deploy some parts of the app to AWS
given that it finds suitable credentials to do so.



### Starting a New Local Branch

Below are commands for starting a new branch. The branch name should reflect
what you intend to achieve. This makes it easier to determine when you are done
with the branch.

```
git checkout master
git pull upstream master
sls function autoinstall -a
git checkout -b <local_branch_name>
```

### Committing Changes

Use imperative in commit messages. This makes them short. For example
"Implement superman provider." or "Fix code layout."

1. Check status with `git status`
2. Select changes to add with `git add <filename>`
3. Commit selected changes with `git commit -m "<message>"`

### Updating Your Branch

1. Make sure you do not have uncommitted changes. You can either commit them or use `git stash` to put them aside.
2. Make sure that the master branch does not have local commits (see next chapter for getting local changes out of master)
3. You can now update your branch to contain the latest development code as follows.

```
git checkout master
git pull upstream master
sls function autoinstall -a
git checkout <your_branch>
git rebase master
git push origin <your_branch> -f
```

Note that the rebase step may be more complex than simply running the command
since there might be edit conflicts.  In this case git will give you further
instructions on what to do. If you get lost you can use `git status` to find
out what git is expecting you to do next.

### Removing Local Changes From Local Master

It is easy to accidentally commit something into your local master branch. You
can move your changes out of local master branch as follows.

```
git checkout master
git checkout -b <new_branch_name>
git push origin <new_branch_name>
git checkout master
git reset --hard HEAD^
git reset --hard HEAD^
...
git reset --hard HEAD^
git pull upstream master
sls function autoinstall -a
```

Note that you need to call `git reset --hard HEAD^` once for each local commit.
However it does not matter if you call `git reset --hard HEAD^` too many times
since the following pull command will get all the changes back from the project
master branch.

### Contributing Code

1. Push the changes to your own fork (see example below)
2. Make a pull requests against official master at https://<i></i>github.com/&lt;your_user_account&gt;/maas-backend/branches

```
git push origin <local_branch_name>
```

### Working with Travis

The project is using Travis continuous integration service to run the basic set
of tests on pull requests. Before deploying or merging a pull request, you
should check Travis tests are passing. You should note that Travis environment
differs from your local environment:

   * Travis does not see your Serverless environment settings at *_meta/variables/**; if you add a new env variable, also add it to [Travis settings](https://travis-ci.com/maasglobal/maas-backend/settings).
   * Travis is running on Node 4.2 (sufficiently similar to AWS), whereas you may locally run something else.

When things run safely in Travis, we can be sufficiently confident they run on AWS.

Travis can not retrieve the API keys from S3 because since it does not have
credentials for our AWS cloud. Instead Travis uses API keys provided through
environment variables which can be modified through the Travis web interface at
https://travis-ci.com/maasglobal/maas-backend/settings Note however, that the
environment variables here can not be protected since Travis refuses to give
protected keys to pull requests comming from developer forks. As far as we know
there is no way of white listing trusted repositories.  See
https://docs.travis-ci.com/user/environment-variables/#Encrypted-Variables for
more details.

### Modifying PostgreSQL Database

MaaS uses Postgres for storing itineraries, legs and bookings into database. We use [Objection.js](http://vincit.github.io/objection.js/) and [Knex](http://knexjs.org/) as our ORM layer. Knex has a concept of 'migrations' when working with data, in which database schema changes are wrapped into their own script files.

To work with Knex, you will likely want to install its cli from npm:

```
npm install -g knex
```

When working with development data (that can be deleted):

1. Delete the tables using your own SQL client, e.g. [PSequel](http://www.psequel.com/)
2. Modify the initial migration script at `scripts/migrations`
3. Run the migration scripts:

```
cd scripts
knex migrate:latest
```

When working with production data (where you need to migrate):

1. Add a new script to `scripts/migrations` describing the change
2. Run the migration scripts as above


### Deploying To Dev

You can deploy the *routes-query* function to development environemnt as follows
```
AWS_PROFILE=maas sls function deploy routes-query -s dev
```

You can deploy the corresponding endpoint by commanding
```
AWS_PROFILE=maas sls endpoint deploy routes~GET -s dev
```

If you get confused about what kind of functions and endpoints exist you can
use *dash deploy* to find out. For example, you could find out the names of the
*routes-query* function and the *routes* GET endpoint as follows.
```
(cd routes; AWS_PROFILE=maas sls dash deploy -s dev)
```

Note that deploying a single endpoint doesn't currently deploy CORS headers as
expected, so in case you made changes that require new CORS headers to be
rolled out you need to call `sls endpoint deploy --all` in the project root
directory. This will deploy all endpoints. There is no way to do this only for
the endpoints of a single component. See
https://github.com/joostfarla/serverless-cors-plugin/issues/22 for discussion
on the subject.


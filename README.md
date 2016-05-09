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
gulp get-deps
```

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

### Running a Serverless Function Locally

You can run the *query* function of *locations* component as follows
```
AWS_PROFILE=maas sls function run routes-query -s dev
```
Example data from file `routes/routes-query/event.json` is used.

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
gulp get-deps
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
gulp get-deps
git checkout <your_branch>
git rebase master
git push origin <your_branch> -f
```

Note that the rebase step may be more complex than simply running the command
since there might be edit conflicts.  In this case git will give you further
instructions on what to do. If you get lost you can use `git status` to find
out what git is expecting you to do next.

### Removing Local Changes From Master

It is easy to accidentally commit something into master. You can move your
changes out of local master branch as follows.

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
gulp get-deps
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

### Deploying To Dev

You can init deploying a component (e.g. provider-tripgo ) to development environment as follows.
After you init the process you need to select the endpoints and functions you wish to deploy.

```
cd <component_folder>
npm install
AWS_PROFILE=maas sls dash deploy -s dev
```

Note that *dash deploy* doesn't currently deploy CORS headers as expected, so in case you made
changes that require new CORS headers to be rolled out you need to call `sls endpoint deploy --all`
in the project root directory. This will deploy all endpoints. There is no way to do this only
for the endpoints of a single component.


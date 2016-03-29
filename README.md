# Maas Serverless API

The [Maas](http://maas.fi/) API is built with
[Serverless](https://github.com/serverless/serverless) framework. [SC5
Serverless Boilerplate](https://github.com/sc5/sc5-serverless-boilerplate/) was
used as a starting point for the project.

## Development Setup

### Configure Credentials

1. Go to https://console.aws.amazon.com/iam/home#users
2. Log in with your temporary password
3. Change your password to something secure
4. Click on your user name (not the checkbox) in the user account listing
5. Select your user account
6. Delete any exsiting access keys
7. Click *Create Access Key*
8. Add the access key to a new maas section in your `~/.aws/credentials` file (see example below)
9. Secure your credentials with `chmod og-rwx ~/.aws/credentials`

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

### Install Serverless

```
npm install -g serverless
```

### Downloading Backend Code

1. Go to https://github.com/maasglobal/maas-backend
2. Click on the *Fork* button
3. Select your personal user account (if prompted)
4. Wait for the forking to happen
5. Autehnticate your workstation by adding an SSH key at https://github.com/settings/keys
4. Create a clone on your local workstation (see example below)

```
git clone git@github.com:<your_user_account>/maas-backend.git
cd maas-backend
git remote add upstream git@github.com:maasglobal/maas-backend.git
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
AWS_PROFILE=maas sls env list -s dev | grep -v -e ^$ -e ^Serverless: > .env
npm install
for d in `ls */package.json|cut -d \/ -f 1` ; do (cd "$d" && npm install); done
```

### Running Tests

*Currently we have no tests*

### Running a Serverless Function Locally

You can run the *query* function of *locations* component as follows
```
AWS_PROFILE=maas sls function run locations/query
```
Example data from file `locations/query/event.json` is used.

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

### Deploying

*This chapter remains to be written.*


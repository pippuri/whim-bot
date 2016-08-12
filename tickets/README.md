# MaaS Ticket general documentation

## What is this?

This is a section of the API which can be used to issue, audit and allow validating tickets provided by MaaS.

## Adding new ticket partners

Ticket partners have a database table which contains the following information about each partner:

* A unique ID for the partner
* The domain within which the partner can either create or audit tickets
* A password which the partner can use to interact with the ticket issuing API
* A password which the partner auditor can use to query the audit API
* An optional webhook URL which will be called once each time a new ticket is issued

Currently there is no interface to add the partners programmatically, so you just need to insert the new objects into the database by hand.

## Using the audit log and the global automated audit system

For MaaS business partners it is important to be able to trust that every ticket issued or revoked by MaaS is properly reported for balance settlement purposes. The solution to this is a two-fold trust but verify scheme:

1. Every time MaaS issues or revokes a ticket, the information of that action is made available to the business partner through a real-time API.
2. Every time a ticket inspector or an automated device scans a ticket, it stores the data of a valid ticket along with the scanning date and eventually sends it to the business partner for verification.

Business partner can then trivially implement an automated verification system which makes sure that all of the tickets that have been scanned have actually been published by MaaS through the real-time API at the time of ticket creation.

However, implementing an audited real-time API consumer like this creates a technical step for the business partner. In order to ensure that this does not place impediments on the adoption of the MaaS Ticket system, Maas provides a way to securely delay the implementation of this system.

For this purpose MaaS will contract multiple trustworthy 3rd party auditing partners, who provide a global MaaS Ticket signature verification service. This service allows securely ensuring that the audit log history that MaaS provides for it's business partners is complete and has not been changed after the tickets were first issued. While doing this, the system does not expose the actual contents of the tickets to the 3rd party auditing partner.

In effect this system is a real-time API that is fed to the 3rd party auditing partner and contains the following information for each globally issued MaaS Ticket creation or revocation:

1. An obfuscated business partner ticket domain ID
2. A signature of the audit log item payload

The 3rd party auditing partner stores this information with a timestamp for each item received, and provides an API for the business partner to fetch the full audit log signature history using their obfuscated domain ID.

The signature will be formed by creating a JWT token of the audit log item payload with the HS256 algorithm, while using the unique ID of the issued or revoked ticket as the hashing secret. Only the last part of the JWT token (the signature) is published through the API.

When the auditing partner eventually implements a verification system, they can fetch the full log of the audit log item signatures from any of the 3rd party auditing partners, and verify that the audit log history that MaaS provides exactly matches the list of 3rd party signatures, with only small differences in the recorded timestamps.

Ultimately using a 3rd party verification system also allows the business partner to implement the verification system as a cheap batch run instead of investing in the development of a potentially costly real-time system.

## How to do manual production deployments

The repository currently contains the production secret key in an encrypted format, and these files are decrypted as part of the automated deployment process. If you for some reason need to deploy the ticket endpoints to the production environment manually, you need to export the $MAAS_TICKET_DEPLOY_SECRET environment variable from production \_meta.

After you have the $MAAS_TICKET_DEPLOY_SECRET environment variable set, you can encrypt the production secrets locally by running the following commands:

```
openssl aes-256-cbc -pass "pass:$MAAS_TICKET_DEPLOY_SECRET" -in ./tickets/tickets-create/keys/prod-latest.js.asc -out tickets/tickets-create/keys/prod-latest.js -d -a
openssl aes-256-cbc -pass "pass:$MAAS_TICKET_DEPLOY_SECRET" -in ./tickets/tickets-create/keys/prod-transitional.js.asc -out tickets/tickets-create/keys/prod-transitional.js -d -a
```

After this you should be safe to do deployments.

*REMEMBER TO CHECKOUT THE FILES* after doing the deployment. This so that you *DO NOT COMMIT THE CLEARTEXT FILES* to the repository:

```
git checkout tickets/tickets-create/keys/prod-latest.js
git checkout tickets/tickets-create/keys/prod-transitional.js
```

## How to refresh the production secret key

Currently the secret key is supplied with within the codebase, and can be refreshed using the following method:

0. Decide a number of days you want to wait for the new secret to take effect. You need to account for the time it takes for you to deploy a new version to production, and add it to the time you want to give your validator devices to fetch and cache the new public key. For this example we will use `7 days`.

1. Get a milliepoch timestamp which is 7 days from now:

```
node -e 'console.log(new Date().getTime()+1000*60*60*24*7)'
```

2. Replace the milliepoch in the `tickets/tickets-create/keys/prod.js` with the new one.

3. Move the old latest encrypted key file to override the encrypted transitional file:

```
mv tickets/tickets-create/keys/prod-latest.js.asc tickets/tickets-create/keys/prod-transitional.js.asc
```

4. Generate a new private key (supply an empty password!) and a new public key:

```
ssh-keygen -t rsa -b 768 -f latest.key
openssl rsa -in latest.key -pubout -outform PEM -out latest.key.pub
```

5. Copy the cleartext dev key file as a template for your latest production key file:

```
cp tickets/tickets-create/keys/dev-latest.js tickets/tickets-create/keys/prod-latest.clear.js
```

6. Replace the key in `tickets/tickets-create/keys/prod-latest.clear.js` with the data from `latest.key`.

7. Export the $MAAS_TICKET_DEPLOY_SECRET value from \_meta and encrypt the cleartext file:

```
openssl aes-256-cbc -pass "pass:$MAAS_TICKET_DEPLOY_SECRET" -in ./tickets/tickets-create/keys/prod-latest.clear.js -out tickets/tickets-create/keys/prod-latest.js.asc -a
```

8. Add the public key from `latest.key.pub` to the end of `./tickets/tickets-validation-keys/index.js` like the other keys. Remember to use the original milliepoch as the validity starting time.

9. Remove the cleartext versions of key files:

```
rm latest.key.pub latest.key tickets/tickets-create/keys/prod-latest.clear.js
```

10. Commit and roll out your changes.

## TODO items for the future

### Ticket expiry, cancellation and revocation

In order to be able to cancel tickets, you need to do that with a revocation list. The tickets currently already ship with a unique ID, which can be used for revocation. All tickets also contain the `iat` field, which tells when the ticket was issued.

Validator devices should be coded to automatically invalidate tickets which have been created N days in the past (judging by the "iat" key). But in order to invalidate tickets, for example in case of cancellations, a revocation database needs to be created, which is then synced periodically to the validator devices. Choosing a bigger N means we need to maintain a larger revocation list, as cancelled ticket IDs can be removed from the revocation list only after N days have passed since the creation of the ticket.

### Move private and public keys to a database

At some point it might be needed to automate issuing new private keys and expiring the old ones without doing deployments. The same logic would still apply, that the private key should be generated, and the corresponding public key should be added to the "validation-keys" public key list some days before the new private key is actually used for generating tickets.

In order to somewhat securely store the private keys in the database, it would be a good idea to crypt the private key with a symmetric cipher before inserting it into the database. A shared secret used to encrypt the key to all of the lambdas which allows decrypting the key before using it to issue tickets.

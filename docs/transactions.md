# MaaS Business Transaction Processing

MaaS includes its own implementation of transaction to associate transaction logs to transaction processing. In principle it is is a wrapper to Objection transaction and it should encapsulate the Objection specifics underneath.

## Sample Flow - Cancel an Itinerary

The usage is almost as simple as with Objection transactions: Create a transaction that you give a name (and optionally a value), put one or more meta details within the transaction and commit. The transaction log gets written on commit. If you rollback, nothing gets written into the transaction log (but this gets logged into system log).

The following concept level sequence diagram illustrates the usage (open with PlantUML, e.g. with markdown-preview-enhanced plugin).

```{puml}
@startuml
"itinerary-cancel" -> Itinerary: cancel()
Itinerary -> Transaction: new
Transaction --> Itinerary: new transaction

Itinerary -> Transaction: start
Transaction -> Objection.transaction: start
Objection.transaction --> Transaction: new objection transaction
Transaction -> Transaction: save transaction handle, message & value
Transaction --> Itinerary: OK

Itinerary -> Transaction: bind to Itinerary,\nLegs & Bookings
Transaction -> Transaction: save the associations
Transaction --> Itinerary: OK

Itinerary -> Itinerary: Handle the \nbusiness process

Itinerary -> Transaction: commit
Transaction -> Transaction: create DB insertion to transaction log
Transaction -> Objection.transaction: commit
Objection.transaction --> Transaction: OK
Transaction --> Itinerary: OK
Itinerary --> "itinerary-cancel": OK

@enduml
```

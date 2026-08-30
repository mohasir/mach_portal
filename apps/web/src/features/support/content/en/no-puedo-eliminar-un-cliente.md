Unlike the catalog, clients can actually be **deleted for real** (it's not a deactivation) — but
only if nothing's linked to them.

## Why it fails

If the client has **quotes or events associated** with them, the system won't let you delete them,
and the message you'll see is generic ("An unexpected error occurred"), not something specific
like "this client has associated quotes".

If you run into that error while trying to delete a client, it's most likely because they have
linked quotes or events — check their "Quotes" and "Events" tabs before trying again.

There's no alternative way to "deactivate" a client instead of deleting them (unlike the catalog)
— if they have history, the option is to leave them as they are.

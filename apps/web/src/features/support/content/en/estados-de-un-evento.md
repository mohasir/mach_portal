An event has 3 possible statuses. Unlike quotes, this **isn't a stored field** — it's computed
every time it's shown:

- **Cancelled**: if the originating quote is in the Cancelled stage.
- **Completed**: if it isn't cancelled and it's already been marked as completed.
- **Upcoming**: in any other case.

## Marking an event as completed

"Mark as completed" button on the event's page (only visible while it's Upcoming).

- **No preconditions**: you can mark it as completed even if payment is still pending or options
  still need confirming — the system doesn't block it.
- It asks for confirmation and is **irreversible**: there's no way to "unmark" it from the
  interface once it's done.
- If the event's date has already passed and it's still Upcoming, you'll see an "Overdue" warning
  with a direct shortcut to this same button — it's just a reminder, it doesn't block anything
  else.

![The "Mark as completed" button and its confirmation](/support/estados-de-un-evento/1.png)

## Cancelling an event

The "Cancel event" button **actually cancels the originating quote** — there's no independent
event cancellation. The confirmation message says so explicitly. It's only available while the
event is Upcoming (you can't cancel one that's already Completed).

![The "Cancel event" button and its confirmation](/support/estados-de-un-evento/2.png)

Assigned staff and payments already registered **aren't touched** when cancelling — they stay
intact. If someone later reactivates that quote, the same event becomes active again with
everything it already had (it's not duplicated or recreated).

## One thing to keep in mind

An event with a date that's already passed that nobody marked as completed **doesn't disappear or
archive itself** — it keeps showing up as "Upcoming" indefinitely until someone marks it by hand.

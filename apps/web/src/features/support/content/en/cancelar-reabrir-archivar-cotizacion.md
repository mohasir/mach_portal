Cancelling and archiving are two different actions, and it's worth not mixing them up.

## Cancelling

- Available from Pending, Sent or **Confirmed** (even after an event was already created). It
  asks for explicit confirmation; no reason is required.
- **It doesn't delete any data**: lines, options, notes, client — everything stays intact, only the
  status changes to Cancelled.
- If the quote was already **Confirmed** (with an event created), cancelling it also automatically
  marks the resulting event as cancelled. The event isn't deleted.

![Confirmation when cancelling a quote](/support/cancelar-reabrir-archivar-cotizacion/1.png)

## Reopening

Reopening = moving a Cancelled quote back to **Sent** (never to Pending). You do it from the
same status tag or the pipeline. Once reopened, it becomes editable again and you can try
confirming it once more.

> If a quote reached Confirmed (it already created its event) and is then cancelled and reopened,
> confirming it again makes the system try to create
> **another** event for the same quote — and since each quote can only have one associated event,
> this second confirmation can fail with an unexpected error instead of a clear message. Avoid
> re-confirming a quote that already generated an event once; if you need to reactivate it,
> coordinate it outside the standard flow or create a new quote instead.

## Archiving

This is a separate action, not a pipeline stage. It's in the actions menu (⋮) of any quote, **in
any status**.

- It removes the quote from the Table and the Pipeline entirely, no matter what stage it was in.
- **There's no way to "unarchive"** from the interface — it's a one-way action.
- Use it for quotes you no longer want showing up in the regular lists, not as a substitute for
  Cancelling.

![Actions menu with the Archive option](/support/cancelar-reabrir-archivar-cotizacion/2.png)

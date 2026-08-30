The Pipeline (`Quotes → Pipeline view`) is the default view for working with quotes: a kanban
board with one column per stage.

![Quotes pipeline](/support/pipeline-de-cotizaciones/1.png)

## How to move cards

- **Desktop**: drag the card to whichever column you want.
- **Mobile**: there's no touch drag — use the card's "Move to…" menu.
- Moving a card to **Confirmed** or **Cancelled** always asks for confirmation.
- Only valid moves are allowed based on the stage rules (see
  [Quote stages explained](/admin/settings/support/estados-de-una-cotizacion)) — if you try
  something that doesn't apply, the system rejects it.

## What each card shows

Quote number (click to copy), a "Draft" tag (red if it's missing data to be sent, gray if it's
complete), an "Expired" tag when it applies, client, event type, event date, total and number of
lines.

## Why the Cancelled column shows less than the others

The Pending, Sent and Confirmed columns always load **every** open quote, with no date limit.
The **Cancelled column, on the other hand, only shows the ones cancelled this month** (based on
the last stage change date) — so it doesn't grow without limit. A quote cancelled a while back
won't show up there, even though it still exists (you'll still find it in the Table view).

## Assigning staff from the Confirmed column

Cards in the Confirmed column show the avatars of staff already assigned to the event, plus a
button to **assign staff** right there, without leaving the pipeline (it opens staff availability
for that date).

![Assigning staff from a Confirmed card](/support/pipeline-de-cotizaciones/2.png)

## Clicking a card

- If it's in **Pending**, it opens the builder (editable).
- In any other stage, it opens the detail/preview view (read-only content, with PDF and
  status-change actions available).

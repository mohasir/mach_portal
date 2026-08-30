Every quote goes through 4 fixed stages. New stages can't be created or removed — only their name,
color and description can be edited (Settings → Quote stages).

> Stage names are admin-editable text, not translated by the app — in the product itself you'll
> see the Spanish label ("Pendiente", "Enviada", "Aprobada", "Cancelada") no matter which language
> your interface is set to. This article uses the English meaning throughout.

![Stages in the Pipeline](/support/estados-de-una-cotizacion/1.png)

| Stage | What it means | Editable? |
|---|---|---|
| **Pending** | Not sent to the client yet. | Yes, freely. |
| **Sent** | Already sent to the client, waiting for them to accept or reject it. Has an expiration date. | Yes. |
| **Confirmed** | The client accepted it; it already created an event. | No — read-only. |
| **Cancelled** | It fell through, either because the client rejected it or an internal decision. There's no separate reason for each case. | Not applicable. |

## How it moves between stages

- It's **linear**: you can't jump from Pending straight to Confirmed, it has to go through Sent.
- **Confirmed is a terminal state going forward**: there's no "un-confirm". The only way out from
  there is Cancelled.
- **Cancelled only reopens to Sent**, never back to Pending.
- The system validates this on the server too — an invalid move is rejected with "That status
  change isn't allowed", it's not just a visual restriction.

## What you can edit at each point

You can only edit a quote's content while it's **Pending** or **Sent**. If you open the builder
for a Confirmed or Cancelled quote, the system takes you straight to a read-only view.

Every stage change (and who made it) is logged in the "Activity" tab of the quote's detail page.

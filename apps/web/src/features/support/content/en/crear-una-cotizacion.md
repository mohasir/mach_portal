A quote is built from **Quotes → New quote**. The form has several sections; nothing autosaves
while you type, so you'll get a warning if you try to leave without saving.

![Quote builder](/support/crear-una-cotizacion/1.png)

## Step 1: Client

Pick one of these two (they can't be combined):

- Search and select an **existing client**.
- Add a **new client** without leaving the builder — it only asks for name (required), phone and
  email. Note: this client isn't saved yet at this point; it's only created once you save the
  quote (if you leave without saving, the new client is never created either).

The client is the **only required field** to save a draft.

![Search an existing client or add a new one](/support/crear-una-cotizacion/2.png)

## Step 2: Event details

Event type, date, time, State (NY, NJ or CT), City and Address.

- You can't pick a date earlier than today, or a time that already passed if you picked today.
- City depends on the State you picked (it's a closed list, not free text) — if you change the
  State and the loaded city isn't in the new list, it gets cleared automatically.
- State, City and Address aren't required to save a draft, but they are required to **send** the
  quote later on.

## Step 3: Extra charges

This section only shows up if your organization has the **extra charges** add-on. It lists the
active charges of the catalog (**Extra charges** in the menu): switch on each one that applies and
adjust its value for this quote if needed.

- A **fixed** charge adds its amount.
- A **percentage** charge is calculated on the total with tax. With several of them, each one uses
  that same total (they don't add up on each other).
- Charges are **not taxed**.

A charge that was already on the quote and whose type was deactivated later is kept as it is: it
can only be removed. Without the add-on, the quote keeps the charges it already had, but they can't
be added or changed.

## Step 4: Adding {{items}}

Search the {{item}} in the catalog and add it as a line. Pick the **package** for the headcount —
from a list already defined for that {{item}}, you can't type a free amount. The price is
pre-filled from the chosen package, but you can edit it by hand.

Each {{item}}'s options (ingredients, flavors, etc.) aren't chosen here — they're completed later,
from the already-approved event's page. See
[Completing an event's pending options](/admin/settings/support/completar-opciones-pendientes).

![Adding a {{item}} and picking its package](/support/crear-una-cotizacion/3.png)

## Step 5: Discount and deposit

Discount type (none, fixed amount or percentage) + value, and the deposit percentage (pre-filled
from the default in Settings, but editable per quote).

## Step 6: Internal notes

Free text that **doesn't** show up on the PDF and the client never sees it — it's for internal
staff use only.

## How the total is calculated

```text
Subtotal (lines)
− Discount (spread over the lines)
+ Tax (per rate: each line at its {{item}}'s rate)
= Total with tax
+ Extra charges (fixed, and percentage on the total with tax; not taxed)
= TOTAL
```

Each line takes its {{item}}'s tax rate when it's added (0% if the {{item}} is tax exempt) and
keeps it even if the {{item}}'s rate changes later. The event's State doesn't affect tax. The
summary shows one tax row per rate.
The deposit and balance are calculated on that final TOTAL.

## "Save draft" vs "Create quote"

- **Save draft**: saves whatever is there, without requiring it to be complete. Having a client is
  enough. The quote stays in **Pending**, marked as a draft.
- **Create quote**: requires client, State, City, Address and at least one line. It removes the
  "draft" mark, but the quote **stays in Pending** — this still isn't the same as sending it to
  the client. For that, see
  [How to send a quote to the client and generate the PDF](/admin/settings/support/enviar-una-cotizacion).

Neither button sends an automatic email or WhatsApp message to the client.

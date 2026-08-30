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

- **Long-distance charge**: a free amount. Picking or changing the event's State
  **automatically overwrites this field** with a suggested value — if you had already entered an
  amount by hand, it gets replaced. Set it (or fix it) after confirming the State, not before.
- **Card/check surcharge**: an on/off switch that adds the configured percentage on top of the
  total after tax.

## Step 4: Adding stations

Search the station in the catalog and add it as a line. Pick the **package** for the headcount —
from a list already defined for that station, you can't type a free amount. The price is
pre-filled from the chosen package, but you can edit it by hand.

Each station's options (ingredients, flavors, etc.) aren't chosen here — they're completed later,
from the already-approved event's page. See
[Completing an event's pending options](/admin/settings/support/completar-opciones-pendientes).

![Adding a station and picking its package](/support/crear-una-cotizacion/3.png)

## Step 5: Discount and deposit

Discount type (none, fixed amount or percentage) + value, and the deposit percentage (pre-filled
from the default in Settings, but editable per quote).

## Step 6: Internal notes

Free text that **doesn't** show up on the PDF and the client never sees it — it's for internal
staff use only.

## How the total is calculated

```text
Subtotal (lines)
− Discount
+ Long-distance charge
= Base
+ Tax (based on the State, if enabled in Settings)
= Total with tax
+ Card/check surcharge (if enabled)
= TOTAL
```
The deposit and balance are calculated on that final TOTAL.

## "Save draft" vs "Create quote"

- **Save draft**: saves whatever is there, without requiring it to be complete. Having a client is
  enough. The quote stays in **Pending**, marked as a draft.
- **Create quote**: requires client, State, City, Address and at least one line. It removes the
  "draft" mark, but the quote **stays in Pending** — this still isn't the same as sending it to
  the client. For that, see
  [How to send a quote to the client and generate the PDF](/admin/settings/support/enviar-una-cotizacion).

Neither button sends an automatic email or WhatsApp message to the client.

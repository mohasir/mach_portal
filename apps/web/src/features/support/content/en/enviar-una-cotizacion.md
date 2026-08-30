"Create quote" doesn't send anything to the client — it only confirms the quote is complete and
removes the draft mark. Sending it is a separate step.

## How to send a quote

Sending a quote means moving it from **Pending** to **Sent**. You can do that two ways:

- From the **Pipeline**, dragging the card to the "Sent" column (desktop) or choosing "Move to…"
  from the card's menu (mobile).
- Tapping the status tag above the builder or the quote's detail page, then picking the next
  stage.

![Moving the quote to Sent from the status tag](/support/enviar-una-cotizacion/1.png)

Before the quote moves to Sent, it's checked again for State, City, Address and at least one
line. If something's missing, you'll see "Missing data to send the quote" — that can happen even
after "Create quote", if something was removed in between.

> Sending a quote doesn't send any automatic email or WhatsApp message to the client. "Sent" is
> an internal tracking label — sharing the PDF with the client (by link, download, or outside the
> app) is done by staff manually.

## Generating and sharing the PDF

The "Generate PDF" (or "View PDF") button shows up once the quote is **Sent** or **Confirmed** —
before that, there's no PDF to share yet.

If the quote is edited after the PDF is generated, opening "View PDF" again generates a fresh one
automatically with the changes, so an outdated version never gets shared by accident. Each PDF is
saved along with its generation date.

![Generate PDF / View PDF button](/support/enviar-una-cotizacion/2.png)

## Expiration date

Every quote gets an expiration date calculated automatically when it's created: the creation date
plus the validity months configured in Settings (3 months by default). It's an account-wide
value — it can't be adjusted per quote, and only affects quotes created from that point on.

If that date passes and the quote is still Sent, a red "Expired" tag shows up in the pipeline and
the table. It's just a visual flag: if the client responds late, the quote can still be confirmed.

All payment handling is done from the "Payments" tab on the event's page.

![Registering a payment](/support/registrar-pagos-de-un-evento/1.png)

## Registering a payment

At the top you'll see **Paid**, **Balance** and **Total**, with the "Register payment" button
(disabled once the balance is already 0). The form asks for:

- **Method** (required): Zelle, Cash, Card, Check or Transfer.
- **Percentage** shortcuts (20/30/40/50%) that pre-calculate the amount based on the total, capped
  at the available balance.
- **Amount** (required, can't exceed the pending balance).
- **Date** (required, defaults to today), **Reference** and **Notes** (optional).

If the entered amount **exceeds the pending balance**, the system rejects the whole operation —
nothing gets registered, not even partially. The sum of all payments can never exceed the total.

## Attachments

Each payment can have an attached receipt (the "Attachment" button on its row in the history):
image (jpg/png/webp) or PDF, **up to 5MB**. All of an event's receipts also show up together in
the "Attachments" tab, sorted by upload date.

![Attachments tab with the receipts](/support/registrar-pagos-de-un-evento/2.png)

## What you can't do

- **You can't edit or delete a payment that's already registered** — you can only delete its
  attachments. If a payment was entered by mistake, there's no way to fix it from the interface.
- The payment status (**Pending**, **Partial**, **Paid**) is calculated automatically, it can't be
  forced.

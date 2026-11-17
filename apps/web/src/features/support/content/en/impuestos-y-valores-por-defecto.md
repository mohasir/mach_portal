`Settings → General` (Admin role) has two cards related to quotes.

## Quote defaults

Default deposit (%), Quote validity (months — the expiration date depends on this), Quote
sequence start, Currency and Options selection deadline (days before the event). The minimum
quantity of each line is set on each catalog item.

> The sequence start **can't be lowered** below the last number already used — the system rejects
> it if you try.

![Quote defaults card](/support/impuestos-y-valores-por-defecto/1.png)

## Taxes

Tax belongs to each {{item}}, not to the event's place. The **Taxes** card holds the **default tax
rate**: the rate every new {{item}} starts with.

- On each catalog {{item}} you can change its rate or mark it **tax exempt** (it's quoted at 0%,
  without losing the rate it had).
- Changing the default rate doesn't change existing {{items}}.
- Each quote line copies its {{item}}'s rate when it's added and keeps it: changing an {{item}}'s
  rate only affects new or edited lines.
- A quote can have lines at different rates; the summary and the PDF show the tax of each rate
  separately.

## Extra charges

With the extra charges add-on, the **Extra charges** section of the menu defines the charges that
can be added to a quote (for example a travel fee or a card payment surcharge): name, fixed or
percentage, and default value. A percentage charge is calculated on the total with tax and no
charge is taxed. Deactivating a charge removes it from the quote builder; quotes that already have
it keep it.

## Important: this doesn't touch existing quotes

Changing any of these values **only affects quotes created or edited afterward**. Existing ones
keep the rates, charges and values they had when they were saved — they don't recalculate on their
own.

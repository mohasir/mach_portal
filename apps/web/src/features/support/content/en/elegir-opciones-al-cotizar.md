Each station can have option sections (ingredients, flavors, extras). There are two possible
moments to choose them, and which one is used depends on a global switch.

## The two modes

- **Choose later (default)**: while building the quote you only pick the station and the package
  for the headcount. Each section's options stay pending and are filled in later, from the already-confirmed
  event's page.
- **Choose now**: if Mach Bar's support team turned on the "Allow choosing options when quoting"
  switch in Settings → Preferences, you'll see a **"Choose options now"** switch in the builder. Turning it
  on lets you pick each station's options right there, while quoting.

If the global switch is off, you won't see this option in the builder at all — every new quote
stays in "choose later" mode with no way to change it.

![The "Choose options now" switch in the builder](/support/elegir-opciones-al-cotizar/1.png)

## What happens depending on the mode

When the quote is confirmed and turns into an event:

- If it was quoted in **"Choose now"** mode: the event is born with the options already resolved —
  nothing is left pending.
- If it was quoted in **"Choose later"** mode: the event is born with pending options, and someone
  has to fill them in from the event's page before the configured deadline. See
  [Completing an event's pending options](/admin/settings/support/completar-opciones-pendientes).

## How choosing within a section works

- **"Incluido" (Included) sections**: come with every option already checked, and you can't touch
  them.
- **"Seleccionable" (Selectable) sections**: you can pick several options, up to that section's
  maximum if it has one (no maximum means no limit). Once you hit the cap, the unchecked options
  get disabled until you uncheck one.
- **No minimum**: a selectable section can be left with no option checked at all, and the quote can
  still be sent.

![Choosing options inside a selectable section](/support/elegir-opciones-al-cotizar/2.png)

If the global switch was changed after quotes with chosen options already existed, those quotes
**keep** what they already had — the change only affects new ones.

Stations (the top level of the catalog) are created and edited from `Catalog`.

## Creating a station

"New station" button — asks for Name (required, can't be repeated), Description (optional) and
the **Premium** switch (adds a gold badge in the list and the detail page; it's purely cosmetic,
it doesn't affect price or availability anywhere else in the app).

This form **doesn't load prices** — the station is created with no packages, and you need to go into
its detail page afterward to add them.

![The "New station" form](/support/crear-estacion-y-precios/1.png)

## Loading prices (packages)

Go into the station's detail → **Prices** tab. Each package = a number of people + a total price for
that headcount (not a price per person).

- "Add package" adds an empty row; tapping "Save" **replaces every package** for the station at once
  (there's no history of the previous packages).
- There can't be two packages with the same headcount — the system rejects it.
- If you try to remove a row that already has data, it asks for confirmation; if it's empty, it's
  removed right away.

![The Prices tab with packages loaded](/support/crear-estacion-y-precios/2.png)

These packages are what later show up as a dropdown when adding the station to a quote — you can't
enter a headcount that doesn't exist as a package.

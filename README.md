# moving-sale
Moving sale in San Sebastián: things for sale before my move.

Live site: https://deggenschwiler.github.io/moving-sale/ (published from this `gh-pages` branch).

## How it works
The page reads its items from the **Public** tab of the Moving Sale Tracker Google Sheet, which is published to the web as CSV. Editing the **Items** tab updates the site within a few minutes; no code changes are needed.

Items tab columns that drive the site:
- **Show on site**: tick to show an item, untick to hide it. Nothing is deleted.
- **Status**: Pending shows as "Reserved". Sold, Donated and Keeping items are never shown.
- **Asking price**: shown on the card; empty shows "Ask for price".
- **Listing (English)** / **Listing (Spanish)**: the two descriptions. The **Spanish check** column says "Needs update" when the English has changed since the Spanish was last written.
- **Photos (site)**: the photo files for the item, in order. The first is the cover.
- **Category**: drives the filter buttons.
- **Suggested price**: a suggestion only. The site never reads it.

## Files
- `index.html`, `styles.css`, `app.js`: the site
- `photos/`: item photos, resized with location data removed. `name.jpg` is full size, `name-t.jpg` the card thumbnail.
- `photos/manifest.json`: which Drive photos are already on the site
- `tools/sync_photos.py`: downloads only new photos from the Drive folder (see the top of the file)

# moving-sale
Moving sale in San Sebastián: things for sale before my move.

The page reads its items from the "Public" tab of the Moving Sale Tracker Google Sheet (published to the web as CSV), so prices and status update when the Sheet changes.

- `index.html`, `styles.css`, `app.js`: the site
- `photos/`: item photos, resized with location data removed. `name.jpg` is the full size, `name-t.jpg` the card thumbnail.
- To change which photos show for an item, edit its "Photos (site)" cell in the Sheet.

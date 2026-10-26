# Tarasvini Catalogue

Static website for Tarasvini, published by Netlify from this repo.
Products come live from the published Google Sheet (Catalogue tab).

## Files

| File | What it is |
|---|---|
| `index.html` | Catalogue home page |
| `reviews.html`, `contact.html` | Other pages (`about.html` is kept but not linked for now) |
| `style.css` | Look of every page (colours, fonts, layout) |
| `app.js` | Everything the site does. **Settings are at the top.** |
| `catalogue-backup.csv` | Saved copy of the products, shown only if Google Sheets cannot be reached |
| `assets/` | Logos (`logo-header.png` is the one in the menu bar) and browser-tab icon |

## Settings (top of `app.js`)

- `SHEET_URL`: the published sheet link (up to `/pub`)
- `SHEET_TABS`: gid numbers of the Catalogue and Offers tabs, any order
- `REVIEWS_URL`: published CSV link of the Reviews sheet
- `WA`: WhatsApp number with country code, no `+`

## Updating products

Edit the Google Sheet. The website picks up changes within a few minutes
(Google refreshes published sheets about every 5 minutes). No upload needed.

Now and then, refresh the backup: in Google Sheets open the Catalogue tab,
File > Download > CSV, rename the file to `catalogue-backup.csv` and upload
it here, replacing the old one.

## Product tabs

Products can be in one Catalogue tab or in one tab per category (Sarees, Salwar Suits,
Kurtis & Gowns, ...), all with the same columns. Add every product tab's gid to
`SHEET_TABS`; the site merges them. A Product Code found in two tabs is shown once.

## Descriptions

Write each point on its own line in the cell (Ctrl+Enter on Windows, Cmd+Enter on Mac). The first
line is shown in bold; a short line followed by points ("Size", "Material and care") becomes a heading;
"Label - value" lines show as **Label:** value. A *, - or • at the start of a line is optional.

## Sheet columns the site reads

Product Code, Category, Sub-category, Product Name, Fabric, Colours, Sizes, Price,
Delivery, Availability, Featured, Photo 1, Photo 2, Photo 3, Video, Description,
Show on Website, New Arrival, Sale Price, Occasion, Home Collection.
Headings are matched loosely (capitals, spaces and dashes do not matter), and the
older names (id, name, collection, fabric_group, image_url...) still work.

The main menu (and the Shop links in the footer) is built from the Category column,
in the order categories first appear in the sheet. A new category, e.g. Dupatta,
gets its own menu item "Dupattas" automatically; a category with no products on the
website drops out of the menu. Saree, Salwar, Kurti, Lehenga and Cord-set keep their
usual names (Sarees, Salwar Suits, Kurtis & Gowns...). Availability "Hidden" keeps a
row off the website.

Colours: a number (6) or colour names (Red, Blue, Green). Up to 3 colours: "Available
in 3 colours" / "Available in Red, Blue and Green". More than 3: the card says "More
colours" and the product window asks customers to message on Instagram or WhatsApp
to see all the colours (with names, only the first 3 are shown).

Show on Website (tick-box): once at least one row is ticked, only ticked rows
appear on the site. With the column missing or nothing ticked, every row shows.
New Arrival (tick-box): adds a "New arrival" label, a New arrivals filter, and
puts the product near the top (after Featured). Yes/TRUE/1/x all count as ticked.

Sale Price (optional): if lower than Price, the site shows it with Price crossed
out, a "% off" note, a Sale label and an On sale filter.

## Offers banner (Offers tab)

Columns: Show, Headline, Details, Button Text, Button Link, Start Date, End Date,
Colour. A row shows as a banner under the header on every page when Show = Yes
and today is within the dates (empty dates = no limit). Several live rows rotate.
Button Link: a category name, WhatsApp, Instagram (opens a DM), Instagram page, a product code, or a full URL.
Colour: Red, Pink, Teal, Gold, Brown, or a #hex value.

Offer codes (optional columns on the Offers tab): Offer Code, Discount, Min Order, Full Price Only.
While a row with an Offer Code is live, eligible products show the offer in their window and
the WhatsApp/Instagram order message gets a line "Offer: CODE (10% off)". Full Price Only = Yes
leaves out products with a Sale Price. The discount itself is applied when the order is confirmed.
Everything stops automatically after the End Date (midnight).

## Product order

Default order ("Sort: new & featured"): New Arrival, then Featured, then products with a
Home Collection name, then products with photos, then the rest. Sold-out items go last.
The same order picks the photos for the collage and the occasion circles.

## Featured carousel and paging

The carousel above the catalogue follows the selected category: its Featured
products first, then its New Arrivals. It hides when the category has neither.
The catalogue shows 20 products, then 10 more each time "Show more" is pressed;
any filter, sort, search or category change starts again at 20.

## Occasions

Occasion column: Daily Wear, Work Wear, Party Wear, Celebrity Inspired, Traditional
Wear, Wedding Wear (several allowed, comma separated). Each category shows a row of
occasion circles with counts above its products, (the occasions are filtered from these circles only, not the filter panel). Links can
open on an occasion: `index.html?cat=Saree&occasion=Wedding Wear`.
Each circle shows Photo 1 of a product from that category and occasion (Featured, then
New Arrival, then any with a photo; each circle tries to use a different product).
Nothing to maintain: an occasion with no photos yet shows its coloured icon instead.

## Collage carousel (top of home page)

Up to 5 slides. Every Home Collection name comes first, one slide per name and category
("Festival" on salwars and on kurtis gives two slides; capitals and spaces don't matter).
The remaining places are filled with the biggest sub-categories (at least 3 products),
preferring categories not shown yet. Each slide shows up to four products (Featured,
New Arrival and products with photos first). Change the number of slides with HERO_MAX in app.js.

## "How to order" guide

Three slides (pick a product; order and pay on WhatsApp or Instagram; delivery and
unboxing). It opens by itself once, about 2 seconds into a customer's first visit, but
never on top of a shared product link. "How to order" in the menu opens it again, and
`index.html#how-to-order` links straight to it. The slide text is in `GUIDE` near the
end of `app.js`.

## Messages from a product

"Order on WhatsApp" fills in a message that starts with the product's Photo 1 link
(WhatsApp shows it as a picture preview), then the name, code, price, Colour/Size
lines to fill, and a link back to the product. Instagram DM links cannot carry text,
so "Ask on Instagram" copies the same details and tells the customer to paste them.

## Filter panel

On a computer, "Hide filters" hides the side panel and shows the products in 4 columns;
"Filters" brings it back. Each visitor's choice is remembered. On phones the button opens
the full-screen filter panel as before.

Type, Fabric, Price and Show are collapsible. Type starts open; a group opens by itself
and shows a count badge when something in it is picked.

## Product pages, category pages and Google Shopping feed

On every deploy Netlify runs `build/generate.mjs` (set in `netlify.toml`). It reads the same
Google Sheet and creates:

- `p/<product-name>-<code>.html`: one page per product, so Google can show each product in search
- `sarees.html`, `salwar-suits.html`, ...: one page per category
- `sitemap.xml`: every page, for Google Search Console
- `feed.xml`: product feed for Google Merchant Center (free Shopping listings)

These files are made on Netlify, so they are not in this repo. The home page catalogue stays
live from the sheet; product pages and the feed update on the next deploy: any upload to
GitHub, **Deploys > Trigger deploy** in Netlify, or the automatic weekly rebuild
(`netlify/functions/weekly-rebuild.mjs`, needs the `BUILD_HOOK_URL` environment variable).
If the sheet cannot be read, the build uses `catalogue-backup.csv`.

Prices stay correct without a redeploy: when a product page or category page opens, `app.js`
reads the Google Sheet and updates the price, sale price, Sold out, the offer line and the
WhatsApp order message on the page. Only `feed.xml` (Google Shopping) and the page title Google
saved still wait for the next deploy. If the sheet cannot be reached, the page shows what was built.


## Photos (faster loading, code label hidden)

`CROP_TOP` near the top of the photo section in `app.js` (default 5) trims that % of the height
from the top of every Cloudinary photo, which hides the product code label. Photos are also
sent at the size each screen needs (`c_limit,w_...,f_auto,q_auto`). Your photos in Cloudinary
are not changed. Set `CROP_TOP=0` to show full photos. If a trimmed photo cannot load, the
original is shown. The product page builder reads the same setting. Cloudinary makes each trimmed/resized copy the first time it
is asked for, so on every deploy the builder asks for all of them (sizes 200, 600, 1200). The
Netlify deploy log shows a line "Photos prepared in Cloudinary: ... ready, ... failed".

## Shortlist and floating buttons

Every product has a heart. Saved products appear in a pink "Shortlist" button at the bottom
right; it opens a list with the total and "Send shortlist on WhatsApp" (one message with all
codes, prices and links) or "Send on Instagram" (copies the list). The shortlist is kept only
in the customer's own browser. A green WhatsApp chat button is on every page.

## Orders (private)

Orders are not part of this website. They are kept in a separate private Google Sheet with
its own admin page (Google Apps Script). See the Orders admin folder and its SETUP.txt.

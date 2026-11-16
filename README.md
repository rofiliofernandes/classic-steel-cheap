# Classic Steel — website

Website and private admin panel for Classic Steel (Panzorconi, Cuncolim, Goa), running on Cloudflare Workers with D1 (database) and R2 (photo and video storage).

## What's included

**Public site** (cream / off-white theme, with an optional dark-mode toggle)
- **Home:** hero slideshow, "Why Classic Steel", the product range (categories), a curated project gallery, the video carousel, testimonials and a quote band.
- **Projects** (`/projects`): every published photo, with category filters and a full-screen lightbox. Photos posted together can be stacked into one tile.
- **Contact** (`/contact`): the Classic Steel enquiry form, which opens WhatsApp with the customer's details already filled in. The page also lists all three phone numbers and the Google Maps location.
- **Video carousel:** swipe to change video, tap to play or pause, with a progress bar. Every video plays from the site's own storage. None of them are embeds.
- **Also on every page:** a WhatsApp chat bubble, a back-to-top button, seasonal festival banners (Diwali, Christmas, New Year, etc.) and SEO metadata.

**Admin** (`/admin`)
- **Dashboard:** visitors, devices, storage use and an activity log.
- **Projects & Curation:** upload photos (they're converted to WebP in the browser), score images automatically without AI, approve or publish, stack photos into one tile, set the focal point and crop for desktop and mobile, and resolve unmatched hashtags.
- **Homepage:** choose the hero photos, the About strip photos and text, and the gallery layout.
- **Festivals:** set the dates for movable festivals.
- **Categories:** Windows, Sliding, Doors, Wood-finish and Large openings. Each category has a description, an image and the Instagram hashtags that map to it.
- **Videos:**
  - **Manual upload:** MP4, MOV or WebM up to 95 MB, with an upload progress bar. A cover image is captured from the video automatically.
  - **Instagram:** syncing **downloads both photos and videos** (Reels, video posts and videos inside carousels) into R2, so they keep playing even if the Instagram link changes. Any download still queued finishes in the background through the twice-daily scheduled job.
  - **Managing videos:** reorder, rename, hide or show, and delete. Deleting a video also removes its file. Deleted Instagram videos aren't downloaded again unless you click "Restore deleted".
- **Testimonials:** add real customer reviews by hand.
- **Admins:** invite other admins by email. The owner can transfer ownership.

Removed from the original platform: Careers, the photography contact form and its message inbox, YouTube, and Google Reviews.

### Starter content
Migration `0038_seed_capital_upvc_content.sql` adds the 32 existing project photos and 15 project videos. These are bundled as static files under `public/projects`, `public/videos` and `public/posters`, so the site looks complete the first time you deploy it. You can hide, edit or delete any of them from the admin panel.

## Deploy (Cloudflare)

1. Install Node.js 20 or later, then run `npm install`.
2. Create the database and storage bucket:
   ```bash
   npx wrangler d1 create capital-upvc-db        # copy the database_id into wrangler.toml
   npx wrangler r2 bucket create capital-upvc-media
   ```
3. Set the secrets:
   ```bash
   npx wrangler secret put SESSION_SECRET         # long random string
   npx wrangler secret put TOKEN_ENCRYPTION_KEY   # a different long random string
   npx wrangler secret put RESEND_API_KEY         # for the admin setup / invite emails
   npx wrangler secret put INSTAGRAM_APP_SECRET
   npx wrangler secret put ADMIN_OWNER_EMAIL      # the email that may create the first Owner account
   ```
4. In `wrangler.toml`, fill in the following:
   - `ADMIN_HOST`: the hostname where you'll open `/admin`. To start, this can be your `*.workers.dev` hostname or the main domain. **The admin panel and its APIs return 404 until this is set.**
   - `RESEND_FROM_EMAIL`: for example, `Classic Steel <admin@yourdomain.com>`, using a domain verified in Resend.
   - `INSTAGRAM_APP_ID` and `INSTAGRAM_REDIRECT_URI`: the redirect URI is `https://<ADMIN_HOST>/api/instagram/callback`.
   - `STORAGE_LIMIT_GB`: optional. The limit is 5 GB of photos plus videos (hard maximum; you can set it lower).
5. Apply the migrations and deploy:
   ```bash
   npm run db:migrate
   npm run deploy
   ```
6. Open `https://<ADMIN_HOST>/admin/setup` and verify the owner email to create the Owner account.
7. Connect Instagram. In **Projects & Curation**, click **Create client link** and open that link while logged in to the Classic Steel Instagram account. Then click **Sync now** in the **Videos** tab.

Optional: once the domain is live, set `PUBLIC_HOST` and `ADMIN_HOST_FRONTEND` at the bottom of `src/main.tsx` to split the public site and the admin onto separate hostnames (for example, `capitalupvc.com` and `admin.capitalupvc.com`).

## Instagram hashtags → categories
When a post is synced, the hashtags in its caption are matched against each category's hashtag list. Example: `#slidingwindow` → **Sliding**.
- **Exactly one category matches:** the photo is published automatically under that category.
- **No match, or more than one:** the photo waits in **Pending** for you to approve.

Instagram videos always appear in the carousel as soon as they've been downloaded. You can hide any of them from the Videos tab.

## Limits worth knowing
- **Manual video uploads:** up to 95 MB each. Cloudflare's request-size limit is 100 MB on the Free and Pro plans. For larger files, compress the video on your phone before uploading.
- **Instagram videos:** downloaded in the background, a few per request. If one fails, it's retried up to 5 times (use **Retry downloads** to reset the count).
- **Business anniversary banner:** off by default. To turn it on, set `ANNIVERSARY` near `FESTIVAL_COPY` in `src/worker.ts`.

## Local development
```bash
cp .dev.vars.example .dev.vars   # then edit
npm run dev                       # applies local D1 migrations, then starts Vite + the Worker
```

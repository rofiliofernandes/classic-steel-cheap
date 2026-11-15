# Classic Steel — website and admin system

A new, independent Classic Steel project adapted from the Impression Photography V13 application architecture and admin experience. The public site is being reworked for SS railing, MS fabrication, gates and grills, safety doors, roof sheds, aluminium windows, glass work and custom fabrication.

## Included foundation
- React + Vite frontend and Hono Cloudflare Worker API
- Cloudflare D1 database and R2 media storage
- Private admin login, first Owner setup by email verification, invitations and role management
- Dashboard, project/media gallery, homepage content controls, services/categories, video/social media modules, customer enquiries, testimonials, analytics and activity history
- Dark/light admin theme and responsive layout
- Careers/recruitment functionality is intentionally excluded from the Classic Steel interface

## Before deployment
1. Create a NEW Cloudflare D1 database and update `database_id` in `wrangler.toml`. Do not use the Impression Photography database.
2. Create a NEW R2 bucket named `classic-steel-media` or update the binding.
3. Configure the actual client domain and management hostname; replace `classicsteel.example`.
4. Set `PHONE`, `MAPS_URL`, `ADMIN_OWNER_EMAIL`, `RESEND_FROM_EMAIL` and required secrets in Cloudflare.
5. Configure `RESEND_API_KEY`, `SESSION_SECRET`, and `TOKEN_ENCRYPTION_KEY` as Worker secrets. Do not reuse Impression Photography credentials.
6. Review/seed the business services and replace demo photography assets with client-approved fabrication photographs.
7. Run `npm ci`, `npm run db:migrate`, `npm run build`, then `npm run deploy`.

## Important
This is an adaptation starter, not a production deployment. The actual business phone, address, email, domain, logo, maps URL, approved portfolio images and social accounts were not supplied, so they are deliberately left for client configuration. The original V13 database ID and business credentials must not be reused.

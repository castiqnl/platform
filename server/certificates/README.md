Supabase database root CA, downloaded over HTTPS from the URL used by the official Supabase Studio on 22 November 2026:
https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

Source: https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json (`ssl:certificate_url`, prod environment).

PEM SHA-256: `700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7`.
Certificate fingerprint SHA-256: `807025AD50D4ED219D2C9C7D299C004F824EB00CF7F65AFEF607D07B72E6CAFA`.

This public trust anchor is not a secret. `DATABASE_URL` uses `sslmode=verify-full&sslrootcert=server/certificates/supabase-root-2021.crt`. Never disable certificate/hostname checks. Rotate this file through a reviewed release when Supabase changes its authority.

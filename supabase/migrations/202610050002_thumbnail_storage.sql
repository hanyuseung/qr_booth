-- Public image reads; no client write policy. Verified admin Edge Functions
-- upload/remove using the service role after validating WebP bytes and size.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('booth-thumbnails', 'booth-thumbnails', true, 262144, array['image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

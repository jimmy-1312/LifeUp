-- Run as the database owner after adding backgrounds.
insert into public.background_catalog (id, reward_type) values
  ('Blue_archive.gif', 'gif'),
  ('cat_in_eldenring.jpg', 'image'),
  ('cat_in_minecraft.jpg', 'image'),
  ('cyberpunk', 'image'),
  ('eyes.gif', 'gif'),
  ('knave.gif', 'gif'),
  ('snow-mountain', 'image'),
  ('spiderman_fall.jpg', 'image'),
  ('spiderman_post.jpg', 'image'),
  ('stars.jpg', 'image'),
  ('study.jpg', 'image'),
  ('wukong', 'gif')
on conflict (id) do update set reward_type = excluded.reward_type;

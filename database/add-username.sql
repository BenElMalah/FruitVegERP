-- Add username to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- Populate existing users with username from email
UPDATE public.profiles SET username = SPLIT_PART(email, '@', 1) WHERE username IS NULL;

-- Make username required for new users (after existing ones are set)
-- ALTER TABLE public.profiles ALTER COLUMN username SET NOT NULL;

SELECT pg_notify('pgrst', 'reload schema');

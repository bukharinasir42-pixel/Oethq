-- Add unique constraint on blog titles to prevent duplicates
ALTER TABLE "Blog" ADD CONSTRAINT "Blog_title_key" UNIQUE ("title");

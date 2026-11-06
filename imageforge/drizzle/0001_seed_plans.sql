INSERT INTO "plans" ("id", "name", "daily_quota", "monthly_quota", "max_images_per_request", "active")
VALUES ('free', 'Free', 25, 300, 4, true), ('pro', 'Pro', 200, 5000, 4, true)
ON CONFLICT ("id") DO NOTHING;

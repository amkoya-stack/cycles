-- Seed test chamas for development
-- This creates sample public chamas with tags for testing the browsing feature

-- Insert test chamas
INSERT INTO chamas (
  name,
  description,
  admin_user_id,
  contribution_amount,
  contribution_frequency,
  target_amount,
  max_members,
  settings,
  status,
  activity_score,
  roi
) VALUES
-- Chama 1: High-performing savings group
(
  'Smart Farmers Circle',
  'Agricultural cooperative supporting local farmers with micro-loans and group savings',
  (SELECT id FROM users LIMIT 1), -- Get first user as admin
  1000,
  'monthly',
  100000,
  50,
  '{"type": "savings", "visibility": "public", "lending_enabled": true, "tags": ["savings", "lender", "public", "monthly", "high-returns", "most-active"]}',
  'active',
  95,
  12.5
),
-- Chama 2: Investment focused group
(
  'Tech Entrepreneurs Hub',
  'Supporting tech startups through collective investment and networking opportunities',
  (SELECT id FROM users LIMIT 1),
  5000,
  'monthly',
  500000,
  30,
  '{"type": "investment", "visibility": "public", "lending_enabled": true, "tags": ["investment", "lender", "public", "monthly", "high-returns", "top-rated"]}',
  'active',
  92,
  18.0
),
-- Chama 3: Women-only savings group
(
  'Women Empowerment Fund',
  'Exclusive women''s savings group focused on financial independence and mutual support',
  (SELECT id FROM users LIMIT 1),
  2000,
  'weekly',
  200000,
  40,
  '{"type": "savings", "visibility": "public", "genderRestriction": "women", "lending_enabled": false, "tags": ["savings", "savings-only", "public", "weekly", "women", "most-active"]}',
  'active',
  88,
  0
),
-- Chama 4: Rotating savings (merry-go-round)
(
  'Monthly Boost Circle',
  'Rotating savings where members take turns receiving the pooled funds',
  (SELECT id FROM users LIMIT 1),
  3000,
  'monthly',
  150000,
  15,
  '{"type": "merry-go-round", "visibility": "public", "lending_enabled": false, "tags": ["merry-go-round", "rotating-buy", "savings-only", "public", "monthly", "top-rated"]}',
  'active',
  90,
  0
),
-- Chama 5: Private lending group
(
  'Teachers Welfare Society',
  'Private group for teachers offering emergency loans and savings',
  (SELECT id FROM users LIMIT 1),
  1500,
  'monthly',
  80000,
  25,
  '{"type": "lending", "visibility": "private", "lending_enabled": true, "tags": ["lending", "lender", "private", "monthly"]}',
  'active',
  78,
  10.0
),
-- Chama 6: Daily contributions
(
  'Jua Kali Daily Savers',
  'Informal sector workers saving daily for better financial stability',
  (SELECT id FROM users LIMIT 1),
  100,
  'custom',
  20000,
  60,
  '{"type": "savings", "visibility": "public", "frequency": "daily", "lending_enabled": false, "tags": ["savings", "savings-only", "public", "daily", "most-active"]}',
  'active',
  85,
  0
);

-- D3 Restaurant System: Production Seed Data for Cloudflare D1

-- 1. Dining Tables (1 to 10)
INSERT OR IGNORE INTO dining_tables (id, label) VALUES
  (1, 'Table 1'),
  (2, 'Table 2'),
  (3, 'Table 3'),
  (4, 'Table 4'),
  (5, 'Table 5'),
  (6, 'Table 6'),
  (7, 'Table 7'),
  (8, 'Table 8'),
  (9, 'Table 9'),
  (10, 'Table 10'),
  (11, 'Table 11'),
  (12, 'Table 12'),
  (13, 'Table 13'),
  (14, 'Table 14'),
  (15, 'Table 15'),
  (16, 'Table 16');

-- 2. Table QR Codes (qr-table-1 to qr-table-10)
INSERT OR IGNORE INTO table_qr_codes (id, qr_identifier, dining_table_id) VALUES
  (1, 'qr-table-1', 1),
  (2, 'qr-table-2', 2),
  (3, 'qr-table-3', 3),
  (4, 'qr-table-4', 4),
  (5, 'qr-table-5', 5),
  (6, 'qr-table-6', 6),
  (7, 'qr-table-7', 7),
  (8, 'qr-table-8', 8),
  (9, 'qr-table-9', 9),
  (10, 'qr-table-10', 10),
  (11, 'qr-table-11', 11),
  (12, 'qr-table-12', 12),
  (13, 'qr-table-13', 13),
  (14, 'qr-table-14', 14),
  (15, 'qr-table-15', 15),
  (16, 'qr-table-16', 16);

-- 3. Default Staff Admin User (admin / admin12345)
INSERT OR IGNORE INTO staff_users (id, username, password_hash) VALUES
  (1, 'admin', 'scrypt$16384$8$1$b52e527d60dab1e8e0a1bcbf256693a1$6ea13d0083af1b051a3b2865a64458c7e40ad2e22344372dc95ce2faea361f16716b2c81df24388d6d95431590823ad911181128b57c1a0a5242948bc94a686d');

-- 4. Menu Categories
INSERT OR IGNORE INTO menu_categories (id, name, sort_order) VALUES
  (1, 'Starters', 1),
  (2, 'Mains', 2),
  (3, 'Breads', 3),
  (4, 'Beverages', 4),
  (5, 'Desserts', 5);

-- 5. Menu Items (paise prices: 100 paise = 1 INR)
INSERT OR IGNORE INTO menu_items (id, category_id, name, price_paise, is_veg, sort_order) VALUES
  -- Starters
  (1, 1, 'Mix Veg Kulcha', 10900, 1, 1),
  (2, 1, 'Paneer Tikka', 22000, 1, 2),
  (3, 1, 'Crispy Corn', 16000, 1, 3),
  (4, 1, 'Chicken Tikka', 26000, 0, 4),
  (5, 1, 'Chili Chicken', 24000, 0, 5),

  -- Mains
  (6, 2, 'Dal Makhani', 19000, 1, 1),
  (7, 2, 'Paneer Butter Masala', 24000, 1, 2),
  (8, 2, 'Dal Tadka', 15000, 1, 3),
  (9, 2, 'Butter Chicken', 32000, 0, 4),
  (10, 2, 'Chicken Biryani', 28000, 0, 5),

  -- Breads
  (11, 3, 'Butter Naan', 6000, 1, 1),
  (12, 3, 'Garlic Naan', 7500, 1, 2),
  (13, 3, 'Tandoori Roti', 2500, 1, 3),
  (14, 3, 'Laccha Paratha', 5000, 1, 4),

  -- Beverages
  (15, 4, 'Fresh Lime Soda', 6000, 1, 1),
  (16, 4, 'Masala Chai', 3000, 1, 2),
  (17, 4, 'Sweet Lassi', 8000, 1, 3),
  (18, 4, 'Cold Drink', 4000, 1, 4),

  -- Desserts
  (19, 5, 'Gulab Jamun (2 pcs)', 8000, 1, 1),
  (20, 5, 'Vanilla Ice Cream', 7000, 1, 2),
  (21, 5, 'Rasgulla (2 pcs)', 8000, 1, 3);

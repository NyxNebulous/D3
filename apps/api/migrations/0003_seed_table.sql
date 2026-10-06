-- D3 Restaurant System: Seed Additional Tables 17-20 for PostgreSQL

INSERT INTO dining_tables (id, label) VALUES
  (17, 'Table 17'),
  (18, 'Table 18'),
  (19, 'Table 19'),
  (20, 'Table 20')
ON CONFLICT (id) DO NOTHING;

INSERT INTO table_qr_codes (id, qr_identifier, dining_table_id) VALUES
  (17, 'qr-table-17', 17),
  (18, 'qr-table-18', 18),
  (19, 'qr-table-19', 19),
  (20, 'qr-table-20', 20)
ON CONFLICT (id) DO NOTHING;

-- Synchronize sequences with explicit IDs
SELECT setval(pg_get_serial_sequence('dining_tables', 'id'), COALESCE((SELECT MAX(id) FROM dining_tables), 1));
SELECT setval(pg_get_serial_sequence('table_qr_codes', 'id'), COALESCE((SELECT MAX(id) FROM table_qr_codes), 1));

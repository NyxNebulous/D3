INSERT OR IGNORE INTO dining_tables (id, label) VALUES
  (17, 'Table 17'),
  (18, 'Table 18'),
  (19, 'Table 19'),
  (20, 'Table 20');

INSERT OR IGNORE INTO table_qr_codes (id, qr_identifier, dining_table_id) VALUES
  (17, 'qr-table-17', 17),
  (18, 'qr-table-18', 18),
  (19, 'qr-table-19', 19),
  (20, 'qr-table-20', 20);

-- Sample budget for local development: `bun run --cwd apps/web db:seed`.
DELETE FROM transactions;
DELETE FROM assignments;
DELETE FROM categories;
DELETE FROM category_groups;
DELETE FROM accounts;

INSERT INTO accounts (id, name, kind) VALUES
  ('illimity', 'Illimity', 'checking'),
  ('tinaba', 'Tinaba', 'savings'),
  ('revolut', 'Revolut', 'card'),
  ('monzo', 'Monzo', 'card');

INSERT INTO category_groups (id, name, position) VALUES
  ('savings-goals', 'Savings Goals', 0),
  ('bills', 'Bills', 1),
  ('entertainment', 'Entertainment', 2);

INSERT INTO categories (id, group_id, name, position, target_kind, target_amount, target_by) VALUES
  ('home-improvement', 'savings-goals', 'Home Improvement', 0, NULL, NULL, NULL),
  ('work-replacement', 'savings-goals', '6 Months Work Replacement', 1, 'savings', 750000, NULL),
  ('experiences', 'savings-goals', 'Experiences', 2, 'savings', 300000, '2026-12'),
  ('rent', 'bills', 'Rent', 0, 'monthly', 45000, NULL),
  ('home-maintenance', 'bills', 'Home Maintenance', 1, 'monthly', 27785, NULL),
  ('energy', 'bills', 'Energy', 2, 'monthly', 6200, NULL),
  ('internet', 'bills', 'Internet', 3, 'monthly', 1000, NULL),
  ('fuel', 'bills', 'Fuel', 4, 'monthly', 6000, NULL),
  ('eating-out', 'entertainment', 'Eating Out', 0, 'monthly', 12000, NULL),
  ('new-stuff', 'entertainment', 'New Stuff', 1, NULL, NULL, NULL),
  ('haircuts', 'entertainment', 'Haircuts', 2, 'monthly', 3000, NULL);

INSERT INTO assignments (category_id, month, amount) VALUES
  ('rent', '2026-08', 45000), ('eating-out', '2026-08', 12000), ('energy', '2026-08', 6200), ('fuel', '2026-08', 6000),
  ('rent', '2026-09', 45000), ('eating-out', '2026-09', 15000), ('energy', '2026-09', 6200), ('fuel', '2026-09', 6000),
  ('work-replacement', '2026-09', 750000), ('experiences', '2026-09', 240000), ('home-maintenance', '2026-09', 24785),
  ('rent', '2026-10', 0), ('energy', '2026-10', 6200), ('internet', '2026-10', 500), ('fuel', '2026-10', 4000),
  ('eating-out', '2026-10', 12000), ('new-stuff', '2026-10', 6000), ('haircuts', '2026-10', 3000);

INSERT INTO transactions (id, account_id, date, payee, memo, amount, category_id, cleared, transfer_account_id) VALUES
  ('t01', 'tinaba', '2026-08-27', 'Studio Rossi', 'August', 325000, 'ready-to-assign', 'reconciled', NULL),
  ('t02', 'illimity', '2026-08-02', 'Silvano Gambini', 'Rent', -45000, 'rent', 'reconciled', NULL),
  ('t03', 'revolut', '2026-08-14', 'Coop', NULL, -9800, 'eating-out', 'reconciled', NULL),
  ('t04', 'revolut', '2026-08-20', 'Enel', NULL, -6200, 'energy', 'reconciled', NULL),
  ('t05', 'tinaba', '2026-09-26', 'Studio Rossi', 'September', 325000, 'ready-to-assign', 'reconciled', NULL),
  ('t06', 'illimity', '2026-09-02', 'Silvano Gambini', 'Rent', -45000, 'rent', 'reconciled', NULL),
  ('t07', 'revolut', '2026-09-12', 'Coop', NULL, -14100, 'eating-out', 'cleared', NULL),
  ('t08', 'revolut', '2026-09-19', 'Bancomat', NULL, -5200, 'fuel', 'cleared', NULL),
  ('t09', 'illimity', '2026-09-01', 'Opening balance', NULL, 4096433, 'ready-to-assign', 'reconciled', NULL),
  ('t10', 'tinaba', '2026-10-27', 'Studio Rossi', 'October', 325000, 'ready-to-assign', 'cleared', NULL),
  ('t11', 'illimity', '2026-10-27', 'Associazione Intento', NULL, -42000, 'experiences', 'cleared', NULL),
  ('t12', 'revolut', '2026-10-04', 'Coop', 'weekly shop', -4227, 'eating-out', 'cleared', NULL),
  ('t13', 'revolut', '2026-10-09', 'KFC', NULL, -1930, 'eating-out', 'uncleared', NULL),
  ('t14', 'revolut', '2026-10-18', 'Trattoria da Gino', NULL, -11083, 'eating-out', 'cleared', NULL),
  ('t15', 'revolut', '2026-10-15', 'Bancomat', NULL, -3500, 'fuel', 'cleared', NULL),
  ('t16', 'revolut', '2026-10-16', 'Barbiere', NULL, -1500, 'haircuts', 'cleared', NULL),
  ('t17', 'revolut', '2026-10-21', 'OBI', 'chiavi palazzuolo', -650, 'new-stuff', 'cleared', NULL),
  ('t18', 'revolut', '2026-10-29', 'EasyPark', NULL, -199, NULL, 'uncleared', NULL),
  ('t19', 'illimity', '2026-10-30', 'Transfer to Revolut', NULL, -10000, NULL, 'cleared', 'revolut'),
  ('t20', 'revolut', '2026-10-30', 'Transfer from Illimity', NULL, 10000, NULL, 'cleared', 'illimity');

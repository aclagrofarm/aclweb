-- Draft branch directory seed data.
-- These records are unpublished until ACL Agro Farm verifies each location.

INSERT INTO provinces (name, code) VALUES
  ('Koshi Province', 'KOSHI'),
  ('Madhesh Province', 'MADHESH'),
  ('Bagmati Province', 'BAGMATI'),
  ('Gandaki Province', 'GANDAKI'),
  ('Lumbini Province', 'LUMBINI'),
  ('Karnali Province', 'KARNALI'),
  ('Sudurpashchim Province', 'SUDURPASHCHIM')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO districts (province_id, name, code)
SELECT p.id, x.name, x.code
FROM (VALUES
  ('KOSHI', 'Morang', 'MOR'),
  ('KOSHI', 'Jhapa', 'JHA'),
  ('KOSHI', 'Sunsari', 'SUN'),
  ('MADHESH', 'Dhanusha', 'DHA'),
  ('MADHESH', 'Parsa', 'PAR'),
  ('MADHESH', 'Saptari', 'SAP'),
  ('BAGMATI', 'Kathmandu', 'KTM'),
  ('BAGMATI', 'Lalitpur', 'LAL'),
  ('BAGMATI', 'Chitwan', 'CHI'),
  ('BAGMATI', 'Kavrepalanchok', 'KAV'),
  ('GANDAKI', 'Kaski', 'KAS'),
  ('GANDAKI', 'Tanahun', 'TAN'),
  ('LUMBINI', 'Rupandehi', 'RUP'),
  ('LUMBINI', 'Banke', 'BAN'),
  ('LUMBINI', 'Dang', 'DAN'),
  ('KARNALI', 'Surkhet', 'SUR'),
  ('KARNALI', 'Dailekh', 'DAI'),
  ('SUDURPASHCHIM', 'Kailali', 'KAI'),
  ('SUDURPASHCHIM', 'Kanchanpur', 'KAN'),
  ('SUDURPASHCHIM', 'Doti', 'DOT')
) AS x(province_code, name, code)
JOIN provinces p ON p.code = x.province_code
ON CONFLICT (province_id, code) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO municipalities (district_id, name, local_type)
SELECT d.id, x.municipality, x.local_type
FROM (VALUES
  ('MOR', 'Biratnagar Metropolitan City', 'metropolitan'),
  ('JHA', 'Bhadrapur Municipality', 'municipality'),
  ('SUN', 'Itahari Sub-Metropolitan City', 'sub_metropolitan'),
  ('DHA', 'Janakpurdham Sub-Metropolitan City', 'sub_metropolitan'),
  ('PAR', 'Birgunj Metropolitan City', 'metropolitan'),
  ('SAP', 'Rajbiraj Municipality', 'municipality'),
  ('KTM', 'Kathmandu Metropolitan City', 'metropolitan'),
  ('LAL', 'Lalitpur Metropolitan City', 'metropolitan'),
  ('CHI', 'Bharatpur Metropolitan City', 'metropolitan'),
  ('KAV', 'Dhulikhel Municipality', 'municipality'),
  ('KAS', 'Pokhara Metropolitan City', 'metropolitan'),
  ('TAN', 'Byas Municipality', 'municipality'),
  ('RUP', 'Butwal Sub-Metropolitan City', 'sub_metropolitan'),
  ('BAN', 'Nepalgunj Sub-Metropolitan City', 'sub_metropolitan'),
  ('DAN', 'Ghorahi Sub-Metropolitan City', 'sub_metropolitan'),
  ('SUR', 'Birendranagar Municipality', 'municipality'),
  ('DAI', 'Dullu Municipality', 'municipality'),
  ('KAI', 'Dhangadhi Sub-Metropolitan City', 'sub_metropolitan'),
  ('KAN', 'Bhimdatta Municipality', 'municipality'),
  ('DOT', 'Dipayal Silgadhi Municipality', 'municipality')
) AS x(district_code, municipality, local_type)
JOIN districts d ON d.code = x.district_code
ON CONFLICT (district_id, name) DO UPDATE SET local_type = EXCLUDED.local_type;

INSERT INTO wards (municipality_id, ward_number)
SELECT m.id, x.ward_number
FROM (VALUES
  ('Biratnagar Metropolitan City', 4),
  ('Bhadrapur Municipality', 5),
  ('Itahari Sub-Metropolitan City', 6),
  ('Janakpurdham Sub-Metropolitan City', 8),
  ('Birgunj Metropolitan City', 10),
  ('Rajbiraj Municipality', 5),
  ('Kathmandu Metropolitan City', 32),
  ('Lalitpur Metropolitan City', 3),
  ('Bharatpur Metropolitan City', 10),
  ('Dhulikhel Municipality', 7),
  ('Pokhara Metropolitan City', 17),
  ('Byas Municipality', 3),
  ('Butwal Sub-Metropolitan City', 8),
  ('Nepalgunj Sub-Metropolitan City', 4),
  ('Ghorahi Sub-Metropolitan City', 15),
  ('Birendranagar Municipality', 6),
  ('Dullu Municipality', 9),
  ('Dhangadhi Sub-Metropolitan City', 4),
  ('Bhimdatta Municipality', 4),
  ('Dipayal Silgadhi Municipality', 4)
) AS x(municipality, ward_number)
JOIN municipalities m ON m.name = x.municipality
ON CONFLICT (municipality_id, ward_number) DO NOTHING;

INSERT INTO branches (
  branch_code, branch_name, branch_type, province_id, district_id, municipality_id,
  ward_id, full_address, status, is_published
)
SELECT x.branch_code, x.branch_name, 'provincial', p.id, d.id, m.id, w.id,
       x.address, 'planned', FALSE
FROM (VALUES
  ('ACL01', 'ACL Agro Farm Biratnagar Branch', 'KOSHI', 'MOR', 'Biratnagar Metropolitan City', 4, 'Ward 4, Biratnagar Metropolitan City, Morang'),
  ('ACL02', 'ACL Agro Farm Bhadrapur Branch', 'KOSHI', 'JHA', 'Bhadrapur Municipality', 5, 'Ward 5, Bhadrapur Municipality, Jhapa'),
  ('ACL03', 'ACL Agro Farm Itahari Branch', 'KOSHI', 'SUN', 'Itahari Sub-Metropolitan City', 6, 'Ward 6, Itahari Sub-Metropolitan City, Sunsari'),
  ('ACL04', 'ACL Agro Farm Janakpur Branch', 'MADHESH', 'DHA', 'Janakpurdham Sub-Metropolitan City', 8, 'Ward 8, Janakpurdham Sub-Metropolitan City, Dhanusha'),
  ('ACL05', 'ACL Agro Farm Birgunj Branch', 'MADHESH', 'PAR', 'Birgunj Metropolitan City', 10, 'Ward 10, Birgunj Metropolitan City, Parsa'),
  ('ACL06', 'ACL Agro Farm Rajbiraj Branch', 'MADHESH', 'SAP', 'Rajbiraj Municipality', 5, 'Ward 5, Rajbiraj Municipality, Saptari'),
  ('ACL07', 'ACL Agro Farm Kathmandu Branch', 'BAGMATI', 'KTM', 'Kathmandu Metropolitan City', 32, 'Ward 32, Kathmandu Metropolitan City, Kathmandu'),
  ('ACL08', 'ACL Agro Farm Lalitpur Branch', 'BAGMATI', 'LAL', 'Lalitpur Metropolitan City', 3, 'Ward 3, Lalitpur Metropolitan City, Lalitpur'),
  ('ACL09', 'ACL Agro Farm Bharatpur Branch', 'BAGMATI', 'CHI', 'Bharatpur Metropolitan City', 10, 'Ward 10, Bharatpur Metropolitan City, Chitwan'),
  ('ACL10', 'ACL Agro Farm Dhulikhel Branch', 'BAGMATI', 'KAV', 'Dhulikhel Municipality', 7, 'Ward 7, Dhulikhel Municipality, Kavrepalanchok'),
  ('ACL11', 'ACL Agro Farm Pokhara Branch', 'GANDAKI', 'KAS', 'Pokhara Metropolitan City', 17, 'Ward 17, Pokhara Metropolitan City, Kaski'),
  ('ACL12', 'ACL Agro Farm Damauli Branch', 'GANDAKI', 'TAN', 'Byas Municipality', 3, 'Ward 3, Byas Municipality, Tanahun'),
  ('ACL13', 'ACL Agro Farm Butwal Branch', 'LUMBINI', 'RUP', 'Butwal Sub-Metropolitan City', 8, 'Ward 8, Butwal Sub-Metropolitan City, Rupandehi'),
  ('ACL14', 'ACL Agro Farm Nepalgunj Branch', 'LUMBINI', 'BAN', 'Nepalgunj Sub-Metropolitan City', 4, 'Ward 4, Nepalgunj Sub-Metropolitan City, Banke'),
  ('ACL15', 'ACL Agro Farm Ghorahi Branch', 'LUMBINI', 'DAN', 'Ghorahi Sub-Metropolitan City', 15, 'Ward 15, Ghorahi Sub-Metropolitan City, Dang'),
  ('ACL16', 'ACL Agro Farm Birendranagar Branch', 'KARNALI', 'SUR', 'Birendranagar Municipality', 6, 'Ward 6, Birendranagar Municipality, Surkhet'),
  ('ACL17', 'ACL Agro Farm Dullu Branch', 'KARNALI', 'DAI', 'Dullu Municipality', 9, 'Ward 9, Dullu Municipality, Dailekh'),
  ('ACL18', 'ACL Agro Farm Dhangadhi Branch', 'SUDURPASHCHIM', 'KAI', 'Dhangadhi Sub-Metropolitan City', 4, 'Ward 4, Dhangadhi Sub-Metropolitan City, Kailali'),
  ('ACL19', 'ACL Agro Farm Mahendranagar Branch', 'SUDURPASHCHIM', 'KAN', 'Bhimdatta Municipality', 4, 'Ward 4, Bhimdatta Municipality, Kanchanpur'),
  ('ACL20', 'ACL Agro Farm Doti Branch', 'SUDURPASHCHIM', 'DOT', 'Dipayal Silgadhi Municipality', 4, 'Ward 4, Dipayal Silgadhi Municipality, Doti')
) AS x(branch_code, branch_name, province_code, district_code, municipality, ward_number, address)
JOIN provinces p ON p.code = x.province_code
JOIN districts d ON d.code = x.district_code AND d.province_id = p.id
JOIN municipalities m ON m.name = x.municipality AND m.district_id = d.id
JOIN wards w ON w.municipality_id = m.id AND w.ward_number = x.ward_number
ON CONFLICT (branch_code) DO UPDATE SET
  branch_name = EXCLUDED.branch_name,
  province_id = EXCLUDED.province_id,
  district_id = EXCLUDED.district_id,
  municipality_id = EXCLUDED.municipality_id,
  ward_id = EXCLUDED.ward_id,
  full_address = EXCLUDED.full_address,
  status = 'planned',
  is_published = FALSE,
  updated_at = NOW();

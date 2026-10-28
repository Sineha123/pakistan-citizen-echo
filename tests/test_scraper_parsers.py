"""
Unit tests for Hyderabad regional scraper parsing, zone detection,
and civic grievance taxonomy. Authored for the scraping ingestion pipeline.
"""
import re
import unittest

ZONE_MAP = {
    "Qasimabad": ["قاسم آباد", "qasimabad", "نسیم نگر", "naseem nagar", "وادھو واہ", "wadhu wah", "sheedi goth", "شیدی گوٹھ"],
    "Latifabad": ["لطیف آباد", "latifabad", "آٹو بھان", "autobahn", "unit 1", "unit 2", "unit 7", "unit 11", "unit 12"],
    "City / Saddar": ["سٹی", "صدر", "saddar", "city", "پکا قلعہ", "pacca qila", "حیدر چوک", "haider chowk", "ٹھنڈی سڑک", "thandi sarak", "ریلوے اسٹیشن"],
    "Paretabad / Phuleli": ["پریٹ آباد", "paretabad", "پھلیلی", "phuleli", "الی آباد", "پنجرہ پول"],
    "Tando Jam": ["ٹنڈو جام", "tando jam", "زرعی یونیورسٹی", "sindh agriculture university", "tando qaisar"],
    "Kotri / Jamshoro": ["کوٹری", "kotri", "جامشورو", "jamshoro", "کوٹری بیراج", "kotri barrage"]
}

GRIEVANCE_TAXONOMY = {
    "Drinking Water": ["پینے کا پانی", "پانی بند", "فلٹر پلانٹ", "ٹینکر مافیا", "واٹر سپلائی", "clean drinking water"],
    "Roads & Waterlogging": ["سڑک", "روڈ", "پل گر", "پلیا", "کھڈے", "سیوریج", "گٹر", "نکاسی", "پانی جمع", "pothole", "sewage", "wasa"],
    "Power & Electricity": ["بجلی", "حیسکو", "hesco", "ٹرانسفارمر", "لوڈشیڈنگ", "بلیک آؤٹ", "power cut", "outage"],
    "Healthcare": ["ہسپتال", "سول ہسپتال", "لیاقت یونیورسٹی", "luh", "ڈاکٹر", "دوائیں", "ڈینگی", "یرقان", "ایمبولینس"],
    "Sanitation": ["کچرا", "کوڑا کرکٹ", "صفائی", "تعفن", "بلدیہ", "ایچ ایم سی", "hmc", "sswmb"]
}

def detect_district_from_text(text: str) -> str:
    lower = text.lower()
    for zone, keywords in ZONE_MAP.items():
        for kw in keywords:
            if kw.lower() in lower:
                return zone
    return "Hyderabad"

def classify_civic_grievance(text: str):
    lower = text.lower()
    for category, keywords in GRIEVANCE_TAXONOMY.items():
        for kw in keywords:
            if kw.lower() in lower:
                return True, category
    return False, "General"

def sanitize_headline(raw: str) -> str:
    cleaned = re.sub(r'<[^>]+>', '', raw)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    # Strip site branding suffix
    cleaned = re.sub(r'\s*[-|]\s*(Daily Express|Daily Jang|Dawn|Kawish|Express News).*$', '', cleaned, flags=re.IGNORECASE)
    return cleaned

class TestScraperParsers(unittest.TestCase):
    def test_district_detection(self):
        sample1 = "قاسم آباد نسیم نگر میں سیوریج کا پانی جمع، عوام پریشان"
        sample2 = "لطیف آباد یونٹ نمبر 7 میں ٹرانسفارمر جل گیا"
        sample3 = "General provincial budget speech by finance minister"
        
        self.assertEqual(detect_district_from_text(sample1), "Qasimabad")
        self.assertEqual(detect_district_from_text(sample2), "Latifabad")
        self.assertEqual(detect_district_from_text(sample3), "Hyderabad")

    def test_civic_grievance_classification(self):
        text_power = "حیسکو کی جانب سے بغیر اطلاع کے 12 گھنٹے بجلی بند"
        text_water = "شہر میں پینے کا پانی نایاب، شہری فلٹر پلانٹ کے باہر قطار میں کھڑے"
        text_general = "سندھ پریمیئر لیگ کرکٹ ٹورنامنٹ کا کل سے آغاز"

        is_g1, cat1 = classify_civic_grievance(text_power)
        self.assertTrue(is_g1)
        self.assertEqual(cat1, "Power & Electricity")

        is_g2, cat2 = classify_civic_grievance(text_water)
        self.assertTrue(is_g2)
        self.assertEqual(cat2, "Drinking Water")

        is_g3, cat3 = classify_civic_grievance(text_general)
        self.assertFalse(is_g3)
        self.assertEqual(cat3, "General")

    def test_headline_sanitization(self):
        raw_html = "<h1>حیدرآباد کے آٹو بھان روڈ پر سیور لائن پھٹ گئی - Daily Jang</h1>"
        clean = sanitize_headline(raw_html)
        self.assertEqual(clean, "حیدرآباد کے آٹو بھان روڈ پر سیور لائن پھٹ گئی")

if __name__ == "__main__":
    unittest.main()

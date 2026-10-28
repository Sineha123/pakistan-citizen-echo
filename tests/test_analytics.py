"""
Unit tests for Civic Severity Index and Zone Aggregation Math.
Authored for the Geo-Analytics and Severity Scoring engine in Hyderabad, Sindh.
"""
import unittest

def evaluate_civic_severity_mock(item: dict) -> dict:
    text = f"{item.get('title', '')} {item.get('snippet', '')} {item.get('content', '')}".lower()
    district = item.get("district", "Hyderabad").lower()

    base_score = 20
    density_multiplier = 1.0
    hazard_category = "ROUTINE_ADMIN"

    # Infrastructure hazard
    if any(k in text for k in ["موت", "ہلاکت", "dead", "death", "حادثہ", "collapsed", "گر گیا", "پل گر", "ڈوب"]):
        base_score += 50
        hazard_category = "INFRASTRUCTURE_HAZARD"
    elif any(k in text for k in ["سیوریج", "گٹر", "نکاسی", "ڈوب", "پانی جمع", "waterlogging", "wasa", "واسا"]):
        base_score += 30
        hazard_category = "INFRASTRUCTURE_HAZARD"
    elif any(k in text for k in ["ہسپتال", "سول ہسپتال", "لیاقت", "luh", "دوا", "ڈاکٹر", "ڈینگی", "hospital"]):
        base_score += 35
        hazard_category = "PUBLIC_HEALTH_RISK"
    elif any(k in text for k in ["حیسکو", "hesco", "ٹرانسفارمر", "بجلی", "11kv", "power cut", "blackout"]):
        base_score += 25
        hazard_category = "ELECTRICAL_FIRE_DANGER"

    # Zone density weighting
    if "qasimabad" in district or "قاسم آباد" in district:
        density_multiplier = 1.30
    elif "latifabad" in district or "لطیف آباد" in district:
        density_multiplier = 1.25
    elif "paretabad" in district or "پریٹ آباد" in district:
        density_multiplier = 1.18
    elif "tando jam" in district or "ٹنڈو جام" in district:
        density_multiplier = 1.10

    urgency_bias = (item.get("urgency_level", 3) - 3) * 6
    final_score = int(round((base_score * density_multiplier) + urgency_bias))
    final_score = min(99, max(12, final_score))

    if final_score >= 80:
        priority = "CRITICAL_DISASTER"
    elif final_score >= 60:
        priority = "HIGH_ALERT"
    else:
        priority = "STANDARD_RESPONSE"

    return {
        "score": final_score,
        "category": hazard_category,
        "priority": priority,
        "density_multiplier": density_multiplier
    }

class TestAnalyticsEngine(unittest.TestCase):
    def test_critical_infrastructure_hazard(self):
        item = {
            "title": "حیدرآباد کوٹری پل پر ٹریفک حادثہ، پل کا حفاظتی جنگلا ٹوٹ کر دریا میں گر گیا",
            "snippet": "ٹریفک کی روانی معطل، ایمرجنسی ریسکیو ٹیمیں موقع پر پہنچ گئیں",
            "district": "Qasimabad",
            "urgency_level": 5
        }
        result = evaluate_civic_severity_mock(item)
        self.assertGreaterEqual(result["score"], 80)
        self.assertEqual(result["category"], "INFRASTRUCTURE_HAZARD")
        self.assertEqual(result["priority"], "CRITICAL_DISASTER")
        self.assertEqual(result["density_multiplier"], 1.30)

    def test_public_health_risk(self):
        item = {
            "title": "لیاقت یونیورسٹی ہسپتال حیدرآباد میں ڈینگی وارڈ میں ادویات کی شدید قلت",
            "snippet": "مریضوں کے لواحقین کا احتجاج، ایم ایس سے نوٹس لینے کا مطالبہ",
            "district": "Latifabad",
            "urgency_level": 3
        }
        result = evaluate_civic_severity_mock(item)
        self.assertEqual(result["category"], "PUBLIC_HEALTH_RISK")
        self.assertGreaterEqual(result["score"], 60)
        self.assertEqual(result["density_multiplier"], 1.25)

    def test_routine_administration(self):
        item = {
            "title": "ٹنڈو جام زرعی لائبریری کی تزئین و آرائش کے کام کا جائزہ",
            "snippet": "افسران نے پیش رفت رپورٹ کا معائنہ کیا",
            "district": "Tando Jam",
            "urgency_level": 2
        }
        result = evaluate_civic_severity_mock(item)
        self.assertEqual(result["category"], "ROUTINE_ADMIN")
        self.assertEqual(result["priority"], "STANDARD_RESPONSE")
        self.assertLess(result["score"], 40)

if __name__ == "__main__":
    unittest.main()

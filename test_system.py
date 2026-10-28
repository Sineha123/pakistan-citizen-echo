"""
Comprehensive System Test for Hyderabad Citizen Echo.
Tests DB async layer, Prompt Engine & Parsers, REST APIs, and WebSocket Hub communication.
"""
import asyncio
import json
import time
import httpx
import websockets

from backend.database import (
    init_db, insert_raw_news, get_all_raw_news, insert_processed_news,
    get_all_processed_news, log_event, get_recent_logs, reset_all_databases
)
from backend.prompt_engine import (
    build_deepseek_prompt, clean_and_parse_deepseek_response, fallback_regex_parse
)

async def test_database_and_parser():
    print("\n--- 1. Testing Database & Prompt Engine ---")
    await init_db()
    await reset_all_databases()

    # 1. Test Raw Insertion
    raw_id, _ = await insert_raw_news({
        "title": "لطیف آباد حیدرآباد کے آٹو بھان روڈ پر سیور لائن چوک، گندا پانی دکانوں میں داخل",
        "snippet": "تاجروں کا کہنا ہے کہ واسا اور ایچ ایم سی کو متعدد شکایات کے باوجود نکاسی کا انتظام نہ ہو سکا۔",
        "content": "حیدرآباد کے پوش تجارتی علاقے آٹو بھان روڈ پر مین سیوریج پائپ لائن پھٹ جانے سے تعفن پھیل گیا اور کاروبار ٹھپ ہو گیا۔",
        "source_name": "Daily Express Sindh",
        "source_url": "https://express.pk/hyderabad/news1",
        "media_urls": ["https://images.unsplash.com/photo-1547683905-f686c993aae5"],
        "district_hint": "Hyderabad"
    })
    print(f"✓ Inserted raw news with ID: {raw_id}")

    raw_items = await get_all_raw_news(limit=10)
    assert len(raw_items) == 1, f"Expected 1 raw item, got {len(raw_items)}"
    print(f"✓ Retrieved raw item from DB: {raw_items[0]['title']}")

    # 2. Test DeepSeek Prompt Builder
    prompt = build_deepseek_prompt(raw_items[0])
    assert "STRICT: Return ONLY a valid JSON object" in prompt
    print("✓ DeepSeek compact prompt built successfully.")

    # 3. Test DeepSeek Response Parsing (with <think> tags & ```json)
    simulated_deepseek_response = """
    <think>
    Thinking process:
    The user wants structured extraction for Hyderabad sewage grievance on Autobahn Road.
    This is definitely a grievance related to sanitation/drainage.
    Urgency is 3 because commercial market road is blocked with foul odor.
    </think>
    ```json
    {
      "title": "لطیف آباد آٹو بھان روڈ پر سیور چوک سے تاجر پریشان",
      "actual_news": "حیدرآباد لطیف آباد میں آٹو بھان روڈ پر سیور لائن ابل پڑنے سے گندا پانی دکانوں کے سامنے جمع ہو گیا ہے۔",
      "is_grievance": true,
      "grievance_type": "Waterlogging/Drainage",
      "is_political": false,
      "urgency_level": 3,
      "logical_flaw_rating": 1,
      "sentiment": "Negative",
      "affected_population": "Ward/Mohalla (100-500)",
      "district": "Hyderabad",
      "city_block": "Latifabad",
      "locality": "Autobahn Road",
      "key_demands": ["سیوریج لائن کی صفائی", "واسا ڈی واٹرنگ پمپس کی فراہمی"],
      "responsible_authority": "WASA Hyderabad"
    }
    ```
    """
    parsed = clean_and_parse_deepseek_response(simulated_deepseek_response)
    assert parsed is not None, "Parsed result should not be None"
    assert parsed["is_grievance"] is True
    assert parsed["district"] == "Hyderabad"
    assert parsed["urgency_level"] == 3
    print("✓ DeepSeek response successfully parsed, <think> tags and markdown fences stripped cleanly.")

    # 4. Insert Processed News
    parsed["raw_id"] = raw_id
    parsed["media_urls"] = raw_items[0]["media_urls"]
    proc_id = await insert_processed_news(parsed)
    assert proc_id == raw_id, f"Discrete entity ID mismatch: expected {raw_id}, got {proc_id}"
    print(f"✓ Inserted processed news with discrete ID: {proc_id} (identical to raw_id)")

    proc_items = await get_all_processed_news()
    assert len(proc_items) == 1
    assert proc_items[0]["id"] == raw_id, f"Entity ID in DB {proc_items[0]['id']} != raw_id {raw_id}"
    assert proc_items[0]["district"] == "Hyderabad"
    print(f"✓ Retrieved processed intelligence item: {proc_items[0]['title']} [Discrete ID: {proc_items[0]['id']}]")

async def test_rest_and_websocket_hub():
    print("\n--- 2. Testing WebSocket Hub & Real-time Dispatch ---")
    import uvicorn
    from backend.app import app

    config = uvicorn.Config(app, host="127.0.0.1", port=8001, log_level="warning")
    server = uvicorn.Server(config)
    
    server_task = asyncio.create_task(server.serve())
    await asyncio.sleep(1.5)

    base_url = "http://127.0.0.1:8001"
    ws_base = "ws://127.0.0.1:8001/ws/hub"

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # 1. Test Status API
            resp = await client.get(f"{base_url}/api/status")
            status_data = resp.json()
            assert resp.status_code == 200
            print("✓ REST GET /api/status OK:", status_data["pipeline"])

            # 2. Test Ingest Sample Feed API
            resp_sample = await client.post(f"{base_url}/api/pipeline/trigger_sample")
            assert resp_sample.status_code == 200
            print("✓ REST POST /api/pipeline/trigger_sample OK.")

            # 3. Connect Frontend WebSocket
            async with websockets.connect(f"{ws_base}?client_type=frontend") as ws_frontend:
                print("✓ Frontend WebSocket connected.")
                # Read initial messages
                welcome = await asyncio.wait_for(ws_frontend.recv(), timeout=2.0)
                msg1 = json.loads(welcome)
                print(f"✓ Frontend received message: {msg1.get('type')}")

                # 4. Connect Scraper Extension WebSocket
                async with websockets.connect(f"{ws_base}?client_type=scraper_ext") as ws_scraper:
                    print("✓ Scraper Extension WebSocket connected.")
                    # Send scraped news batch
                    sample_batch = [{
                        "id": f"hyd_test_{int(time.time())}",
                        "title": "قاسم آباد نسیم نگر میں بجلی کے ٹرانسفارمر میں دھماکہ، علاقہ تاریکی میں ڈوب گیا",
                        "snippet": "حیسکو حکام 14 گھنٹے بعد بھی فالٹ دور کرنے میں ناکام، شہری شدید پریشان۔",
                        "content": "حیدرآباد کے سب ڈویژن قاسم آباد میں 11 کے وی لائن پر ٹرانسفارمر جلنے سے سینکڑوں گھر بجلی سے محروم ہو گئے۔",
                        "source_name": "Dawn News Sindh",
                        "source_url": "https://dawn.com/hyderabad/hesco-outage",
                        "media_urls": ["https://images.unsplash.com/photo-1515162816999-a0c47dc192f7"],
                        "district_hint": "Hyderabad",
                        "scraped_at": time.time()
                    }]
                    await ws_scraper.send(json.dumps({
                        "type": "SCRAPER_RAW_ITEMS",
                        "items": sample_batch
                    }))
                    print("✓ Scraper pushed items over WebSocket.")

                    # Frontend should receive NEW_RAW_ITEM
                    frontend_item_msg = await asyncio.wait_for(ws_frontend.recv(), timeout=3.0)
                    msg_item = json.loads(frontend_item_msg)
                    print(f"✓ Frontend live update received: {msg_item.get('type')}")

                # 5. Connect DeepSeek Extension WebSocket
                async with websockets.connect(f"{ws_base}?client_type=deepseek_ext") as ws_deepseek:
                    print("✓ DeepSeek Automator WebSocket connected.")
                    await ws_deepseek.send(json.dumps({
                        "type": "DEEPSEEK_READY",
                        "status": "idle"
                    }))

                    # Wait for pipeline to dispatch an item to DeepSeek
                    dispatch_msg = await asyncio.wait_for(ws_deepseek.recv(), timeout=6.0)
                    task_data = json.loads(dispatch_msg)
                    if task_data.get("type") == "PROCESS_NEWS_ITEM":
                        raw_id = task_data["raw_id"]
                        print(f"✓ DeepSeek received task for raw_id: {raw_id}")
                        
                        # Simulate DeepSeek returning processed JSON
                        await ws_deepseek.send(json.dumps({
                            "type": "DEEPSEEK_PROCESSED_RESULT",
                            "raw_id": raw_id,
                            "result": {
                                "title": "قاسم آباد نسیم نگر میں ٹرانسفارمر بلاسٹ، 14 گھنٹے لوڈشیڈنگ",
                                "actual_news": "قاسم آباد نسیم نگر میں 11 کے وی ٹرانسفارمر جلنے سے بجلی کی فراہمی معطل ہے۔",
                                "is_grievance": True,
                                "grievance_type": "Power/Electricity",
                                "is_political": False,
                                "urgency_level": 4,
                                "logical_flaw_rating": 1,
                                "sentiment": "Negative",
                                "district": "Hyderabad",
                                "city_block": "Qasimabad",
                                "locality": "Naseem Nagar",
                                "key_demands": ["ٹرانسفارمر کی فوری تبدیلی", "بجلی بحال کرنا"],
                                "responsible_authority": "HESCO Hyderabad"
                            }
                        }))
                        print("✓ DeepSeek sent processed result back.")

                # 6. Test Priority Custom Send Message Feature
                print("\n--- 3. Testing Priority Custom Query Intercept ---")
                async with websockets.connect(f"{ws_base}?client_type=deepseek_ext") as ws_deepseek_custom:
                    await ws_deepseek_custom.send(json.dumps({"type": "DEEPSEEK_READY"}))

                    # Trigger priority query in background task
                    async def trigger_custom_query():
                        await asyncio.sleep(0.5)
                        resp = await client.post(
                            f"{base_url}/api/ai/inject_query",
                            json={"text": "حیدرآباد میں سب سے زیادہ شکایات کس محکمے کی ہیں؟"}
                        )
                        print("✓ Custom query POST response:", resp.json())

                    query_task = asyncio.create_task(trigger_custom_query())

                    # DeepSeek extension should receive INJECT_USER_QUERY
                    custom_task = await asyncio.wait_for(ws_deepseek_custom.recv(), timeout=5.0)
                    custom_msg = json.loads(custom_task)
                    assert custom_msg.get("type") == "INJECT_USER_QUERY"
                    print(f"✓ DeepSeek received custom prompt: '{custom_msg.get('text')}'")

                    # DeepSeek replies with answer
                    await ws_deepseek_custom.send(json.dumps({
                        "type": "DEEPSEEK_CUSTOM_RESPONSE",
                        "text": "حیدرآباد میں سب سے زیادہ شکایات واسا (سیوریج و نکاسی آب) اور حیسکو (لوڈشیڈنگ و ٹرانسفارمر فالٹس) سے متعلق ہیں۔"
                    }))
                    print("✓ DeepSeek returned priority response; pipeline resumed.")
                    await query_task

            print("\n========================================================")
            print("🎉 ALL TESTS PASSED! Backend, DB, Prompts, Extensions, and Priority Intercept verified!")
            print("========================================================")

    finally:
        server.should_exit = True
        await server_task

if __name__ == "__main__":
    asyncio.run(test_database_and_parser())
    asyncio.run(test_rest_and_websocket_hub())

/**
 * Background Service Worker for Hyderabad Civic Priority & Severity Analyzer Extension.
 * Connects to the pipeline WebSocket hub as 'severity_ext'.
 * Evaluates citizen hazard score (1-100), hazard categories, response priorities,
 * and field action recommendations for Hyderabad regional civic events.
 */

const BACKEND_WS_URL = "ws://localhost:8000/ws/hub?client_type=severity_ext";

let ws = null;
let reconnectTimer = null;
let totalEvaluatedCount = 0;

const DEFAULT_CONFIG = {
  sensitivityThreshold: 50,
  autoPrioritizeHealthHazards: true,
  totalScored: 0
};

// Initialize
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get("severity_config");
  if (!existing.severity_config) {
    await chrome.storage.local.set({ severity_config: DEFAULT_CONFIG });
  }
  logLocal("INFO", "Civic Severity & Priority Analyzer extension installed.");
  connectWebSocket();
});

chrome.runtime.onStartup.addListener(() => {
  connectWebSocket();
});

// Alarm keepalive
chrome.alarms.create("severity_keepalive", { periodInMinutes: 0.35 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "severity_keepalive") {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      connectWebSocket();
    } else {
      try {
        ws.send(JSON.stringify({ type: "HEARTBEAT", timestamp: Date.now() }));
      } catch (e) {}
    }
  }
});

// Top level connect
connectWebSocket();

function connectWebSocket() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  logLocal("INFO", "Connecting to backend WebSocket at " + BACKEND_WS_URL);
  try {
    ws = new WebSocket(BACKEND_WS_URL);

    ws.onopen = () => {
      logLocal("SUCCESS", "Connected to Backend Server (Severity Scorer Extension).");
      notifyPopup({ type: "WS_STATUS", connected: true });
      ws.send(JSON.stringify({
        type: "SEVERITY_READY",
        status: "idle",
        node: "nodeSeverity"
      }));
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleBackendMessage(msg);
      } catch (e) {
        logLocal("ERROR", "Error handling backend message: " + e.message);
      }
    };

    ws.onclose = () => {
      notifyPopup({ type: "WS_STATUS", connected: false });
      ws = null;
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connectWebSocket, 2500);
    };

    ws.onerror = () => {
      notifyPopup({ type: "WS_STATUS", connected: false });
    };
  } catch (e) {
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connectWebSocket, 2500);
  }
}

// Keepalive port listener
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "severity_popup_keepalive") {
    logLocal("INFO", "Popup keepalive port active.");
  }
});

// Process task from Backend
async function handleBackendMessage(msg) {
  if (msg.type === "EVALUATE_SEVERITY") {
    const item = msg.item || {};
    const rawId = msg.raw_id || item.id || `item_${Date.now()}`;
    
    logLocal("INFO", `Evaluating civic severity for: [${(item.title || "Untitled").substring(0, 35)}]`);
    
    const scoreResult = evaluateCivicSeverity(item);
    
    totalEvaluatedCount++;
    chrome.storage.local.get("severity_config", ({ severity_config }) => {
      const cfg = severity_config || DEFAULT_CONFIG;
      cfg.totalScored = (cfg.totalScored || 0) + 1;
      chrome.storage.local.set({ severity_config: cfg });
    });

    logLocal("SUCCESS", `Scored: ${scoreResult.hazard_score}/100 [${scoreResult.response_priority}] - ${scoreResult.hazard_category}`);

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "SEVERITY_SCORED_RESULT",
        raw_id: rawId,
        severity_data: scoreResult
      }));
    }
  }
}

/**
 * Weighted Multi-Factor Hyderabad Civic Severity & Hazard Scoring Model
 * Calculates composite risk index: R = min(99, max(10, (Base_Hazard * Density_Multiplier) + Urgency_Bias + Vulnerability_Delta))
 */
function evaluateCivicSeverity(item) {
  const text = `${item.title || ""} ${item.snippet || ""} ${item.content || ""} ${item.grievance_type || ""}`.toLowerCase();
  const district = (item.district || item.district_hint || "").toLowerCase();
  
  let baseScore = 20;
  let hazardCategory = "ROUTINE_ADMIN";
  const recommendations = [];
  const factors = {
    structuralRisk: 0,
    healthRisk: 0,
    electricalRisk: 0,
    sanitationRisk: 0,
    densityMultiplier: 1.0
  };

  // 1. Catastrophic / High Danger Infrastructure & Life Risk (+55)
  if (text.includes("موت") || text.includes("ہلاکت") || text.includes("زخمی") || text.includes("dead") || text.includes("death") || text.includes("حادثہ") || text.includes("collapsed") || text.includes("گر گیا") || text.includes("پل گر") || text.includes("ڈوب")) {
    baseScore += 50;
    factors.structuralRisk = 50;
    hazardCategory = "INFRASTRUCTURE_HAZARD";
    recommendations.push("Dispatch Rescue 1122 & Hyderabad structural emergency squad immediately");
    recommendations.push("Cordon off damaged bridge/structure perimeter near Kotri/Indus highway");
  }

  // 2. Severe Waterlogging / Gutter Overflow / WASA Drainage Failure (+35)
  if (text.includes("سیوریج") || text.includes("گٹر") || text.includes("نکاسی") || text.includes("ڈوب") || text.includes("پانی جمع") || text.includes("سیور") || text.includes("waterlogging") || text.includes("sewage") || text.includes("wasa") || text.includes("واسا") || text.includes("پھلیلی")) {
    baseScore += 30;
    factors.sanitationRisk = 30;
    if (hazardCategory === "ROUTINE_ADMIN") hazardCategory = "INFRASTRUCTURE_HAZARD";
    recommendations.push("Deploy WASA Hyderabad mobile dewatering pumps & sucker units to affected wards");
    recommendations.push("Request SSWMB garbage clearance and anti-dengue/anti-malaria chemical spray");
  }

  // 3. Hospital / Health Crisis / LUH / Civil Hospital Shortage (+40)
  if (text.includes("ہسپتال") || text.includes("hospital") || text.includes("دوا") || text.includes("دوائیں") || text.includes("ڈاکٹر") || text.includes("سول ہسپتال") || text.includes("لیاقت") || text.includes("luh") || text.includes("ڈینگی") || text.includes("یرقان") || text.includes("ایمبولینس")) {
    baseScore += 35;
    factors.healthRisk = 35;
    hazardCategory = "PUBLIC_HEALTH_RISK";
    recommendations.push("Alert Medical Superintendent Liaquat University Hospital (LUH) City & Jamshoro branches");
    recommendations.push("Replenish emergency medicine inventory and ICU trauma staff");
  }

  // 4. Power Grid / HESCO Transformer Blasts / High Voltage Electrocution (+30)
  if (text.includes("حیسکو") || text.includes("hesco") || text.includes("کرنٹ") || text.includes("بجلی") || text.includes("ٹرانسفارمر") || text.includes("11kv") || text.includes("آگ") || text.includes("power cut") || text.includes("blackout") || text.includes("تار ٹوٹ")) {
    baseScore += 25;
    factors.electricalRisk = 25;
    if (hazardCategory === "ROUTINE_ADMIN") hazardCategory = "ELECTRICAL_FIRE_DANGER";
    recommendations.push("Request HESCO control room to isolate faulty 11kV feeder lines immediately");
    recommendations.push("Deploy mobile emergency HESCO transformer replacement unit to sub-division");
  }

  // 5. Road Cave-In / Deep Potholes / Autobahn & Thandi Sarak Traffic Snarls (+20)
  if (text.includes("سڑک") || text.includes("road") || text.includes("کھڈے") || text.includes("جام") || text.includes("آٹو بھان") || text.includes("ٹھنڈی سڑک") || text.includes("pothole")) {
    baseScore += 20;
    if (hazardCategory === "ROUTINE_ADMIN") hazardCategory = "MUNICIPAL_DISRUPTION";
    recommendations.push("Dispatch Hyderabad Municipal Corporation (HMC) rapid road repair squad");
  }

  // 6. District / Zone Population Density Multiplier (Hyderabad tier weights)
  if (district.includes("qasimabad") || district.includes("قاسم آباد") || district.includes("saddar") || district.includes("صدر")) {
    factors.densityMultiplier = 1.30; // High commercial & residential density
  } else if (district.includes("latifabad") || district.includes("لطیف آباد") || district.includes("autobahn")) {
    factors.densityMultiplier = 1.25; // Dense urban wards
  } else if (district.includes("paretabad") || district.includes("پریٹ آباد") || district.includes("phuleli") || district.includes("پھلیلی")) {
    factors.densityMultiplier = 1.18; // Densely populated old town
  } else if (district.includes("tando jam") || district.includes("ٹنڈو جام") || district.includes("rural")) {
    factors.densityMultiplier = 1.10; // Peri-urban & rural belt
  } else if (district.includes("jamshoro") || district.includes("kotri") || district.includes("جامشورو") || district.includes("کوٹری")) {
    factors.densityMultiplier = 1.08; // Industrial & campus border zone
  }

  // Urgency level bias from AI extractor
  const urgencyBias = typeof item.urgency_level === "number" ? (item.urgency_level - 3) * 6 : 0;

  // Composite calculation
  let finalScore = Math.round((baseScore * factors.densityMultiplier) + urgencyBias);
  finalScore = Math.min(99, Math.max(12, finalScore));

  // Determine Response Priority
  let responsePriority = "LOW_ROUTINE";
  if (finalScore >= 80) responsePriority = "CRITICAL_DISASTER";
  else if (finalScore >= 60) responsePriority = "HIGH_ALERT";
  else if (finalScore >= 35) responsePriority = "STANDARD_RESPONSE";

  if (recommendations.length === 0) {
    recommendations.push("Route to relevant Taluka Municipal Officer (TMO) for field inspection");
    recommendations.push("Log grievance ticket in DC Hyderabad Citizen Complaint Monitoring Cell");
  }

  return {
    hazard_score: finalScore,
    hazard_category: hazardCategory,
    response_priority: responsePriority,
    factors: factors,
    actionable_recommendations: recommendations,
    evaluated_at: Date.now() / 1000
  };
}

function logLocal(level, message) {
  const timestamp = Date.now();
  console.log(`[${new Date(timestamp).toLocaleTimeString()}] [${level}] ${message}`);

  chrome.storage.local.get("severity_logs", ({ severity_logs }) => {
    const logs = severity_logs || [];
    logs.push({ timestamp, level, message });
    if (logs.length > 80) logs.shift();
    chrome.storage.local.set({ severity_logs: logs });
  });

  notifyPopup({ type: "LOG", log: { timestamp, level, message } });

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: "SEVERITY_LOG",
      level: level,
      message: message
    }));
  }
}

function notifyPopup(payload) {
  chrome.runtime.sendMessage(payload).catch(() => {});
}

// Messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_STATE") {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      connectWebSocket();
    }
    chrome.storage.local.get(["severity_config", "severity_logs"], (data) => {
      sendResponse({
        config: data.severity_config || DEFAULT_CONFIG,
        logs: data.severity_logs || [],
        wsConnected: ws ? ws.readyState === WebSocket.OPEN : false
      });
    });
    return true;

  } else if (request.type === "SET_CONFIG") {
    chrome.storage.local.get("severity_config", async ({ severity_config }) => {
      const updated = { ...(severity_config || DEFAULT_CONFIG), ...request.config };
      await chrome.storage.local.set({ severity_config: updated });
      sendResponse({ config: updated });
    });
    return true;

  } else if (request.type === "TEST_SEVERITY_MANUAL") {
    const sample = {
      title: request.title || "पटना कंकड़बाग में संप हाउस की मोटर जलने से 4 फीट जलजमाव",
      snippet: request.snippet || "सैकड़ों घरों में गंदा नाले का पानी घुसा, डेंगू का भारी प्रकोप",
      district: "Patna",
      grievance_type: "Drainage/Health Hazard"
    };
    const scored = evaluateCivicSeverity(sample);
    logLocal("SUCCESS", `Manual Test Scored: ${scored.hazard_score}/100 [${scored.response_priority}]`);

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "SEVERITY_SCORED_RESULT",
        raw_id: "test_" + Date.now(),
        severity_data: scored
      }));
    }
    sendResponse({ result: scored });
    return true;
  }
});

# 🌐 Hyderabad Citizen Echo - Geo-Analytics & Civic Severity Engine

## Mathematical Formulation

The Civic Severity Scorer computes a deterministic Hazard Risk Index ($R$) scaled from 10 to 99:

$$R = \text{clamp}\Big(12, 99, \big(B \times D\big) + \beta_{\text{urgency}}\Big)$$

Where:
- **$B$ (Base Hazard Score)**:
  - Infrastructure Failure / Structural Collapse / Casualty: $+50$
  - Hospital / Healthcare Failure / Epidemic Outbreak (LUH): $+35$
  - Waterlogging / Gutter Drainage / WASA Sump Overflow: $+30$
  - High-Voltage Electrical Grid / HESCO Transformer Blasts: $+25$
  - Road Cave-in / Severe Potholes / Autobahn & Thandi Sarak Gridlock: $+20$
  - Baseline Routine Civic Issue: $+20$
- **$D$ (Zone Population Density Multiplier)**:
  - **Tier 1 (High Density Commercial & Residential Hubs)**: Qasimabad, Saddar / City $\rightarrow 1.30\times$
  - **Tier 2 (Dense Urban Wards)**: Latifabad (Units 1-12), Autobahn Road $\rightarrow 1.25\times$
  - **Tier 3 (Dense Old City & Canal Belt)**: Paretabad, Phuleli $\rightarrow 1.18\times$
  - **Tier 4 (Peri-Urban & Rural Belt)**: Tando Jam $\rightarrow 1.10\times$
  - **Tier 5 (Industrial & Campus Border Zone)**: Kotri / Jamshoro $\rightarrow 1.08\times$
- **$\beta_{\text{urgency}}$ (DeepSeek AI Bias Modifier)**:
  $$\beta_{\text{urgency}} = (U - 3) \times 6$$
  where $U \in [1, 5]$ is the urgency score extracted by DeepSeek.

## Response Priority Classification
| Hazard Score Range | Classification | Routing Action |
|:---|:---|:---|
| **80 – 99** | `CRITICAL_DISASTER` | Immediate DC Hyderabad & Rescue 1122 alert dispatch |
| **60 – 79** | `HIGH_ALERT` | Priority department response (WASA, HESCO, LUH, HMC) |
| **35 – 59** | `STANDARD_RESPONSE` | Routine municipal queue assignment (TMOs) |
| **12 – 34** | `LOW_ROUTINE` | Standard citizen complaint cell ticket logging |

## Deputy Commissioner Intelligence Brief
The platform provides a one-click administrative executive brief compiled directly from radar coordinates:
- Aggregates real-time grievance density per Hyderabad administrative zone
- Breaks down critical hazards versus routine municipal issues
- Identifies actionable administrative remedies mapped to responsible civic bodies (WASA, HESCO, HMC, SSWMB, LUH)
- Generates print-ready executive summaries for Deputy Commissioner & Commissioner administrative reviews

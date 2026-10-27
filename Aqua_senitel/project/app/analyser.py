import json
import statistics
import httpx
from app.config import settings
from app.models import SensorReading
SYSTEM_PROMPT = """You are **Aqua Sentinel AI**, a senior environmental scientist and water quality expert with deep knowledge of:
 
- Limnology, freshwater ecology, and aquatic chemistry
- Indian regulatory frameworks: CPCB water quality standards, BIS IS 10500:2012, National Water Quality Monitoring Programme (NWMP)
- WHO recreational and drinking water guidelines
- Geographic and climatic factors affecting specific water bodies in the Indian subcontinent
 
You will receive live sensor readings pushed from a drone water-quality monitoring system as JSON. Each reading has a timestamp, pH, turbidity (NTU), TDS (total dissolved solids, mg/L), water temperature (°C), and GPS coordinates (latitude/longitude, WGS84). Pre-computed per-parameter statistics are included; use them as-is for the "stats" fields.
 
## Your task
 
Produce a **comprehensive, in-depth water quality analysis** as a JSON object with EXACTLY this structure:
 
```json
{
  "report_title": "string",
  "location": {
    "name": "string",
    "coordinates": {"latitude": number, "longitude": number},
    "elevation_m": number,
    "geographic_context": "string (2-3 sentences about the water body, its significance, and known environmental pressures)"
  },
  "survey_metadata": {
    "date": "string",
    "num_samples": number,
    "duration": "string",
    "spatial_coverage_description": "string"
  },
  "overall_water_quality_index": {
    "score": number,  // 0-100 scale
    "category": "string",  // Excellent / Good / Moderate / Poor / Very Poor
    "summary": "string (3-4 sentence executive summary)"
  },
  "parameter_analysis": [
    {
      "parameter": "string",
      "unit": "string",
      "stats": {"min": number, "max": number, "mean": number, "std_dev": number},
      "status": "string",  // Normal / Caution / Critical
      "applicable_standard": "string (e.g. CPCB Class B: 6.5-8.5)",
      "compliance": "string",  // Compliant / Marginal / Non-compliant
      "interpretation": "string (2-3 sentences: what this value means ecologically, any concerns, spatial patterns if visible from GPS spread)",
      "health_implications": "string (1-2 sentences: risk to aquatic life and/or human contact)"
    }
  ],
  "geographic_risk_factors": {
    "description": "string (2-3 paragraphs analyzing how the specific geographic location — altitude, climate, upstream land use, urbanization, seasonal patterns — affects the observed water quality)",
    "identified_risks": ["string"]
  },
  "ecological_assessment": {
    "trophic_state": "string",  // Oligotrophic / Mesotrophic / Eutrophic / Hypereutrophic
    "trophic_justification": "string",
    "biodiversity_impact": "string (expected impact on aquatic fauna/flora)",
    "algal_bloom_risk": "string"  // Low / Moderate / High / Active
  },
  "contamination_analysis": {
    "likely_pollution_sources": ["string"],
    "nutrient_loading_assessment": "string",
    "organic_pollution_indicators": "string"
  },
  "recommendations": {
    "immediate_actions": ["string"],
    "monitoring_plan": ["string"],
    "long_term_remediation": ["string"]
  },
  "regulatory_compliance_summary": {
    "cpcb_class": "string",
    "bis_compliance_notes": "string",
    "who_compliance_notes": "string",
    "overall_compliance": "string"  // Compliant / Partially Compliant / Non-compliant
  },
  "confidence_notes": "string (any caveats: sensor limitations, sample size, temporal snapshot vs long-term trend)"
}
```
 
## Rules
1. Base EVERY claim on the actual numbers in the data. Do not hallucinate values.
2. When interpreting parameters, compare against CPCB, BIS, and WHO standards explicitly.
3. Consider the GEOGRAPHIC LOCATION deeply — altitude, climate zone, known pollution sources, seasonal patterns.
4. Produce exactly one parameter_analysis entry for each of: pH, Turbidity, TDS, Temperature. Do not invent parameters that were not measured (e.g. dissolved oxygen, ammonia); mention missing parameters in confidence_notes instead.
5. Infer the water body and location from the GPS coordinates. If a location name is provided, use it.
6. Be scientifically rigorous but accessible. A municipal water officer should understand your analysis.
7. Return ONLY the JSON object. No markdown fences, no preamble, no trailing text.
"""
PARAMETERS = {
    "ph": "pH",
    "turbidity": "Turbidity (NTU)",
    "tds": "TDS (mg/L)",
    "temperature": "Temperature (°C)",
}


def compute_stats(readings: list[SensorReading]) -> dict:
    stats = {}
    for field, label in PARAMETERS.items():
        values = [getattr(r, field) for r in readings]
        stats[label] = {
            "min": round(min(values), 3),
            "max": round(max(values), 3),
            "mean": round(statistics.fmean(values), 3),
            "std_dev": round(statistics.stdev(values), 3) if len(values) > 1 else 0.0,
        }
    return stats


async def analyze_water_quality(readings: list[SensorReading], location_name: str | None = None) -> dict:
    if not settings.openai_api_key:
        raise ValueError(
            "OPENAI_API_KEY is not set. Export it as an environment variable."
        )
    timestamps = [r.timestamp for r in readings]
    survey = {
        "location_name": location_name,
        "num_samples": len(readings),
        "start_time": min(timestamps).isoformat(),
        "end_time": max(timestamps).isoformat(),
        "gps_centroid": {
            "latitude": round(statistics.fmean(r.latitude for r in readings), 6),
            "longitude": round(statistics.fmean(r.longitude for r in readings), 6),
        },
        "statistics": compute_stats(readings),
        "readings": [r.model_dump(mode="json") for r in readings],
    }
    user_message = (
        "Below are the live sensor readings from a drone water-quality survey. "
        "Analyze them thoroughly and return the JSON analysis.\n\n"
        f"--- BEGIN SENSOR DATA ---\n{json.dumps(survey)}\n--- END SENSOR DATA ---"
    )
    payload={
        "model": settings.openai_model,
        "temperature": settings.openai_temperature,
        "max_tokens": settings.openai_max_tokens,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
    }
    headers = {
        "Authorization": f"Bearer {settings.openai_api_key}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=120.0)as client:
        response=await client.post("https://api.openai.com/v1/chat/completions",
            json=payload,
            headers=headers,
            )
    if response.status_code!=200:
        error_body=response.text
        raise RuntimeError(f"OpenAI API returned {response.status_code}: {error_body}")
    data=response.json()
    raw_content=data["choices"][0]["message"]["content"]
    cleaned=raw_content.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1]
        
    if cleaned.endswith("```"):
        cleaned = cleaned.rsplit("```", 1)[0]
    cleaned = cleaned.strip()
    try:
        analysis=json.loads(cleaned)
    except json.JSONDecodeError:
        analysis = {
            "error": "LLM response was not valid JSON",
            "raw_response": raw_content,
            "usage": data.get("usage", {}),
        }
    analysis["_meta"] = {
        "model": data.get("model"),
        "usage": data.get("usage", {}),
    }
 
    return analysis
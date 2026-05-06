export const ACCENT = "#00E5FF";
export const ACCENT2 = "#00BFA5";
export const DEEP = "#0A1628";
export const SURFACE = "rgba(10, 22, 40, 0.85)";
export const GLASS = "rgba(255,255,255,0.04)";
export const GLASS_BORDER = "rgba(255,255,255,0.08)";
export const TEXT_PRIMARY = "rgba(255,255,255,0.95)";
export const TEXT_SECONDARY = "rgba(255,255,255,0.55)";
export const TEXT_MUTED = "rgba(255,255,255,0.3)";

export const MOCK_ANALYSIS = {
  report_title: "Dal Lake Water Quality Assessment",
  location: {
    name: "Dal Lake, Srinagar, J&K",
    coordinates: { latitude: 34.0837, longitude: 74.86 },
    elevation_m: 1583,
    geographic_context:
      "Dal Lake is an urban freshwater lake in the heart of Srinagar at ~1,583m ASL. It spans roughly 18 km² and serves as a critical ecological, economic, and cultural resource for the Kashmir Valley. The lake has historically suffered from eutrophication driven by agricultural runoff, houseboat sewage, and encroachment.",
  },
  overall_water_quality_index: {
    score: 62,
    category: "Moderate",
    summary:
      "The water quality of Dal Lake falls in the moderate range, indicating noticeable stress from nutrient loading and organic contamination. While dissolved oxygen levels support aquatic life, elevated turbidity and ammonia concentrations point to ongoing eutrophication. The lake remains below drinking water standards but meets basic recreational thresholds for most parameters.",
  },
  parameter_analysis: [
    {
      parameter: "pH",
      unit: "—",
      stats: { min: 7.06, max: 8.65, mean: 7.82, std_dev: 0.36 },
      status: "Normal",
      applicable_standard: "CPCB Class B: 6.5–8.5",
      compliance: "Compliant",
      interpretation:
        "The pH values are within the normal alkaline range expected for Dal Lake, consistent with carbonate-buffered systems at this altitude. Minor spatial variation suggests localized differences in biological activity.",
      health_implications:
        "pH levels are safe for aquatic organisms and human recreational contact.",
    },
    {
      parameter: "Turbidity",
      unit: "NTU",
      stats: { min: 3.21, max: 32.47, mean: 18.04, std_dev: 5.89 },
      status: "Caution",
      applicable_standard: "BIS IS 10500: ≤5 NTU (drinking)",
      compliance: "Non-compliant",
      interpretation:
        "Turbidity is significantly elevated above drinking water standards, though this is expected for an urban lake receiving multiple inflows. Higher values in the southern sampling points suggest sediment disturbance or algal density near shore.",
      health_implications:
        "High turbidity reduces light penetration, impairing photosynthesis and potentially harboring pathogens.",
    },
    {
      parameter: "Dissolved Oxygen",
      unit: "mg/L",
      stats: { min: 3.84, max: 8.91, mean: 6.48, std_dev: 1.18 },
      status: "Normal",
      applicable_standard: "CPCB Class B: ≥3 mg/L",
      compliance: "Compliant",
      interpretation:
        "DO levels are adequate for sustaining most freshwater fish species. The early-morning sampling window captures pre-photosynthetic minima, suggesting daytime values would be higher. Some samples near the 4 mg/L threshold warrant monitoring.",
      health_implications:
        "Current DO levels support aquatic biodiversity, though sustained dips below 4 mg/L could stress sensitive species.",
    },
    {
      parameter: "Temperature",
      unit: "°C",
      stats: { min: 14.22, max: 20.78, mean: 17.49, std_dev: 1.53 },
      status: "Normal",
      applicable_standard: "No specific standard",
      compliance: "Compliant",
      interpretation:
        "Water temperatures are consistent with early May conditions in Kashmir at this elevation. The ~6.5°C range across samples likely reflects depth variation at dip points and proximity to inflow channels.",
      health_implications:
        "Temperature range is optimal for the native cold-water fish assemblage of Kashmir lakes.",
    },
    {
      parameter: "Conductivity",
      unit: "µS/cm",
      stats: { min: 220.15, max: 418.62, mean: 319.87, std_dev: 44.12 },
      status: "Caution",
      applicable_standard: "Typical freshwater: 100–500 µS/cm",
      compliance: "Marginal",
      interpretation:
        "Conductivity values are in the upper range for freshwater systems, reflecting dissolved mineral and nutrient load. Higher readings correlate with GPS points near houseboat clusters, suggesting anthropogenic ion input.",
      health_implications:
        "Not directly harmful but indicates elevated total dissolved solids from multiple contamination pathways.",
    },
    {
      parameter: "Ammonia (NH₃-N)",
      unit: "mg/L",
      stats: { min: 0.089, max: 0.791, mean: 0.448, std_dev: 0.147 },
      status: "Caution",
      applicable_standard: "BIS IS 10500: ≤0.5 mg/L",
      compliance: "Marginal",
      interpretation:
        "Mean ammonia is near the BIS drinking water limit, with several samples exceeding it. This strongly suggests organic waste input from houseboats, agricultural runoff, and possibly inadequate sewage treatment in peripheral areas.",
      health_implications:
        "Elevated ammonia at these concentrations can cause gill damage in fish and indicates fecal contamination risk for human contact.",
    },
    {
      parameter: "ORP",
      unit: "mV",
      stats: { min: 148.2, max: 278.5, mean: 210.6, std_dev: 29.8 },
      status: "Normal",
      applicable_standard: "WHO Recreation: ≥200 mV ideal",
      compliance: "Marginal",
      interpretation:
        "ORP values indicate mildly oxidizing conditions overall, which is positive for microbial control. However, readings below 180 mV at some points suggest localized reducing conditions — potentially anoxic sediment pockets.",
      health_implications:
        "Adequate for general recreational safety, but low-ORP zones may support pathogen survival.",
    },
  ],
  ecological_assessment: { trophic_state: "Eutrophic", trophic_justification: "Elevated turbidity, high nutrient indicators (ammonia, conductivity), and field-observed algal mats confirm eutrophic status consistent with decades of published research on Dal Lake.", biodiversity_impact: "The eutrophic state favors pollution-tolerant species over sensitive native fauna. Native Schizothorax fish populations are likely stressed.", algal_bloom_risk: "High" },
  spatial_heatmap: [
    { latitude: 34.0845, longitude: 74.8621, parameter: "Ammonia", value: 0.791, unit: "mg/L", status: "Critical", issue_description: "Very high ammonia near houseboat cluster indicating sewage discharge.", recommendation: "Inspect houseboat holding tanks in this cluster immediately." },
    { latitude: 34.0812, longitude: 74.8580, parameter: "Turbidity", value: 32.47, unit: "NTU", status: "Caution", issue_description: "Elevated turbidity near eastern shore likely from agricultural runoff.", recommendation: "Install sediment traps and check inflow stream for excessive silt." }
  ],
  contamination_analysis: { likely_pollution_sources: ["Houseboat sewage discharge", "Agricultural runoff from catchment", "Urban stormwater", "Floating garden (Rad) nutrient leaching", "Inadequate municipal sewage treatment"], nutrient_loading_assessment: "Nutrient loading is significant and consistent with chronic eutrophication patterns documented by LAWDA and CSIR-IITR studies.", organic_pollution_indicators: "Ammonia levels and ORP readings in the lower range confirm active organic decomposition in parts of the lake." },
  recommendations: {
    immediate_actions: [
      "Deploy floating aerators in low-DO zones near southern shore",
      "Increase sampling frequency to weekly during May–September algal bloom season",
      "Issue advisory for houseboat clusters to verify holding tank integrity",
    ],
    monitoring_plan: [
      "Establish 3 permanent monitoring stations with telemetry buoys",
      "Add chlorophyll-a and total phosphorus sensors in next drone sortie",
      "Correlate readings with LAWDA monthly reports for trend analysis",
    ],
    long_term_remediation: [
      "Complete interceptor sewage system around lake perimeter",
      "Enforce floating garden (Rad) removal in designated zones",
      "Restore Dachigam Nallah riparian buffer zone",
      "Implement constructed wetlands at major inflow points",
    ],
  },
  regulatory_compliance_summary: {
    cpcb_class: "Class B (Bathing) — Partially compliant",
    bis_compliance_notes:
      "Fails turbidity standard; ammonia at margin. Not a potable source.",
    who_compliance_notes:
      "Meets basic recreational criteria; ORP marginal at some points.",
    overall_compliance: "Partially Compliant",
  },
  confidence_notes:
    "This assessment is based on a single morning sortie of 25 samples — a temporal snapshot. Diurnal DO variation, seasonal monsoon dilution, and winter stratification are not captured. Sensor accuracy is instrument-spec; no independent lab validation was performed.",
};

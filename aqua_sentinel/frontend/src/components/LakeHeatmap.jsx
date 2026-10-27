import React, { useState } from "react";
import { ACCENT, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED } from "../utils/constants";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export default function LakeHeatmap({ analysis }) {
  const [activePoint, setActivePoint] = useState(null);
  
  if (!analysis?.spatial_heatmap || analysis.spatial_heatmap.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <p style={{ color: TEXT_MUTED }}>No spatial heatmap data available for this scan.</p>
      </div>
    );
  }

  // Automatically center the map on the first point or average coordinates
  const centerLat = analysis.location?.coordinates?.latitude || analysis.spatial_heatmap[0].latitude;
  const centerLng = analysis.location?.coordinates?.longitude || analysis.spatial_heatmap[0].longitude;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: "450px", overflow: "hidden", borderRadius: "16px" }}>
      <MapContainer 
        center={[centerLat, centerLng]} 
        zoom={14} 
        style={{ height: '100%', width: '100%', minHeight: "450px" }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
        />

        {analysis.spatial_heatmap.map((point, idx) => {
          const color = point.status === "Critical" ? "#FF1744" : point.status === "Caution" ? "#FFD600" : "#00E676";
          return (
            <CircleMarker
              key={idx}
              center={[point.latitude, point.longitude]}
              radius={12}
              pathOptions={{
                color: color,
                fillColor: color,
                fillOpacity: 0.6,
                weight: 2
              }}
              eventHandlers={{
                mouseover: () => setActivePoint(point),
              }}
            >
              <Popup>
                <div style={{ 
                  background: "#0A1628", 
                  color: "#fff", 
                  margin: "-13px -20px", 
                  padding: "16px",
                  border: `1px solid ${color}40`,
                  borderRadius: "12px",
                  boxShadow: `0 4px 20px rgba(0,0,0,0.5)`,
                  width: "260px"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <strong style={{ fontSize: "14px", color: color }}>{point.parameter} Alert</strong>
                    <span style={{ fontSize: "12px", background: `${color}20`, padding: "2px 6px", borderRadius: "4px" }}>
                      {point.value} {point.unit}
                    </span>
                  </div>
                  <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)", marginBottom: "4px", lineHeight: "1.4" }}>
                    <strong>Issue:</strong> {point.issue_description}
                  </p>
                  <p style={{ fontSize: "12px", color: "#00E5FF", margin: 0, lineHeight: "1.4" }}>
                    <strong>Action:</strong> {point.recommendation}
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Map Overlay Style injection to fix leaflet popup default styles */}
      <style>{`
        .leaflet-popup-content-wrapper {
          background: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .leaflet-popup-tip {
          background: #0A1628 !important;
        }
        .leaflet-container {
          background: #0A1628 !important;
        }
      `}</style>
    </div>
  );
}

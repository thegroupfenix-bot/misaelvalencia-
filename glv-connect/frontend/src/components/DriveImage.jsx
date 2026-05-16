import { driveUrl, DRIVE_IMAGES } from "../config/driveImages";

export function DriveImage({ imageKey, style, fallbackText }) {
  const img = DRIVE_IMAGES[imageKey];
  const url = img?.fileId ? driveUrl(img.fileId) : null;
  if (!url) return (
    <div style={{
      ...style,
      background: "#1B2A4A",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 8
    }}>
      <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, textAlign: "center", padding: 8 }}>
        {fallbackText || img?.label || imageKey}
      </span>
    </div>
  );
  return <img src={url} alt={img?.label} style={{ ...style, objectFit: "cover" }} />;
}

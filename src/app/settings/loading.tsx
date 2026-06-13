export default function SettingsLoading() {
  return (
    <div style={{ padding: "32px", maxWidth: "600px", margin: "0 auto" }}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            height: i === 3 ? "36px" : "40px",
            width: i === 3 ? "120px" : "100%",
            background: "var(--color-background-secondary)",
            borderRadius: "6px",
            marginBottom: "16px",
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
      ))}
    </div>
  );
}

import qrcode from "qrcode-generator";

/** QR code rendu en SVG (un seul chemin), sans canvas ni innerHTML. */
export function QrCode({ value, size = 184, label }: { value: string; size?: number; label: string }) {
  const qr = qrcode(0, "M");
  qr.addData(value);
  qr.make();
  const count = qr.getModuleCount();
  const margin = 2;
  let d = "";
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) d += `M${col + margin},${row + margin}h1v1h-1z`;
    }
  }
  const dim = count + margin * 2;
  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox={`0 0 ${dim} ${dim}`}
      shapeRendering="crispEdges"
      className="rounded-xl bg-white"
    >
      <path d={d} fill="#2b2420" />
    </svg>
  );
}

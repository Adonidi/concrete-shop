from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
GALLERY = ROOT / "gallery"
OUT = ROOT / "data" / "gallery.js"
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}
VIDEO_EXTS = {".mp4", ".webm", ".mov", ".m4v", ".ogv"}

items = []
for path in sorted(GALLERY.iterdir(), key=lambda p: p.name.lower()):
    if not path.is_file():
        continue
    ext = path.suffix.lower()
    if ext not in IMAGE_EXTS | VIDEO_EXTS:
        continue
    items.append({
        "src": f"gallery/{path.name}",
        "type": "video" if ext in VIDEO_EXTS else "image",
    })

OUT.write_text(
    "window.GALLERY_ITEMS = " + json.dumps(items, ensure_ascii=False, indent=2) + ";\n",
    encoding="utf-8",
)
print(f"Gallery updated: {len(items)} files")

"""Refresh two bounded NRSC historical display snapshots; no bulk tile download.
Non-commercial development use. Source: NRSC, ISRO/DOS.
Run explicitly; no automatic service or credentials are used.
"""
import hashlib
import json
import math
import struct
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ENDPOINT = "https://bhuvan-gp1.nrsc.gov.in/bhuvan/wms"
BBOX = [85.05, 25.6, 85.3, 25.85]
LAYERS = [("2024-10-01", "10"), ("2024-10-02", "06")]
ROOT = Path(__file__).resolve().parents[1] / "public/data/nrsc"

def mercator(lon, lat):
    radius = 6378137
    return [radius * math.radians(lon), radius * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))]

def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    west, south, east, north = BBOX
    projected = mercator(west, south) + mercator(east, north)
    records = []
    # Fetch and validate all images before publishing the manifest.
    for date, hour in LAYERS:
        year, month, day = date.split("-")
        layer = f"flood:br_{year}_{day}_{month}_{hour}"
        params = dict(SERVICE="WMS", VERSION="1.1.1", REQUEST="GetMap", FORMAT="image/png", TRANSPARENT="true", LAYERS=layer, STYLES="", SRS="EPSG:3857", BBOX=",".join(map(str, projected)), WIDTH=512, HEIGHT=512)
        url = ENDPOINT + "?" + urllib.parse.urlencode(params)
        with urllib.request.urlopen(url, timeout=25) as response:
            content_type = response.headers.get_content_type()
            data = response.read(2_000_001)
        if content_type != "image/png" or not data.startswith(b"\x89PNG\r\n\x1a\n") or len(data) > 2_000_000:
            raise ValueError(f"Invalid/budget-exceeding WMS response for {layer}")
        if struct.unpack(">II", data[16:24]) != (512, 512):
            raise ValueError("Unexpected image dimensions")
        name = f"bihar-{date}-{hour}.png"
        (ROOT / name).write_bytes(data)
        records.append(dict(id=f"{date}-{hour}", date=date, providerTimeLabel=f"{date} {hour}Hr (timezone unverified)", layer=layer, url=url, image=f"/data/nrsc/{name}", retrievedAt=datetime.now(timezone.utc).isoformat(), sha256=hashlib.sha256(data).hexdigest(), bytes=len(data)))
    manifest = dict(provider="Source: NRSC, ISRO/DOS", sourcePage="https://bhuvan-app1.nrsc.gov.in/disaster/usrtasks/flood/flood.php?uname=empty", terms="https://www.nrsc.gov.in/nrscnew/termsConditions.php", mode="historical-provider-inundation-map", bbox=BBOX, crs="EPSG:3857", imageDimensions=[512,512], nativeResolution="Unknown; requested display pixels are not sensor resolution", limitations=["Provider-labelled inundation, not independently validated here", "No depth, duration, current blockage or storage-capacity inference", "Outside snapshot bounds and unmarked pixels are unknown, not dry/safe", "Sensor, acquisition timezone, detection accuracy, permanent-water treatment and coverage mask unverified", "Separate fixed observation date; not synchronized to the discharge replay", "Non-commercial attributed development snapshots; production rights not cleared"], snapshots=records)
    temporary = ROOT / "manifest.tmp.json"
    temporary.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    temporary.replace(ROOT / "manifest.json")
    print(f"Published {len(records)} bounded NRSC snapshots")

if __name__ == "__main__":
    main()

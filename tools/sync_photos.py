"""Sync item photos from the "Moving Sale Photos" Google Drive folder.

Only files that are not already in photos/manifest.json are downloaded.
Run from the repo root:

    pip install gdown pillow pillow-heif
    python tools/sync_photos.py <drive-folder-url>            # show what's new, download nothing
    python tools/sync_photos.py <drive-folder-url> --apply    # download, resize and add new photos

The Drive folder must be shared as "anyone with the link can view".
Photos are resized (1600 px full size, 640 px card thumbnail) and saved
without metadata, so phone GPS data never reaches the site. Each new
photo is numbered after the item's existing ones (e.g. blender-9.jpg).
Afterwards, add the printed file names to the item's "Photos (site)"
cell in the Sheet, and add a new row for any new folder.
"""
import json
import os
import re
import sys
import tempfile
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PHOTOS = os.path.join(ROOT, "photos")
MANIFEST = os.path.join(PHOTOS, "manifest.json")
IMAGE_EXT = {".jpg", ".jpeg", ".heic", ".png"}


def slugify(name):
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:40]


def list_drive(url):
    import gdown
    files = gdown.download_folder(url=url, skip_download=True, quiet=True)
    out = []
    for f in files:
        folder, _, name = f.path.rpartition("/")
        out.append({"id": f.id, "folder": folder, "file": name})
    return out


def process(src, dest_base):
    from PIL import Image, ImageOps
    import pillow_heif
    pillow_heif.register_heif_opener()
    im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    for suffix, size, q in (("", 1600, 80), ("-t", 640, 76)):
        c = im.copy()
        c.thumbnail((size, size), Image.LANCZOS)
        c.save(f"{dest_base}{suffix}.jpg", "JPEG", quality=q, optimize=True, progressive=True)


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    url, apply = sys.argv[1], "--apply" in sys.argv
    m = json.load(open(MANIFEST))
    known = {(f["folder"], f["file"]) for f in m["files"]}
    known |= {(f["folder"], f["file"]) for f in m["skipped"]}
    drive = list_drive(url)
    on_drive = {(f["folder"], f["file"]) for f in drive}

    new = [f for f in drive if (f["folder"], f["file"]) not in known]
    gone = sorted(k for k in known if k not in on_drive)
    print(f"{len(drive)} files on Drive, {len(new)} new, {len(gone)} no longer on Drive")
    for folder, name in gone:
        print(f"  removed from Drive: {folder}/{name}")

    added = {}
    pending = {}  # numbers handed out in this run (dry runs too)
    with tempfile.TemporaryDirectory() as tmp:
        for f in sorted(new, key=lambda f: (f["folder"], f["file"])):
            ext = os.path.splitext(f["file"])[1].lower()
            if ext not in IMAGE_EXT:
                print(f"  skipping (not a photo): {f['folder']}/{f['file']}")
                if apply:
                    m["skipped"].append({"folder": f["folder"], "file": f["file"], "reason": "not a photo"})
                continue
            slug = m["folders"].get(f["folder"])
            if not slug:
                slug = slugify(f["folder"].rpartition("/")[2])
                print(f"  NEW FOLDER: {f['folder']} -> {slug} (add a row to the Sheet)")
                if apply:
                    m["folders"][f["folder"]] = slug
            nums = [re.fullmatch(re.escape(slug) + r"-(\d+)\.jpg", x["site"]) for x in m["files"]]
            nums += [re.fullmatch(re.escape(slug) + r"-(\d+)\.jpg", s) for s in pending.get(slug, [])]
            n = 1 + max([int(x.group(1)) for x in nums if x] + [0])
            site = f"{slug}-{n}.jpg"
            pending.setdefault(slug, []).append(site)
            print(f"  new: {f['folder']}/{f['file']} -> {site}")
            if apply:
                import gdown
                local = os.path.join(tmp, f["file"])
                gdown.download(id=f["id"], output=local, quiet=True)
                process(local, os.path.join(PHOTOS, site[:-4]))
                m["files"].append({"folder": f["folder"], "file": f["file"], "site": site})
                added.setdefault(slug, []).append(site)
    if apply:
        json.dump(m, open(MANIFEST, "w"), indent=1, ensure_ascii=False)
        for slug, names in added.items():
            print(f"Add to Sheet ({slug}): {', '.join(names)}")
    elif new:
        print("Dry run. Re-run with --apply to download and add these.")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
GLV Global Food Services — Hostinger Upload Script
Run this script from YOUR LOCAL PC to upload the site to Hostinger.

Requirements:
    pip install paramiko

Usage:
    python upload-hostinger.py

IMPORTANT — Video:
    The hero video already streams from glvservicesexp.com as fallback.
    To use a local video copy, place it at:
        imagenes/video-corporativo-glv-foodservices.mp4
    (this is the video "video corporativo glv services.mp4" on Hostinger)
    The script will upload it automatically if it exists in imagenes/.
"""
import os
import paramiko
from pathlib import Path

HOST = "145.223.77.203"
PORT = 65002
USER = "u677016354"
PASSWORD = "*Michel4825"

# Remote path: adjust if your Hostinger public_html is in a different location
REMOTE_BASE = "/home/u677016354/domains/glvglobalfoodservices.com/public_html"

# Local folder: change this to wherever you saved the glvglobalfoodservices folder
LOCAL_BASE = Path(__file__).parent  # same folder as this script

FILES_TO_UPLOAD = [
    "index.html",
    "huevo-proteinas.html",
    "coco-aceites.html",
    "granos-cereales.html",
    "comercio-internacional.html",
]

IMAGENES_FOLDER = LOCAL_BASE / "imagenes"


def upload_file(sftp, local_path, remote_path):
    try:
        sftp.put(str(local_path), remote_path)
        print(f"  ✓  {local_path.name}")
    except Exception as e:
        print(f"  ✗  {local_path.name} → ERROR: {e}")


def ensure_remote_dir(sftp, remote_dir):
    try:
        sftp.stat(remote_dir)
    except FileNotFoundError:
        sftp.mkdir(remote_dir)
        print(f"  + Created remote dir: {remote_dir}")


def main():
    print("=" * 60)
    print("  GLV Global Food Services — Hostinger Upload")
    print("=" * 60)
    print(f"  Host : {HOST}:{PORT}")
    print(f"  User : {USER}")
    print(f"  Dest : {REMOTE_BASE}")
    print()

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    print("Connecting...")
    client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)
    sftp = client.open_sftp()
    print("Connected.\n")

    # Ensure remote base exists
    ensure_remote_dir(sftp, REMOTE_BASE)

    # Upload HTML pages
    print("Uploading HTML pages:")
    for fname in FILES_TO_UPLOAD:
        local = LOCAL_BASE / fname
        if local.exists():
            upload_file(sftp, local, f"{REMOTE_BASE}/{fname}")
        else:
            print(f"  ⚠  SKIPPED (not found): {fname}")

    # Upload imagenes folder
    remote_img = f"{REMOTE_BASE}/imagenes"
    ensure_remote_dir(sftp, remote_img)

    if IMAGENES_FOLDER.exists():
        img_files = list(IMAGENES_FOLDER.iterdir())
        if img_files:
            print(f"\nUploading {len(img_files)} image(s):")
            for img in sorted(img_files):
                if img.is_file():
                    upload_file(sftp, img, f"{remote_img}/{img.name}")
        else:
            print("\n⚠  imagenes/ folder is empty — add your images and re-run.")
    else:
        print("\n⚠  imagenes/ folder not found — skipping images.")

    sftp.close()
    client.close()
    print("\n✅  Upload complete!")
    print(f"   Visit: https://glvglobalfoodservices.com")


if __name__ == "__main__":
    main()

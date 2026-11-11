# -*- coding: utf-8 -*-
"""Unit tests for the pure-Python Electron ASAR codec."""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

SRC_DIR = Path(__file__).resolve().parent.parent / "src"
sys.path.insert(0, str(SRC_DIR))

from asar_codec import collect_unpacked_paths, extract_asar, pack_asar, read_header, read_text_entry


class AsarCodecTests(unittest.TestCase):
    """Verify pack, extract, unpacked files, empty files, and text reads."""

    def test_roundtrip_packed_empty_and_unpacked(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            src = root / "src"
            (src / "dist").mkdir(parents=True)
            (src / "node_modules" / "chrome-devtools-mcp").mkdir(parents=True)
            (src / "package.json").write_text('{"name":"test","version":"2.31.0"}', encoding="utf-8")
            preload_bytes = "console.log('zh-CN 中文');\n".encode("utf-8")
            (src / "dist" / "preload.js").write_bytes(preload_bytes)
            (src / "dist" / "empty.txt").write_bytes(b"")
            (src / "node_modules" / "chrome-devtools-mcp" / "tool.bin").write_bytes(b"\x00\x01\x02\x03")

            asar_path = root / "app.asar"
            packed_cnt, unpacked_cnt = pack_asar(
                src,
                asar_path,
                unpack_dirs=("node_modules/chrome-devtools-mcp",),
            )
            self.assertEqual(packed_cnt, 3)
            self.assertEqual(unpacked_cnt, 1)

            header, _, hdr_unpacked = read_header(asar_path)
            self.assertEqual(hdr_unpacked, 1)
            self.assertEqual(
                collect_unpacked_paths(header),
                {"node_modules/chrome-devtools-mcp/tool.bin"},
            )
            self.assertEqual(
                read_text_entry(asar_path, ("dist", "preload.js")),
                preload_bytes.decode("utf-8"),
            )
            empty_entry = header["files"]["dist"]["files"]["empty.txt"]
            self.assertEqual(len(empty_entry["integrity"]["blocks"]), 1)

            # Verify fallback extraction when archive is renamed like app.asar.original.bak
            backup_asar = root / "app.asar.original.bak"
            asar_path.replace(backup_asar)
            extracted = root / "out"
            count = extract_asar(backup_asar, extracted)
            self.assertEqual(count, 4)
            self.assertEqual((extracted / "dist" / "empty.txt").read_bytes(), b"")
            self.assertEqual(
                (extracted / "node_modules" / "chrome-devtools-mcp" / "tool.bin").read_bytes(),
                b"\x00\x01\x02\x03",
            )


if __name__ == "__main__":
    unittest.main(verbosity=2)

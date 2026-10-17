"""Reassemble NotoSansDevanagari-Bold.ttf."""
import base64, os
from NotoSansDevanagari_Bold_part0 import CHUNK as C0
from NotoSansDevanagari_Bold_part1 import CHUNK as C1
from NotoSansDevanagari_Bold_part2 import CHUNK as C2
from NotoSansDevanagari_Bold_part3 import CHUNK as C3
DATA = C0 + C1 + C2 + C3
def ensure_font(target_path):
    if not os.path.exists(target_path):
        os.makedirs(os.path.dirname(target_path), exist_ok=True)
        with open(target_path, "wb") as f:
            f.write(base64.b64decode(DATA))
    return target_path

#!/usr/bin/env python3
"""ComfyUI API로 이미지를 뽑는다.

UI에서 클릭해 만든 이미지는 무엇으로 만들었는지 남지 않는다.
이 스크립트는 PNG 옆에 같은 이름의 .json을 써서 프롬프트·시드·샘플러를
전부 기록한다. 같은 json을 --replay로 넣으면 그대로 재현된다.

    ./gen.py "chibi office worker, pixel art" --name worker --steps 25
    ./gen.py --replay out/worker-0001.json
"""

import argparse
import json
import random
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

SERVER = "127.0.0.1:8188"
OUT = Path(__file__).parent / "out"

DEFAULTS = {
    "model": "sd_xl_base_1.0.safetensors",
    "negative": "blurry, jpeg artifacts, watermark, text, signature, lowres, deformed",
    "width": 1024,
    "height": 1024,
    "steps": 25,
    "cfg": 7.0,
    "sampler": "dpmpp_2m",
    "scheduler": "karras",
    "lora": None,
    "lora_strength": 1.0,
}


def build_graph(p: dict) -> dict:
    """SDXL txt2img 그래프. LoRA가 있으면 체크포인트와 샘플러 사이에 끼운다."""
    g = {
        "4": {"class_type": "CheckpointLoaderSimple",
              "inputs": {"ckpt_name": p["model"]}},
        "5": {"class_type": "EmptyLatentImage",
              "inputs": {"width": p["width"], "height": p["height"], "batch_size": 1}},
        "6": {"class_type": "CLIPTextEncode",
              "inputs": {"text": p["prompt"], "clip": ["4", 1]}},
        "7": {"class_type": "CLIPTextEncode",
              "inputs": {"text": p["negative"], "clip": ["4", 1]}},
        "3": {"class_type": "KSampler",
              "inputs": {"seed": p["seed"], "steps": p["steps"], "cfg": p["cfg"],
                         "sampler_name": p["sampler"], "scheduler": p["scheduler"],
                         "denoise": 1.0, "model": ["4", 0],
                         "positive": ["6", 0], "negative": ["7", 0],
                         "latent_image": ["5", 0]}},
        "8": {"class_type": "VAEDecode",
              "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "9": {"class_type": "SaveImage",
              "inputs": {"images": ["8", 0], "filename_prefix": "artforge"}},
    }
    if p["lora"]:
        g["10"] = {"class_type": "LoraLoader",
                   "inputs": {"lora_name": p["lora"],
                              "strength_model": p["lora_strength"],
                              "strength_clip": p["lora_strength"],
                              "model": ["4", 0], "clip": ["4", 1]}}
        g["6"]["inputs"]["clip"] = ["10", 1]
        g["7"]["inputs"]["clip"] = ["10", 1]
        g["3"]["inputs"]["model"] = ["10", 0]
    return g


def post(path: str, payload: dict) -> dict:
    req = urllib.request.Request(
        f"http://{SERVER}{path}", data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def get(path: str) -> bytes:
    with urllib.request.urlopen(f"http://{SERVER}{path}", timeout=30) as r:
        return r.read()


def generate(p: dict, name: str) -> Path:
    client_id = str(uuid.uuid4())
    started = time.time()
    try:
        res = post("/prompt", {"prompt": build_graph(p), "client_id": client_id})
    except urllib.error.HTTPError as e:
        sys.exit(f"서버가 그래프를 거절했다:\n{e.read().decode()[:2000]}")
    pid = res["prompt_id"]

    print(f"큐 투입 {pid[:8]}  {p['width']}x{p['height']}  {p['steps']}스텝  시드 {p['seed']}")
    while True:
        hist = json.loads(get(f"/history/{pid}"))
        if pid in hist:
            break
        time.sleep(1.5)
        print(f"  {time.time() - started:5.0f}초 경과", end="\r", flush=True)

    elapsed = time.time() - started
    images = [i for o in hist[pid]["outputs"].values() for i in o.get("images", [])]
    if not images:
        sys.exit(f"이미지가 나오지 않았다: {json.dumps(hist[pid].get('status', {}))[:500]}")

    OUT.mkdir(exist_ok=True)
    n = len(list(OUT.glob(f"{name}-*.png"))) + 1
    img = images[0]
    q = urllib.parse.urlencode({"filename": img["filename"],
                                "subfolder": img.get("subfolder", ""),
                                "type": img.get("type", "output")})
    png = OUT / f"{name}-{n:04d}.png"
    png.write_bytes(get(f"/view?{q}"))
    (OUT / f"{name}-{n:04d}.json").write_text(
        json.dumps({**p, "elapsed_sec": round(elapsed, 1)}, ensure_ascii=False, indent=2))

    print(f"저장 {png.name}  {png.stat().st_size // 1024}KB  {elapsed:.0f}초        ")
    return png


def main() -> None:
    ap = argparse.ArgumentParser(description="ComfyUI로 이미지를 뽑는다")
    ap.add_argument("prompt", nargs="?", help="긍정 프롬프트")
    ap.add_argument("--replay", help="이전 결과의 .json을 그대로 다시 돌린다")
    ap.add_argument("--name", default="out", help="파일 이름 앞머리")
    ap.add_argument("--negative", default=DEFAULTS["negative"])
    ap.add_argument("--model", default=DEFAULTS["model"])
    ap.add_argument("--lora", default=DEFAULTS["lora"])
    ap.add_argument("--lora-strength", type=float, default=DEFAULTS["lora_strength"])
    ap.add_argument("--width", type=int, default=DEFAULTS["width"])
    ap.add_argument("--height", type=int, default=DEFAULTS["height"])
    ap.add_argument("--steps", type=int, default=DEFAULTS["steps"])
    ap.add_argument("--cfg", type=float, default=DEFAULTS["cfg"])
    ap.add_argument("--sampler", default=DEFAULTS["sampler"])
    ap.add_argument("--scheduler", default=DEFAULTS["scheduler"])
    ap.add_argument("--seed", type=int, help="생략하면 무작위 — 결과 json에 기록된다")
    a = ap.parse_args()

    if a.replay:
        p = json.loads(Path(a.replay).read_text())
        p.pop("elapsed_sec", None)
        name = Path(a.replay).stem.rsplit("-", 1)[0]
    else:
        if not a.prompt:
            ap.error("프롬프트나 --replay 중 하나는 필요하다")
        p = {k: getattr(a, k) for k in
             ("prompt", "negative", "model", "lora", "lora_strength",
              "width", "height", "steps", "cfg", "sampler", "scheduler")}
        p["seed"] = a.seed if a.seed is not None else random.randrange(2**32)
        name = a.name

    generate(p, name)


if __name__ == "__main__":
    main()

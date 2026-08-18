# 리그 구성 — 2026-08-18 실측

로컬 ComfyUI. 설치와 첫 생성까지 확인했다.

## 기기

Apple M4 / 통합 메모리 16GB / macOS 26.5.2
ComfyUI가 잡은 장치: `mps`, VRAM 상태 `SHARED`

## 설치된 것

| | 버전·크기 | 위치 |
|---|---|---|
| ComfyUI | 0.33.2 | `~/ComfyUI` |
| Python | 3.14.6 (venv) | `~/ComfyUI/.venv` |
| PyTorch | 2.13.0, MPS 사용 가능 | |
| SDXL base 1.0 | 6.92GB | `~/ComfyUI/models/checkpoints/sd_xl_base_1.0.safetensors` |
| pixel-art-xl LoRA | 170MB | `~/ComfyUI/models/loras/pixel-art-xl.safetensors` |

ComfyUI 본체와 모델은 **저장소 밖**에 둔다. 기가 단위 파일이 git에 들어가면 되돌리기 고약하다.

## 재설치

```sh
comfy --skip-prompt --workspace ~/ComfyUI install --m-series --fast-deps --version latest

cd ~/ComfyUI/models/checkpoints
curl -LO https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors

cd ~/ComfyUI/models/loras
curl -LO https://huggingface.co/nerijs/pixel-art-xl/resolve/main/pixel-art-xl.safetensors
```

## 서버 띄우기

```sh
cd ~/ComfyUI && .venv/bin/python main.py --listen 127.0.0.1 --port 8188
```

브라우저 UI는 http://127.0.0.1:8188 . 생성은 `gen.py`로 한다 — UI에서 클릭한
이미지는 무엇으로 만들었는지 남지 않는다.

## 실측 속도

| 설정 | 소요 |
|---|---|
| 768×768 / 20스텝 / SDXL base | 83초 |
| 1024×1024 / 25스텝 / SDXL + LoRA | 189초 |

한 장에 1~3분이다. 탐색을 돌릴 때 이 숫자로 계획을 잡는다.
스무 장 시트 하나가 30분에서 한 시간이다.

## 두 경로

`samples/`에 증거가 있다.

- **SDXL base** (`01-sdxl-base.png`) — 두꺼운 외곽선 일러스트. 홈페이지 비주얼과
  40×40 직업 일러스트 쪽
- **SDXL + pixel-art-xl** (`02-sdxl-pixel-lora.png`) — 픽셀 격자가 살아 있는
  전신 캐릭터. devstory_d 캐릭터 로스터 설계 쪽

둘 다 첫 시도에서 쓸 만한 것이 나왔다.

# artforge — 프로젝트 규칙

studio_d의 캐릭터·에셋 생성 리그. 대장간이다.

## ComfyUI는 이 저장소 밖에 있다

**본체: `~/ComfyUI`** (약 8.4GB, ComfyUI 0.33.2)
모델도 그 아래 산다 — `~/ComfyUI/models/checkpoints`, `~/ComfyUI/models/loras`.

여기 넣지 않는 이유는 용량이 아니라 **ComfyUI 자체가 git 저장소**이기 때문이다.
저장소 안에 저장소가 들어가면 gitlink로 잡히거나 ignore로 덮어야 하고,
그 안에서 실수로 커밋하거나 `git clean`이 이상하게 돈다. ignore로는 안 풀린다.

부수적으로 — ComfyUI는 런타임이지 내용물이 아니다. node_modules와 같은 범주다.
이 저장소의 내용물은 프롬프트·스크립트·관측·샘플이고 수백 KB다.

`comfy` CLI에도 기본 워크스페이스로 등록해 뒀다. `comfy which`로 확인한다.

## 서버

```sh
./serve.sh          # 떠 있으면 아무것도 안 한다
```

http://127.0.0.1:8188 . 재부팅하면 죽으므로 작업 전에 한 번 돌린다.
`gen.py`는 서버가 없으면 이 명령을 알려주고 멈춘다.

## 생성은 gen.py로 한다

브라우저 UI에서 클릭해 만든 이미지는 무엇으로 만들었는지 남지 않는다.
좋은 것이 나와도 다시 못 만든다. `gen.py`는 PNG 옆에 같은 이름의 json을 써서
프롬프트·시드·샘플러·스텝을 전부 기록하고 `--replay`로 재현한다.

```sh
./gen.py "프롬프트" --name cast --lora pixel-art-xl.safetensors --steps 22
./gen.py --replay out/cast-0001.json
```

## out/ 과 samples/

- `out/` — 작업장. git이 추적하지 않는다. 대부분 버려진다
- `samples/` — 골라 남긴 증거. 파라미터 json과 **짝으로** 커밋한다

## 여기서 결정하지 않는다

마스코트가 누구인지, 게임 간 연결이 어떤지는 `studio_d/design-system/WORLD.md`가 쥔다.
캐논을 대장간에 두면 스튜디오 정체성이 실험 폴더 안에서 매번 다시 태어난다.

흐름: 여기서 후보를 뽑는다 → studio_d가 고르고 확정한다 → 각 게임이 구현한다.

## 16×24 액터 스프라이트를 만들지 않는다

devstory_d의 액터는 얼굴 전체가 10×10 픽셀이고, 원작 실기기 캡처를 3배 격자로
샘플링해 픽셀을 실측값으로 채웠다. 확산 모델 출력을 그 격자로 줄이면 실측을 뭉갠다.

artforge는 **무엇을 그릴지**를 맡는다. **어느 픽셀을 찍을지**는 실측과 손이 맡는다.

## 기준 문서

- 구성·재설치·실측 속도: `SETUP.md`
- 단계별 계획과 게이트: `PLAN.md`
- 돌려보며 알아낸 것: `FINDINGS.md` ← 프롬프트 다시 짜기 전에 읽는다
- 저장소 지도와 스튜디오 결정: `../studio_d/README.md`, `../studio_d/DECISIONS.md`

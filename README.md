# Codex 인수인계 패키지

이 폴더는 쇼츠 시리즈 **재미있는 테니스 노트**의 첫 번째 에피소드 제작을 Codex에서 이어가기 위한 완성형 작업 묶음이다.

## V2 제작 대시보드

78초·18컷 버전의 현재 제작 흐름은 로컬 대시보드에서 관리한다.

```powershell
powershell -ExecutionPolicy Bypass -File .\dashboard\start_dashboard.ps1
```

실행 후 `http://127.0.0.1:4175`를 연다. Flow가 기본 엔진이며 전체 또는 컷별로 Higgsfield를 선택할 수 있다. 단계마다 자동·검토 후·수동 모드를 지정할 수 있고, 외부 서비스 로그인 정보는 저장하지 않는다.

세부 사용법은 `dashboard/README.md`를 참고한다.

## 바로 시작하기

1. 이 폴더 전체를 작업용 폴더에 압축 해제한다.
2. Codex를 이 폴더에서 시작한다. Codex는 루트의 `AGENTS.md`를 자동으로 읽는다.
3. `START_PROMPT.txt` 내용을 Codex에 붙여 넣는다.
4. Higgsfield 플러그인 또는 API 연결을 확인하고 생성한다.

## 주요 파일

- `AGENTS.md`: Codex가 항상 따라야 할 제작 규칙
- `CODEX_TASK.md`: 현재 상태와 구체적인 실행 순서
- `episode_manifest.json`: 장면별 이미지·길이·영상 프롬프트
- `assets/`: 승인된 7개 키프레임과 테돌이 캐릭터 자료
- `docs/production_package.md`: 대본, 사실 검증, 원본 제작 설계
- `reference/timing_animatic_DO_NOT_COPY_SUBTITLES.mp4`: 타이밍만 참고하는 애니매틱
- `output/`: 생성 영상과 최종 결과 저장 위치

## 중요

참고 애니매틱에는 자막이 있지만, 새 최종 영상에는 자막을 절대 넣지 않는다.

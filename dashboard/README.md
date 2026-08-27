# Fun Tennis Note Studio

재미있는 테니스 노트의 78초·18컷 제작 파이프라인을 관리하는 로컬 대시보드입니다.

## 실행

```powershell
powershell -ExecutionPolicy Bypass -File .\dashboard\start_dashboard.ps1
```

브라우저에서 `http://127.0.0.1:4175`를 엽니다.

## 실제로 자동화되는 작업

- 78초 프롬프트 패키지와 18개 컷 파싱
- 단계별 실행 모드와 진행 상태 저장
- Flow/Higgsfield 컷별 선택 및 모델 선택
- Flow 크레딧과 Higgsfield 사용자 입력 단가 기반 예상 비용 계산
- 키프레임·영상 생성 대기열 JSON 작성
- 프로젝트 필수 파일과 FFprobe 상태 검사
- 내레이션 길이 및 18개 클립 준비 상태 확인
- 외부 생성용 작업 계획을 `output/dashboard_job_plan.json`으로 내보내기

## 의도적으로 자동화하지 않는 작업

Flow와 Higgsfield 로그인 정보나 API 키는 저장하지 않습니다. 연결 어댑터가 없는 상태에서는 생성 대기열을 만든 뒤 외부 서비스 실행 단계에서 멈춥니다. 영상 파일을 지정된 경로에 저장하면 이후 편집·검수 단계가 다시 이어집니다.




## 에피소드 기획 라이브러리

- 파일럿·후속 강력 후보·기존 아이디어를 중복 정리한 **통합 에피소드 279편**을 제공합니다.\n- 1번은 `너무 강한 회전 때문에 금지된 라켓`이며, 강한 주제는 약 7편 간격으로 274번까지 분산됩니다.\n- 기본 정렬은 `균형 번호순`이고, 필요하면 추천 점수순·제목순·카테고리·검증 상태로 다시 볼 수 있습니다.
- `+ 찜`으로 후보를 모으고, 상세 창의 `이 기획 선택`으로 다음 제작 주제를 지정합니다.
- 새 주제 선택 결과는 `output/planning/selected_episode.json`에 저장됩니다.
- 검증 완료 표기가 없는 아이디어는 대본 제작 전에 공식·1차 자료 리서치가 필요합니다.

## Typecast API 연결

Typecast Studio 로그인 세션과 API 연결은 별개입니다. API 키는 브라우저나 `state.json`에 저장하지 않고 서버 프로세스의 환경 변수로만 읽습니다.

Typecast API Console에서 무료 API 플랜을 시작하고 키를 발급한 뒤, 아래처럼 같은 PowerShell 창에서 서버를 실행합니다. 대시보드가 `/v1/users/me/subscription`으로 실제 연결 상태와 잔여 크레딧을 확인합니다.

```powershell
$env:TYPECAST_API_KEY="Typecast API Console에서 발급한 키"
.\dashboard\start_dashboard.ps1
```

대시보드의 **제작 파이프라인 → 필재 목소리 더빙**에서 다음 순서로 진행합니다.

1. `목소리 목록 새로고침`을 눌러 필재를 자동 탐색하거나 Voice ID를 선택합니다.
2. SSFM v3.0, 한국어, 속도 1.12를 확인합니다.
3. `더빙 생성`을 누르면 WAV와 단어 타임스탬프가 생성됩니다.
4. 생성 파일: `output/episodes/<에피소드 ID>/audio/typecast_piljae.wav`

API 키가 없으면 `Typecast Studio 열기`에서 직접 생성한 WAV를 위 경로에 저장하고 `내보낸 WAV 확인`을 누릅니다. 문장 간격 90ms는 편집 목표값이며, 현재 Typecast API에는 문장 간 무음을 밀리초로 고정하는 옵션이 없습니다.







## SCRIPT DNA V3.2

- 표준 구조: 궁금증 질문 → 상식과 반전 → 순서를 바꿀 수 없는 원인 사슬 → 해결과 검증 → 첫 질문의 답
- 문장 규격: 18문장, 한 문장당 한 컷, 객관 사실은 `-습니다/-입니다`, 질문·전환·마무리는 `-까요?/-죠/-네요`를 3~6번만 사용
- 금지 습관: `거든요`, `셈입니다`, 반복 셀프 문답, 청자 호명
- 사람 대신 공·라켓·코트·규칙이 문장의 주어가 되어 움직입니다.
- 상세 규칙은 `../docs/FTN_SCRIPT_GRAMMAR_V3_2.md`, 실행 설정은 `data/script_style_v3_2.json`을 참고합니다.

### EVIDENCE LAYER

- 핵심 주장마다 사실 → 원리 → 화면 근거를 연결합니다.
- 집중력 보호를 위해 한 컷에는 근거 하나, 기술 그래픽은 0.8~1.5초만 사용합니다.
- 나레이션은 쉬운 원리, 화면은 규격·수치·단면을 담당합니다.
- 출처 없는 퍼센트와 정밀 수치는 만들지 않습니다.
## Higgsfield 실제 생성 연결

대시보드의 `스토리보드 실제 생성`과 `영상 실제 생성` 버튼은 Higgsfield 공식 CLI를 사용합니다.

```powershell
npm install -g @higgsfield/cli
higgsfield auth login
higgsfield workspace list
higgsfield workspace set <workspace_id>
```

- 인증 토큰은 Higgsfield CLI의 사용자 저장소에만 보관되며 프로젝트·브라우저·JSON 파일에는 기록하지 않습니다.
- 스토리보드는 Nano Banana 2 Lite / Nano Banana 2 / Nano Banana Pro로 실제 PNG를 생성합니다.
- 영상은 Higgsfield로 지정한 컷만 Cinema Studio 4.0 / Seedance 2.0 / Kling 3.0으로 실제 MP4를 생성합니다.
- Google Flow 웹 구독은 공개 생성 API가 없으므로 Flow 컷은 웹 수동 실행으로 남습니다.
- 실행 전 예상 크레딧과 잔여 크레딧을 확인하고 사용자가 확인해야 생성이 시작됩니다.
- 생성 이미지: `output/episodes/<EPISODE_ID>/stills/cNN.png`
- 생성 영상: `output/episodes/<EPISODE_ID>/clips/cNN_silent.mp4`
- 생성 기록: `output/episodes/<EPISODE_ID>/generation/`

실제 생성 API는 `127.0.0.1`에서만 열리고, 외부 Origin 요청·잘못된 컷 번호·동일 컷 중복 작업을 차단합니다.
## Google Flow 프롬프트 작업대

- Flow는 웹 수동 실행으로 유지하며, 대시보드의 `Flow 프롬프트 패키지 만들기`가 18컷의 이미지·영상 프롬프트를 JSON과 Markdown으로 저장합니다.
- 산출물은 `output/episodes/<EPISODE_ID>/flow_prompt_package.json`과 `flow_prompt_package.md`입니다.
- 컷 상세에서 현재 프롬프트 언어를 한국어/영어로 전환하고, Flow 프롬프트를 수정·저장·복사할 수 있습니다.
- 이미지 프롬프트는 한 장소·한 순간·한 핵심 정보로 제한합니다. 영상 프롬프트는 한 동작·한 카메라 이동·무음으로 제한합니다.
- 컷마다 Flow Ingredients/Frames에 첨부할 우선 레퍼런스를 최대 3개만 제안합니다. API 키·로그인·Google 계정 정보는 저장하지 않습니다.

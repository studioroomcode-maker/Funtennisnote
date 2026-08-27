const categoryDefinitions = [
  {
    id: "ball",
    label: "공과 재료",
    tone: "재료공학",
    sourceHint: "ITF Technical Centre·공 제조 기술자료",
    visual: "테니스공 단면·압력·펠트 섬유 시뮬레이션",
    titles: [
      "테니스공은 왜 완벽한 구가 아닐까",
      "새 공을 따뜻하게 보관하면 바운드가 달라질까",
      "테니스공 캔 안에는 왜 압력이 들어 있을까",
      "공을 꺼내는 순간부터 수명이 줄어드는 이유",
      "테니스공의 털은 왜 한 방향으로 눕는가",
      "같은 노란 공인데 경기마다 색이 달라 보이는 이유",
      "고지대에서는 왜 다른 테니스공이 필요할까",
      "비에 젖은 공이 갑자기 무거워지는 과정",
      "새 공과 헌 공은 공기역학부터 다르다",
      "테니스공의 흰 곡선 솔기는 왜 저 모양일까",
      "공 한 개의 무게 허용치는 얼마나 좁을까",
      "테니스공은 몇 번 튀어야 합격할까",
      "공의 펠트가 속도를 늦추는 정확한 방식",
      "무압구는 정말 영원히 사용할 수 있을까",
      "테니스공을 냉장고에 넣으면 오래갈까",
      "노란 공보다 더 잘 보이는 색은 없을까",
      "어린이용 빨간 공은 왜 크고 느릴까",
      "테니스공이 라켓에 닿을 때 얼마나 찌그러질까",
      "한 경기에서 공의 지름은 얼마나 변할까",
      "프로 대회가 공 브랜드를 바꾸면 무슨 일이 생길까"
    ]
  },
  {
    id: "racket",
    label: "라켓 공학",
    tone: "구조공학",
    sourceHint: "ITF 라켓 기술자료·제조사 사양서·스포츠공학 연구",
    visual: "라켓 프레임 단면·진동·관성모멘트 디오라마",
    titles: [
      "라켓 헤드가 커질수록 정말 쉬워질까",
      "프로가 작은 라켓을 고집하는 진짜 이유",
      "라켓 프레임 속은 왜 비어 있을까",
      "카본 라켓은 어떻게 나무 라켓을 밀어냈나",
      "라켓 무게보다 스윙웨이트가 중요한 이유",
      "같은 300그램 라켓이 다르게 느껴지는 이유",
      "라켓 밸런스가 손목에 만드는 차이",
      "두꺼운 프레임은 왜 공을 더 쉽게 밀어낼까",
      "라켓의 스위트스폿은 정말 한 점일까",
      "라켓을 길게 만들면 서브가 빨라질까",
      "프로 라켓 안에 납 테이프가 숨어 있는 이유",
      "라켓 그로밋이 없으면 스트링은 어떻게 될까",
      "오래된 카본 라켓도 탄성이 죽을까",
      "라켓 진동 방지 기술은 팔을 지켜줄까",
      "프레임이 휘는 순간 공의 방향이 바뀐다",
      "라켓 도색만 바꾼 프로 스톡의 비밀",
      "정품 라켓과 프로 선수 라켓은 정말 같을까",
      "라켓 헤드 모양이 타구점을 바꾸는 방식",
      "한 손 백핸드에 무거운 라켓이 유리한 이유",
      "미래의 테니스 라켓은 센서가 기본이 될까"
    ]
  },
  {
    id: "string",
    label: "스트링·그립",
    tone: "장비과학",
    sourceHint: "ITF 스트링 연구·제조사 기술자료·스포츠공학 논문",
    visual: "스트링베드 확대·스냅백·마찰·장력 그래프",
    titles: [
      "테니스 줄은 왜 세게 맬수록 공이 덜 나갈까",
      "폴리 스트링이 스핀을 만드는 진짜 원리",
      "스트링은 끊어지지 않아도 이미 죽어 있다",
      "프로는 왜 경기 중 라켓을 비닐에서 꺼낼까",
      "온도가 내려가면 스트링 장력은 어떻게 변할까",
      "세로줄과 가로줄 장력을 다르게 매는 이유",
      "천연 거트는 왜 아직도 사라지지 않았을까",
      "하이브리드 스트링은 무엇을 타협한 조합일까",
      "스트링 패턴 16×19와 18×20의 실제 차이",
      "스트링 굵기 0.05밀리미터가 만드는 변화",
      "라켓 줄이 움직였다 돌아오는 스냅백의 비밀",
      "새로 맨 줄이 첫날부터 장력을 잃는 이유",
      "댐프너는 진동을 줄일까 소리만 바꿀까",
      "오버그립을 두껍게 감으면 스윙이 달라질까",
      "그립 사이즈가 작으면 스핀이 늘어날까",
      "가죽 그립을 고집하는 선수들의 이유",
      "땀에 젖은 그립은 왜 갑자기 미끄러질까",
      "스트링 머신의 당기는 속도도 결과를 바꾼다",
      "매듭 네 개와 두 개는 무엇이 다를까",
      "라켓 한 자루에 스트링은 몇 미터가 들어갈까"
    ]
  },
  {
    id: "court",
    label: "코트·표면",
    tone: "표면공학",
    sourceHint: "ITF Court Pace·코트 건설 자료·대회 공식 자료",
    visual: "코트 단면·마찰·바운드 궤적 비교",
    titles: [
      "클레이코트는 왜 공을 느리게 만들까",
      "잔디코트의 공은 정말 낮게 깔릴까",
      "하드코트는 전부 같은 바닥이 아니다",
      "코트 색깔이 경기 속도에 영향을 줄까",
      "테니스 코트 아래에는 몇 개의 층이 있을까",
      "클레이코트에 물을 뿌리는 진짜 이유",
      "잔디를 8밀리미터로 자르면 무엇이 달라질까",
      "실내 코트가 야외보다 빠르게 느껴지는 이유",
      "해발고도가 코트 속도를 바꾸는 방식",
      "비가 온 뒤 하드코트가 위험한 이유",
      "클레이 라인은 왜 바닥에 박혀 있을까",
      "잔디코트는 2주 동안 어떻게 살아남을까",
      "파란 하드코트가 세계 표준처럼 번진 이유",
      "카펫 코트는 왜 프로 투어에서 사라졌을까",
      "코트 페이스 등급은 어떻게 측정할까",
      "같은 코트도 새 공일 때 더 빠른 이유",
      "햇빛 방향이 코트 설계를 바꾸는 방식",
      "센터코트 지붕을 닫으면 경기가 달라질까",
      "테니스 네트 중앙이 더 낮은 이유",
      "단식 코트와 복식 코트는 왜 한 바닥을 공유할까"
    ]
  },
  {
    id: "rules",
    label: "규칙·점수",
    tone: "규칙해설",
    sourceHint: "ITF Rules of Tennis·Grand Slam Rulebook",
    visual: "코트 미니어처·판정선·점수 기계 시뮬레이션",
    titles: [
      "테니스 점수는 왜 15 30 40일까",
      "40 다음이 45가 아닌 이유",
      "듀스는 왜 두 점 차가 날 때까지 끝나지 않을까",
      "서브는 왜 두 번의 기회를 줄까",
      "렛 서브는 왜 다시 치게 해줄까",
      "공이 네트 기둥을 돌아 들어가도 득점일까",
      "라켓이 손에서 빠져 공을 맞히면 득점일까",
      "공이 새를 맞고 들어가면 누가 점수를 얻을까",
      "상대 코트로 넘어가 공을 쳐도 되는 순간",
      "공이 라켓 프레임에 두 번 맞으면 반칙일까",
      "모자를 떨어뜨리면 포인트를 다시 할까",
      "심판이 점수를 잘못 말하면 언제 고칠 수 있을까",
      "풋폴트는 정확히 어느 순간 결정될까",
      "타이브레이크는 왜 7점에서 끝날까",
      "마지막 세트 규칙이 대회마다 달랐던 이유",
      "노애드 스코어는 왜 만들어졌을까",
      "체인지오버 시간은 왜 90초일까",
      "화장실 브레이크에도 세부 규칙이 있다",
      "라켓을 부수면 왜 점수가 깎일 수 있을까",
      "전자 판정 시대에도 주심이 필요한 이유"
    ]
  },
  {
    id: "serve",
    label: "서브·리턴",
    tone: "동작분석",
    sourceHint: "ITF 코칭 자료·생체역학 연구·선수 추적 데이터",
    visual: "관절 체인·라켓 궤적·공 회전 벡터",
    titles: [
      "서브가 유일하게 선수가 공을 놓는 샷인 이유",
      "프로의 토스가 생각보다 낮은 이유",
      "서브 속도는 팔보다 다리에서 시작된다",
      "플랫 서브에도 사실 회전이 들어 있다",
      "킥서브는 어떻게 공을 위로 튀게 할까",
      "슬라이스 서브가 코트 밖으로 도망가는 이유",
      "키가 크면 서브에 얼마나 유리할까",
      "서브 임팩트가 머리 위가 아닌 앞에 있는 이유",
      "트로피 자세는 정말 멈추는 동작일까",
      "프로는 왜 두 번째 서브를 더 세게 회전시킬까",
      "서브 토스가 바람에 흔들릴 때 생기는 일",
      "왼손잡이 서브가 유독 까다로운 이유",
      "리턴 위치가 베이스라인 뒤로 멀어진 이유",
      "빠른 서브는 왜 짧게 막아야 할까",
      "세컨드 서브를 공격하는 가장 위험한 순간",
      "바디 서브가 속도보다 무서운 이유",
      "서브 코스는 공을 치기 전에 들킬까",
      "에이스와 서비스 위너는 무엇이 다를까",
      "서브 속도 측정기는 공의 어느 순간을 잴까",
      "언더암 서브는 비매너일까 전략일까"
    ]
  },
  {
    id: "stroke",
    label: "스트로크·몸",
    tone: "생체역학",
    sourceHint: "스포츠 생체역학 연구·ITF 코칭 자료",
    visual: "관절 각도·운동사슬·임팩트 단면",
    titles: [
      "포핸드는 팔로 치는 샷이 아니다",
      "공을 끝까지 보라는 말은 물리적으로 가능할까",
      "프로의 라켓이 임팩트 직전 뒤처지는 이유",
      "탑스핀 공은 왜 갑자기 코트 안으로 떨어질까",
      "백스핀이 바운드 뒤에 미끄러지는 이유",
      "한 손 백핸드는 왜 높은 공에 약할까",
      "두 손 백핸드에서 오른손과 왼손의 역할",
      "오픈 스탠스가 현대 테니스의 기본이 된 이유",
      "런닝 포핸드에서 몸이 공중에 뜨는 이유",
      "프로는 왜 임팩트 때 소리를 낼까",
      "공을 세게 칠수록 힘을 빼야 하는 역설",
      "테니스 엘보는 백핸드 때문에만 생길까",
      "무릎을 굽히라는 조언이 항상 맞지는 않다",
      "라켓면은 임팩트 순간 얼마나 닫혀 있을까",
      "스핀량과 공 속도는 동시에 늘릴 수 있을까",
      "슬라이스 백핸드가 수비 이상의 무기인 이유",
      "발리에서는 왜 스윙을 줄여야 할까",
      "스매시는 서브와 같은 동작일까",
      "공이 몸에 가까울수록 라켓 속도가 줄어드는 이유",
      "프로의 풋워크가 조용해 보이는 이유"
    ]
  },
  {
    id: "strategy",
    label: "전술·심리",
    tone: "전술분석",
    sourceHint: "포인트 패턴 데이터·코칭 자료·경기 통계",
    visual: "코트 히트맵·선택 트리·공 궤적",
    titles: [
      "테니스에서 가운데로 치는 공이 가장 공격적일 때",
      "상대의 백핸드만 노리면 왜 역으로 당할까",
      "다운더라인이 크로스보다 위험한 정확한 이유",
      "브레이크 포인트에서 서브 코스가 달라지는 이유",
      "프로가 짧은 공을 놓치지 않는 첫 번째 신호",
      "수비할 때 공을 높게 보내는 물리적 이유",
      "네트로 나갈 타이밍은 공의 위치가 결정한다",
      "랠리 중 방향을 바꾸면 안 되는 공이 있다",
      "깊은 공 한 개가 다음 두 샷을 만드는 방식",
      "상대의 시간을 빼앗는다는 말의 정확한 뜻",
      "테니스에서 가장 위험한 점수 40대0의 역설",
      "첫 세트 승자가 경기를 놓치는 이유",
      "타이브레이크에서 미니브레이크는 정말 미니일까",
      "프로가 중요한 순간 루틴을 반복하는 이유",
      "언포스드 에러는 정말 강요받지 않은 실수일까",
      "왼손잡이를 상대할 때 코트가 뒤집히는 이유",
      "복식에서 가운데 공은 누구의 것일까",
      "서브앤발리는 왜 사라졌고 다시 돌아올까",
      "클레이와 잔디에서 랠리 위치가 달라지는 이유",
      "상대가 지쳤다는 신호는 스윙보다 발에서 나온다"
    ]
  },
  {
    id: "history",
    label: "역사·문화",
    tone: "역사다큐",
    sourceHint: "ITF 역사자료·테니스 명예의 전당·대회 아카이브",
    visual: "시대별 장비·복식·코트 변천 디오라마",
    titles: [
      "테니스는 왜 귀족의 운동이 되었을까",
      "테니스라는 이름은 어디에서 왔을까",
      "맨손으로 치던 경기가 라켓 스포츠가 된 과정",
      "흰색 테니스복이 규칙이 된 진짜 이유",
      "여자 선수의 복장이 테니스를 바꾼 순간",
      "나무 라켓 시대의 경기는 얼마나 느렸을까",
      "오픈 시대는 왜 1968년에 시작됐을까",
      "프로 선수가 대회에 못 나오던 시대가 있었다",
      "타이브레이크가 테니스에 처음 등장한 이유",
      "테니스공이 노란색으로 바뀐 진짜 이유",
      "윔블던이 끝까지 흰 공을 고집했던 이유",
      "테니스 코트가 모래시계 모양이었던 시절",
      "그랜드슬램이라는 말은 원래 테니스 용어가 아니다",
      "세계 랭킹이 없던 시절 1위는 어떻게 정했을까",
      "동전 던지기가 경기 시작을 결정하는 이유",
      "볼보이와 볼걸의 역할은 언제 생겼을까",
      "관중이 조용해야 한다는 문화는 어디서 왔을까",
      "테니스에서 매너가 규칙보다 먼저였던 시대",
      "야간 경기가 테니스 흥행을 바꾼 과정",
      "컬러 텔레비전이 테니스 장비를 바꾼 순간"
    ]
  },
  {
    id: "venue",
    label: "경기장·대회",
    tone: "건축·운영",
    sourceHint: "대회 공식 자료·경기장 설계 자료·시설 운영 보고서",
    visual: "경기장 단면·지붕·조명·관중 동선 시뮬레이션",
    titles: [
      "센터코트 지붕은 왜 완전히 밀폐되지 않을까",
      "테니스 경기장 조명은 공을 어떻게 따라갈까",
      "윔블던 잔디는 대회 1년 전부터 준비된다",
      "롤랑가로스의 붉은 흙은 사실 한 종류가 아니다",
      "아서 애시 스타디움 지붕이 따로 움직이는 이유",
      "테니스 경기장 관중석이 코트에 붙어 있는 이유",
      "센터코트 아래에는 얼마나 많은 공간이 있을까",
      "비가 오면 코트를 말리는 순서가 정해져 있다",
      "대회는 하루에 수만 개 공을 어떻게 관리할까",
      "새 공 교체 타이밍이 7게임 뒤인 이유",
      "선수 라커룸에서 코트까지 동선이 분리되는 이유",
      "경기장 바람을 완전히 막지 않는 이유",
      "챌린저 대회와 그랜드슬램 코트는 무엇이 다를까",
      "임시 테니스 코트는 며칠 만에 어떻게 만들어질까",
      "실내 경기장의 천장이 높아야 하는 이유",
      "관중 소음이 경기장 구조에 따라 달라지는 이유",
      "코트 뒤 공간은 왜 규정보다 넓게 만들까",
      "대형 전광판이 선수 시야를 방해하지 않는 방법",
      "대회마다 공 보관실 온도를 관리하는 이유",
      "한 경기 뒤 클레이코트를 7분 만에 복구하는 과정"
    ]
  },
  {
    id: "technology",
    label: "기술·데이터",
    tone: "테크다큐",
    sourceHint: "ITF PAT·전자 판정 기술자료·대회 기술 보고서",
    visual: "카메라 배열·3D 궤적·센서 데이터 시각화",
    titles: [
      "호크아이는 공의 자국을 직접 보는 기술이 아니다",
      "전자 판정은 공이 떨어지기 전에 결과를 알까",
      "라인 카메라는 왜 코트 주변에 여러 대가 필요할까",
      "공의 속도는 레이더 하나로 측정하지 않는다",
      "실시간 승률 그래프는 무엇을 보고 계산할까",
      "선수의 이동거리는 어떻게 자동 측정할까",
      "테니스 중계의 가상 공 궤적은 어떻게 만들어질까",
      "넷 터치 센서는 얼마나 작은 진동을 잡을까",
      "스마트 라켓은 어떤 데이터를 실제로 측정할까",
      "AI가 서브 코스를 미리 예측할 수 있을까",
      "전자 판정에도 오차 범위가 존재하는 이유",
      "리플레이 화면과 공식 판정 화면은 왜 다를까",
      "경기 데이터에서 스핀량을 추정하는 방법",
      "선수 추적 카메라가 사람을 놓치지 않는 이유",
      "테니스 중계 카메라의 위치가 정해져 있는 이유",
      "마이크는 라켓 소리와 관중 소리를 어떻게 나눌까",
      "웨어러블 센서는 공식 경기에서 허용될까",
      "디지털 트윈으로 코트 속도를 예측할 수 있을까",
      "AI 코칭이 사람 코치와 다른 데이터를 보는 방식",
      "자동 하이라이트는 어떤 포인트를 명장면으로 고를까"
    ]
  },
  {
    id: "mystery",
    label: "미스터리·오해",
    tone: "팩트체크",
    sourceHint: "ITF 규정·공식 기록·스포츠과학 연구",
    visual: "상식과 실제를 대비하는 분할 디오라마",
    titles: [
      "테니스공을 전자레인지에 넣으면 되살아날까",
      "비싼 라켓이 정말 공을 더 빠르게 만들까",
      "프로 선수는 경기 중 새 라켓만 사용할까",
      "탑스핀 공은 바운드 뒤 정말 빨라질까",
      "무거운 라켓이 테니스 엘보를 만든다는 오해",
      "댐프너를 달면 부상을 막을 수 있을까",
      "줄을 세게 매면 컨트롤이 무조건 좋아질까",
      "클레이코트에서는 서브가 의미 없다는 오해",
      "잔디코트는 공이 미끄러지기만 할까",
      "키가 작으면 강한 서브가 불가능할까",
      "두 손 백핸드는 한 손보다 힘이 셀까",
      "프로는 공을 임팩트 순간까지 볼 수 있을까",
      "테니스는 유산소 운동일까 무산소 운동일까",
      "첫 서브 성공률은 높을수록 무조건 좋을까",
      "네트에 맞고 들어간 공은 운일 뿐일까",
      "새 공은 항상 헌 공보다 빠를까",
      "왼손잡이는 실제로 테니스에 유리할까",
      "공을 세게 치면 스핀이 줄어든다는 오해",
      "라켓을 자주 바꾸면 실력이 떨어질까",
      "테니스에서 가장 중요한 샷은 포핸드일까"
    ]
  }
];

function hashScore(text) {
  let value = 17;
  for (const character of text) value = (value * 31 + character.charCodeAt(0)) % 9973;
  return 72 + (value % 27);
}

const hookTemplates = [
  (title) => `우리가 당연하게 여긴 상식을 뒤집고 “${title}”의 진짜 구조를 추적합니다.`,
  (title) => `눈에는 단순해 보이지만 결과를 바꾸는 숨은 원리가 있습니다. ${title}.`,
  (title) => `현장에서는 보이지 않던 결정적 차이를 단면과 수치로 보여줍니다. ${title}.`,
  (title) => `같아 보이는 두 상황을 나란히 비교하면 답이 완전히 달라집니다. ${title}.`
];

export function buildEpisodeCatalog() {
  let index = 0;
  return categoryDefinitions.flatMap((category, categoryIndex) =>
    category.titles.map((title, titleIndex) => {
      index += 1;
      const verified = title === "테니스공이 노란색으로 바뀐 진짜 이유";
      return {
        id: `FTN-IDEA-${String(index).padStart(3, "0")}`,
        number: index,
        title,
        category: category.id,
        categoryLabel: category.label,
        tone: category.tone,
        hook: hookTemplates[(titleIndex + categoryIndex) % hookTemplates.length](title),
        sourceHint: category.sourceHint,
        visual: category.visual,
        score: verified ? 98 : hashScore(title),
        verification: verified ? "verified" : "research_required",
        targetSeconds: [60, 75, 90][(titleIndex + categoryIndex) % 3],
        recommendedProvider: ["venue", "racket", "court"].includes(category.id) ? "higgsfield" : "flow",
        tags: [category.label, category.tone, title.includes("왜") ? "원인" : "비교"]
      };
    })
  );
}

export const catalogCategories = categoryDefinitions.map(({ id, label }) => ({ id, label }));




export const pilotEpisodes = [
  {
    id: "FTN-PILOT-01", number: 1, series: "pilot", title: "너무 강한 회전 때문에 금지된 라켓",
    hook: "이 라켓은 등장하자마자 테니스 규칙을 바꿔버렸습니다.",
    core: "스파게티 스트링 구조와 금지 사건", category: "string", categoryLabel: "스트링·그립", tone: "규칙을 바꾼 장비",
    visual: "이중 스트링 구조의 초정밀 단면, 공이 스트링 사이에 머물며 비정상 회전이 커지는 모션 시뮬레이션",
    sourceHint: "ITF 라켓·스트링 규정, 스파게티 스트링 금지 관련 공식 기록", score: 100, verification: "research_required",
    targetSeconds: 75, recommendedProvider: "flow", tags: ["파일럿", "금지 장비", "스파게티 스트링"]
  },
  {
    id: "FTN-PILOT-02", number: 2, series: "pilot", title: "테니스공이 노란색이 된 진짜 이유",
    hook: "노란 테니스공은 선수가 아니라 TV 시청자를 위해 등장했습니다.",
    core: "1972년 옵틱 옐로 공 도입", category: "history", categoryLabel: "역사·인물", tone: "방송이 바꾼 색",
    visual: "흑백 텔레비전 화면과 코트 디오라마를 분할해 흰 공과 옵틱 옐로 공의 시인성을 비교",
    sourceHint: "ITF 공인구 역사 자료, 윔블던 공식 기록", score: 99, verification: "verified",
    targetSeconds: 78, recommendedProvider: "flow", tags: ["파일럿", "옵틱 옐로", "1972"]
  },
  {
    id: "FTN-PILOT-03", number: 3, series: "pilot", title: "11시간 5분 동안 끝나지 않은 경기",
    hook: "이 경기는 하루가 지나도 끝나지 않았습니다.",
    core: "2010년 이스너–마위의 윔블던 경기", category: "history", categoryLabel: "역사·인물", tone: "기록적 경기",
    visual: "윔블던 코트 위 시계와 스코어보드가 사흘에 걸쳐 누적되는 압축 타임라인 디오라마",
    sourceHint: "Wimbledon 공식 경기 기록, ATP 선수·경기 기록", score: 98, verification: "research_required",
    targetSeconds: 75, recommendedProvider: "flow", tags: ["파일럿", "이스너", "마위", "11시간 5분"]
  },
  {
    id: "FTN-PILOT-04", number: 4, series: "pilot", title: "테니스공 안에는 무엇이 들어 있을까?",
    hook: "새 공 통을 열 때 소리가 나는 이유는 공 안에 있습니다.",
    core: "고무 반구·내부 압력·펠트 제조 과정", category: "ball", categoryLabel: "공과 재료", tone: "제조 단면",
    visual: "고무 반구 접착, 가압, 펠트 부착 순서를 보여주는 공장형 단면 디오라마",
    sourceHint: "ITF Technical Centre, 테니스공 제조사 기술자료", score: 97, verification: "research_required",
    targetSeconds: 75, recommendedProvider: "flow", tags: ["파일럿", "공 제조", "내부 압력"]
  },
  {
    id: "FTN-PILOT-05", number: 5, series: "pilot", title: "세계 1위를 흔든 단 한 번의 언더핸드 서브",
    hook: "경련으로 서브를 넣기 힘들어진 17세 선수는 공을 밑으로 쳤습니다.",
    core: "1989년 마이클 창과 이반 렌들의 경기", category: "history", categoryLabel: "역사·인물", tone: "승부의 반전",
    visual: "정상 서브와 언더핸드 서브의 궤적을 대비하고 렌들의 리턴 위치 변화를 보여주는 경기 디오라마",
    sourceHint: "Roland-Garros 공식 기록, ATP 경기 기록 및 선수 인터뷰", score: 96, verification: "research_required",
    targetSeconds: 75, recommendedProvider: "flow", tags: ["파일럿", "마이클 창", "언더핸드 서브"]
  },
  {
    id: "FTN-PILOT-06", number: 6, series: "pilot", title: "카본 라켓은 어떻게 만들어질까?",
    hook: "현대 라켓은 금속을 깎아 만드는 제품이 아닙니다.",
    core: "카본 시트 적층·공기압 성형·가열 과정", category: "racket", categoryLabel: "라켓 공학", tone: "공정 시뮬레이션",
    visual: "카본 프리프레그 적층부터 블래더 몰딩과 오븐 경화까지 이어지는 미니어처 공장",
    sourceHint: "라켓 제조사 공정 자료, 복합재 성형 기술자료", score: 95, verification: "research_required",
    targetSeconds: 75, recommendedProvider: "higgsfield", tags: ["파일럿", "카본", "라켓 제조"]
  },
  {
    id: "FTN-PILOT-07", number: 7, series: "pilot", title: "호크아이는 공의 자국을 보는 걸까?",
    hook: "호크아이는 코트 위의 공 자국을 직접 보는 장비가 아닙니다.",
    core: "카메라 영상과 궤적 계산, 도입 과정", category: "technology", categoryLabel: "기술·미래", tone: "측정 기술",
    visual: "여러 카메라의 시선이 공에 교차하고 3D 좌표와 가상 바운드 마크가 계산되는 기술 디오라마",
    sourceHint: "Hawk-Eye Innovations 공식 기술 설명, ITF 전자 판정 규정", score: 94, verification: "research_required",
    targetSeconds: 75, recommendedProvider: "flow", tags: ["파일럿", "호크아이", "전자 판정"]
  },
  {
    id: "FTN-PILOT-08", number: 8, series: "pilot", title: "윔블던 잔디코트를 만드는 방법",
    hook: "윔블던의 잔디는 경기 직전에 깎는 평범한 잔디가 아닙니다.",
    core: "파종·다짐·급수·깎기·라인 작업", category: "court", categoryLabel: "코트 과학", tone: "그라운드 공정",
    visual: "계절별 파종과 토양 다짐, 급수, 정밀 예초, 흰 선 작업이 이어지는 올잉글랜드클럽 디오라마",
    sourceHint: "Wimbledon 공식 잔디 관리 자료, 스포츠 터프 관리 기술자료", score: 93, verification: "research_required",
    targetSeconds: 90, recommendedProvider: "higgsfield", tags: ["파일럿", "윔블던", "잔디코트"]
  },
  {
    id: "FTN-PILOT-09", number: 9, series: "pilot", title: "끝없는 경기를 멈춘 타이브레이크",
    hook: "예전 테니스에는 6대6이 되어도 경기를 끝낼 방법이 없었습니다.",
    core: "지미 밴 앨런과 타이브레이크 도입", category: "rules", categoryLabel: "규칙·판정", tone: "규칙의 발명",
    visual: "끝없이 늘어나는 게임 스코어가 7포인트 타이브레이크 구조로 접히는 규칙 인포그래픽",
    sourceHint: "International Tennis Hall of Fame, ITF 테니스 규칙 역사", score: 92, verification: "research_required",
    targetSeconds: 75, recommendedProvider: "flow", tags: ["파일럿", "타이브레이크", "지미 밴 앨런"]
  },
  {
    id: "FTN-PILOT-10", number: 10, series: "pilot", title: "위로 친 공이 아래로 떨어지는 이유",
    hook: "선수는 공을 위로 휘두르는데 공은 오히려 아래로 떨어집니다.",
    core: "탑스핀과 공기역학", category: "stroke", categoryLabel: "스트로크 역학", tone: "공기역학",
    visual: "회전하는 공 주변 압력 차와 마그누스 힘 화살표, 궤적 변화를 보여주는 풍동형 디오라마",
    sourceHint: "ITF 스포츠과학 자료, 탑스핀과 마그누스 효과 연구", score: 91, verification: "research_required",
    targetSeconds: 75, recommendedProvider: "flow", tags: ["파일럿", "탑스핀", "마그누스 효과"]
  }
];




export const curatedEpisodes = [
  {
    id: "FTN-CURATED-01", number: 1, series: "curated", title: "테니스 점수는 왜 15·30·40으로 올라갈까",
    hook: "세 번째 점수만 45가 아니라 40입니다. 이 이상한 숫자에는 테니스의 오래된 흔적이 남아 있습니다.", core: "러브·15·30·40 점수 체계의 기원과 여러 역사적 가설",
    category: "rules", categoryLabel: "규칙·판정", tone: "점수의 미스터리",
    visual: "러브·15·30·40 점수 체계의 기원과 여러 역사적 가설를 빠른 멀티컷 3D 디오라마와 단면·궤적 인포그래픽으로 시각화",
    sourceHint: "ITF 테니스 역사·공식 규칙 자료", score: 98, verification: "research_required",
    targetSeconds: 60, recommendedProvider: "flow", tags: ["후속 강력 후보", "규칙·판정", "점수의 미스터리"]
  },
  {
    id: "FTN-CURATED-02", number: 2, series: "curated", title: "서브는 왜 한 번이 아니라 두 번일까",
    hook: "테니스는 첫 실수를 한 번 더 용서하도록 설계된 스포츠입니다.", core: "1876년 규칙 개정과 두 번의 서브가 정착한 과정",
    category: "rules", categoryLabel: "규칙·판정", tone: "규칙의 탄생",
    visual: "1876년 규칙 개정과 두 번의 서브가 정착한 과정를 빠른 멀티컷 3D 디오라마와 단면·궤적 인포그래픽으로 시각화",
    sourceHint: "ITF 테니스 역사 자료", score: 98, verification: "research_required",
    targetSeconds: 75, recommendedProvider: "flow", tags: ["후속 강력 후보", "규칙·판정", "규칙의 탄생"]
  },
  {
    id: "FTN-CURATED-03", number: 3, series: "curated", title: "새 공 통을 열면 왜 ‘퍽’ 소리가 날까",
    hook: "그 소리는 뚜껑이 아니라 공을 늙지 않게 붙잡던 압력이 빠지는 소리입니다.", core: "가압 캔과 테니스공 내부 압력의 균형",
    category: "ball", categoryLabel: "공과 재료", tone: "압력의 비밀",
    visual: "가압 캔과 테니스공 내부 압력의 균형를 빠른 멀티컷 3D 디오라마와 단면·궤적 인포그래픽으로 시각화",
    sourceHint: "ITF Ball Manufacture·Ball Research", score: 98, verification: "research_required",
    targetSeconds: 90, recommendedProvider: "flow", tags: ["후속 강력 후보", "공과 재료", "압력의 비밀"]
  },
  {
    id: "FTN-CURATED-04", number: 4, series: "curated", title: "경기 첫 새 공은 왜 7게임 만에 교체될까",
    hook: "새 공 교체 주기는 처음만 짧습니다. 워밍업이 이미 두 게임으로 계산되기 때문입니다.", core: "첫 7게임 이후 매 9게임마다 이뤄지는 볼 체인지 규정",
    category: "rules", categoryLabel: "규칙·판정", tone: "숨은 경기 규칙",
    visual: "첫 7게임 이후 매 9게임마다 이뤄지는 볼 체인지 규정를 빠른 멀티컷 3D 디오라마와 단면·궤적 인포그래픽으로 시각화",
    sourceHint: "Grand Slam·ATP 공식 경기 규정", score: 97, verification: "research_required",
    targetSeconds: 60, recommendedProvider: "flow", tags: ["후속 강력 후보", "규칙·판정", "숨은 경기 규칙"]
  },
  {
    id: "FTN-CURATED-05", number: 5, series: "curated", title: "서버는 왜 공 세 개를 받은 뒤 하나를 버릴까",
    hook: "선수가 고르는 것은 브랜드가 아니라 표면의 털과 마모 상태입니다.", core: "서브 전 공 선택과 펠트 상태가 비행에 미치는 영향",
    category: "strategy", categoryLabel: "전술·심리", tone: "작은 선택의 과학",
    visual: "서브 전 공 선택과 펠트 상태가 비행에 미치는 영향를 빠른 멀티컷 3D 디오라마와 단면·궤적 인포그래픽으로 시각화",
    sourceHint: "ITF Ball Research·선수 인터뷰", score: 97, verification: "research_required",
    targetSeconds: 75, recommendedProvider: "flow", tags: ["후속 강력 후보", "전술·심리", "작은 선택의 과학"]
  },
  {
    id: "FTN-CURATED-06", number: 6, series: "curated", title: "소의 창자로 만든 줄이 아직도 최고급인 이유",
    hook: "최첨단 카본 라켓 안에서도 가장 비싼 줄은 천연 재료로 만들어집니다.", core: "천연 거트의 제조·탄성·장력 유지 특성",
    category: "string", categoryLabel: "스트링·그립", tone: "재료의 역설",
    visual: "천연 거트의 제조·탄성·장력 유지 특성를 빠른 멀티컷 3D 디오라마와 단면·궤적 인포그래픽으로 시각화",
    sourceHint: "ITF Strings Research·제조사 기술자료", score: 97, verification: "research_required",
    targetSeconds: 90, recommendedProvider: "flow", tags: ["후속 강력 후보", "스트링·그립", "재료의 역설"]
  },
  {
    id: "FTN-CURATED-07", number: 7, series: "curated", title: "카본 라켓 속이 텅 비어 있는 이유",
    hook: "단단한 라켓은 꽉 찬 막대가 아니라 속이 빈 껍질입니다.", core: "중공 프레임과 블래더 몰딩, 강성 대비 무게",
    category: "racket", categoryLabel: "라켓 공학", tone: "구조의 반전",
    visual: "중공 프레임과 블래더 몰딩, 강성 대비 무게를 빠른 멀티컷 3D 디오라마와 단면·궤적 인포그래픽으로 시각화",
    sourceHint: "ITF Racket Manufacture·복합재 성형 자료", score: 96, verification: "research_required",
    targetSeconds: 60, recommendedProvider: "higgsfield", tags: ["후속 강력 후보", "라켓 공학", "구조의 반전"]
  },
  {
    id: "FTN-CURATED-08", number: 8, series: "curated", title: "스위트스폿은 정말 한 점일까",
    hook: "라켓의 스위트스폿을 표시하려 해도 정확한 점 하나를 찍을 수는 없습니다.", core: "타격 중심·진동 노드·최대 반발 영역의 차이",
    category: "racket", categoryLabel: "라켓 공학", tone: "보이지 않는 구역",
    visual: "타격 중심·진동 노드·최대 반발 영역의 차이를 빠른 멀티컷 3D 디오라마와 단면·궤적 인포그래픽으로 시각화",
    sourceHint: "ITF Racket Anatomy·스포츠공학 연구", score: 96, verification: "research_required",
    targetSeconds: 75, recommendedProvider: "flow", tags: ["후속 강력 후보", "라켓 공학", "보이지 않는 구역"]
  },
  {
    id: "FTN-CURATED-09", number: 9, series: "curated", title: "댐프너는 팔보다 귀를 먼저 바꾼다",
    hook: "작은 고무 조각은 라켓 전체 충격보다 줄의 고음부터 지웁니다.", core: "스트링 진동과 프레임 충격의 차이",
    category: "string", categoryLabel: "스트링·그립", tone: "장비 오해",
    visual: "스트링 진동과 프레임 충격의 차이를 빠른 멀티컷 3D 디오라마와 단면·궤적 인포그래픽으로 시각화",
    sourceHint: "ITF Rackets and Strings Research", score: 96, verification: "research_required",
    targetSeconds: 90, recommendedProvider: "flow", tags: ["후속 강력 후보", "스트링·그립", "장비 오해"]
  },
  {
    id: "FTN-CURATED-10", number: 10, series: "curated", title: "롤랑가로스 코트는 흙이 아니라 벽돌에 가깝다",
    hook: "붉은 코트의 맨 위에는 평범한 흙 대신 잘게 부순 벽돌이 깔립니다.", core: "클레이코트의 다층 구조와 표면 재료",
    category: "court", categoryLabel: "코트 과학", tone: "표면의 단면",
    visual: "클레이코트의 다층 구조와 표면 재료를 빠른 멀티컷 3D 디오라마와 단면·궤적 인포그래픽으로 시각화",
    sourceHint: "Roland-Garros 공식 코트 관리 자료", score: 95, verification: "research_required",
    targetSeconds: 60, recommendedProvider: "higgsfield", tags: ["후속 강력 후보", "코트 과학", "표면의 단면"]
  },
  {
    id: "FTN-CURATED-11", number: 11, series: "curated", title: "윔블던 잔디는 매일 같은 높이로 잘린다",
    hook: "선수의 발밑 1밀리미터 차이도 바운드와 미끄러짐을 바꿉니다.", core: "잔디 높이·토양 경도·수분을 일정하게 관리하는 과정",
    category: "court", categoryLabel: "코트 과학", tone: "정밀한 잔디",
    visual: "잔디 높이·토양 경도·수분을 일정하게 관리하는 과정를 빠른 멀티컷 3D 디오라마와 단면·궤적 인포그래픽으로 시각화",
    sourceHint: "Wimbledon 공식 잔디 관리 자료", score: 95, verification: "research_required",
    targetSeconds: 75, recommendedProvider: "higgsfield", tags: ["후속 강력 후보", "코트 과학", "정밀한 잔디"]
  },
  {
    id: "FTN-CURATED-12", number: 12, series: "curated", title: "하드코트 아래에는 몇 겹이 숨어 있을까",
    hook: "파란 코트는 페인트 한 겹이 아니라 바운드를 설계한 층들의 조합입니다.", core: "기층·아스팔트·쿠션·아크릴 마감의 다층 구조",
    category: "court", categoryLabel: "코트 과학", tone: "코트 단면",
    visual: "기층·아스팔트·쿠션·아크릴 마감의 다층 구조를 빠른 멀티컷 3D 디오라마와 단면·궤적 인포그래픽으로 시각화",
    sourceHint: "ITF Court Construction·Surface Research", score: 95, verification: "research_required",
    targetSeconds: 90, recommendedProvider: "higgsfield", tags: ["후속 강력 후보", "코트 과학", "코트 단면"]
  },
  {
    id: "FTN-CURATED-13", number: 13, series: "curated", title: "코트 속도는 선수가 아니라 기계가 먼저 측정한다",
    hook: "빠른 코트와 느린 코트는 감상이 아니라 숫자로 분류됩니다.", core: "ITF Court Pace Rating과 공·표면 마찰 측정",
    category: "court", categoryLabel: "코트 과학", tone: "측정의 기준",
    visual: "ITF Court Pace Rating과 공·표면 마찰 측정를 빠른 멀티컷 3D 디오라마와 단면·궤적 인포그래픽으로 시각화",
    sourceHint: "ITF Court Pace Classification", score: 94, verification: "research_required",
    targetSeconds: 60, recommendedProvider: "flow", tags: ["후속 강력 후보", "코트 과학", "측정의 기준"]
  },
  {
    id: "FTN-CURATED-14", number: 14, series: "curated", title: "고지대에서는 같은 공이 너무 멀리 날아간다",
    hook: "코트가 높아지면 선수보다 먼저 공의 종류를 바꿔야 합니다.", core: "낮은 공기밀도와 고지대용 Type 3 공",
    category: "ball", categoryLabel: "공과 재료", tone: "환경이 바꾼 공",
    visual: "낮은 공기밀도와 고지대용 Type 3 공를 빠른 멀티컷 3D 디오라마와 단면·궤적 인포그래픽으로 시각화",
    sourceHint: "ITF Rules of Tennis·Ball Approval 자료", score: 94, verification: "research_required",
    targetSeconds: 75, recommendedProvider: "flow", tags: ["후속 강력 후보", "공과 재료", "환경이 바꾼 공"]
  },
  {
    id: "FTN-CURATED-15", number: 15, series: "curated", title: "체인지오버 90초는 언제 시작될까",
    hook: "선수는 코트에 앉는 순간부터 쉬는 것이 아닙니다. 다음 포인트의 시계는 이미 움직입니다.", core: "엔드 체인지와 세트 브레이크 시간 규칙",
    category: "rules", categoryLabel: "규칙·판정", tone: "보이지 않는 시계",
    visual: "엔드 체인지와 세트 브레이크 시간 규칙를 빠른 멀티컷 3D 디오라마와 단면·궤적 인포그래픽으로 시각화",
    sourceHint: "ATP·Grand Slam 공식 규정", score: 94, verification: "research_required",
    targetSeconds: 90, recommendedProvider: "flow", tags: ["후속 강력 후보", "규칙·판정", "보이지 않는 시계"]
  },
  {
    id: "FTN-CURATED-16", number: 16, series: "curated", title: "네트에 맞은 서브를 기계는 어떻게 알아챌까",
    hook: "선심보다 먼저 서브의 렛을 알아채는 것은 네트 속 작은 센서입니다.", core: "진동·충격 기반 넷코드 센서와 렛 판정",
    category: "technology", categoryLabel: "기술·미래", tone: "센서의 판정",
    visual: "진동·충격 기반 넷코드 센서와 렛 판정를 빠른 멀티컷 3D 디오라마와 단면·궤적 인포그래픽으로 시각화",
    sourceHint: "ITF 전자 판정 평가·장비 자료", score: 93, verification: "research_required",
    targetSeconds: 60, recommendedProvider: "flow", tags: ["후속 강력 후보", "기술·미래", "센서의 판정"]
  },
  {
    id: "FTN-CURATED-17", number: 17, series: "curated", title: "킥서브는 왜 바운드 뒤 옆으로 도망갈까",
    hook: "서브는 앞으로 날아왔는데 바운드 뒤에는 리시버의 몸 밖으로 튑니다.", core: "회전축·마그누스 효과·지면 마찰이 만드는 킥",
    category: "serve", categoryLabel: "서브 과학", tone: "회전 궤적",
    visual: "회전축·마그누스 효과·지면 마찰이 만드는 킥를 빠른 멀티컷 3D 디오라마와 단면·궤적 인포그래픽으로 시각화",
    sourceHint: "ITF 스포츠과학·공기역학 연구", score: 93, verification: "research_required",
    targetSeconds: 75, recommendedProvider: "flow", tags: ["후속 강력 후보", "서브 과학", "회전 궤적"]
  },
  {
    id: "FTN-CURATED-18", number: 18, series: "curated", title: "슬라이스 공은 왜 공중에서 오래 떠 있을까",
    hook: "아래로 깎은 공은 느려지는 동시에 예상보다 길게 미끄러집니다.", core: "백스핀의 양력·항력과 낮은 바운드",
    category: "stroke", categoryLabel: "스트로크 역학", tone: "공기역학",
    visual: "백스핀의 양력·항력과 낮은 바운드를 빠른 멀티컷 3D 디오라마와 단면·궤적 인포그래픽으로 시각화",
    sourceHint: "ITF 스포츠과학 자료", score: 93, verification: "research_required",
    targetSeconds: 90, recommendedProvider: "flow", tags: ["후속 강력 후보", "스트로크 역학", "공기역학"]
  },
  {
    id: "FTN-CURATED-19", number: 19, series: "curated", title: "0점을 왜 ‘제로’가 아니라 러브라고 부를까",
    hook: "테니스에서 사랑은 점수가 없습니다. 하지만 그 어원은 아직 하나로 확정되지 않았습니다.", core: "Love 표기의 역사와 대표 어원 가설",
    category: "history", categoryLabel: "역사·인물", tone: "언어의 미스터리",
    visual: "Love 표기의 역사와 대표 어원 가설를 빠른 멀티컷 3D 디오라마와 단면·궤적 인포그래픽으로 시각화",
    sourceHint: "ITF 테니스 역사·옥스퍼드 스포츠 어원 자료", score: 92, verification: "research_required",
    targetSeconds: 60, recommendedProvider: "flow", tags: ["후속 강력 후보", "역사·인물", "언어의 미스터리"]
  },
  {
    id: "FTN-CURATED-20", number: 20, series: "curated", title: "두 선수의 동시 실격이 행동 규정을 만들었다",
    hook: "규칙 카드 몇 줄로 버티던 투어는 한 경기에서 두 선수를 모두 잃었습니다.", core: "1975년 애시–나스타세 사건과 ATP Code of Conduct 정비",
    category: "history", categoryLabel: "역사·인물", tone: "규칙을 바꾼 사건",
    visual: "1975년 애시–나스타세 사건과 ATP Code of Conduct 정비를 빠른 멀티컷 3D 디오라마와 단면·궤적 인포그래픽으로 시각화",
    sourceHint: "ATP 50 Game-Changing Moments", score: 92, verification: "research_required",
    targetSeconds: 75, recommendedProvider: "flow", tags: ["후속 강력 후보", "역사·인물", "규칙을 바꾼 사건"]
  },
  {
    id: "FTN-CURATED-21", number: 21, series: "curated", title: "ATP는 경기장이 아니라 관중석 아래에서 태어났다",
    hook: "세계 투어를 움직이는 선수 조직은 US오픈 경기장 밑 회의에서 시작됐습니다.", core: "1972년 약 70명의 선수와 ATP 창립",
    category: "history", categoryLabel: "역사·인물", tone: "조직의 탄생",
    visual: "1972년 약 70명의 선수와 ATP 창립를 빠른 멀티컷 3D 디오라마와 단면·궤적 인포그래픽으로 시각화",
    sourceHint: "ATP 50 Game-Changing Moments", score: 92, verification: "research_required",
    targetSeconds: 90, recommendedProvider: "flow", tags: ["후속 강력 후보", "역사·인물", "조직의 탄생"]
  },
  {
    id: "FTN-CURATED-22", number: 22, series: "curated", title: "타이타닉에서 사라진 사람이 ITF의 시작을 제안했다",
    hook: "국제 테니스 연맹의 아이디어를 낸 사람은 창립 회의를 보지 못했습니다.", core: "듀안 윌리엄스의 구상과 1913년 국제연맹 창립",
    category: "history", categoryLabel: "역사·인물", tone: "완성되지 못한 구상",
    visual: "듀안 윌리엄스의 구상과 1913년 국제연맹 창립를 빠른 멀티컷 3D 디오라마와 단면·궤적 인포그래픽으로 시각화",
    sourceHint: "ITF History of Tennis", score: 91, verification: "research_required",
    targetSeconds: 60, recommendedProvider: "flow", tags: ["후속 강력 후보", "역사·인물", "완성되지 못한 구상"]
  },
  {
    id: "FTN-CURATED-23", number: 23, series: "curated", title: "페더러와 샘프라스는 평생 단 한 번만 만났다",
    hook: "두 세대를 대표한 윔블던 황제의 공식 맞대결은 한 경기뿐이었습니다.", core: "2001년 윔블던 4회전과 세대교체의 상징",
    category: "history", categoryLabel: "역사·인물", tone: "단 한 번의 대결",
    visual: "2001년 윔블던 4회전과 세대교체의 상징를 빠른 멀티컷 3D 디오라마와 단면·궤적 인포그래픽으로 시각화",
    sourceHint: "Wimbledon·ATP 공식 경기 기록", score: 91, verification: "research_required",
    targetSeconds: 75, recommendedProvider: "flow", tags: ["후속 강력 후보", "역사·인물", "단 한 번의 대결"]
  },
  {
    id: "FTN-CURATED-24", number: 24, series: "curated", title: "양손 백핸드는 잔디에서 우승할 수 없다는 믿음",
    hook: "20세의 보리는 한 세트도 내주지 않고 그 상식을 무너뜨렸습니다.", core: "1976년 비외른 보리의 윔블던 우승과 스타일 변화",
    category: "history", categoryLabel: "역사·인물", tone: "상식을 깬 우승",
    visual: "1976년 비외른 보리의 윔블던 우승과 스타일 변화를 빠른 멀티컷 3D 디오라마와 단면·궤적 인포그래픽으로 시각화",
    sourceHint: "ATP·Wimbledon 공식 기록", score: 91, verification: "research_required",
    targetSeconds: 90, recommendedProvider: "flow", tags: ["후속 강력 후보", "역사·인물", "상식을 깬 우승"]
  },
  {
    id: "FTN-CURATED-25", number: 25, series: "curated", title: "매치포인트 두 개를 놓친 5시간 5분의 결승",
    hook: "한 포인트만 더 따면 끝날 경기가 로마의 밤까지 이어졌습니다.", core: "2006년 로마 나달–페더러 결승",
    category: "history", categoryLabel: "역사·인물", tone: "극적인 결승",
    visual: "2006년 로마 나달–페더러 결승를 빠른 멀티컷 3D 디오라마와 단면·궤적 인포그래픽으로 시각화",
    sourceHint: "ATP 공식 경기 기록", score: 90, verification: "research_required",
    targetSeconds: 60, recommendedProvider: "flow", tags: ["후속 강력 후보", "역사·인물", "극적인 결승"]
  },
  {
    id: "FTN-CURATED-26", number: 26, series: "curated", title: "윔블던 결승이 23분 만에 끝난 날",
    hook: "관중이 자리에 앉자마자 우승자가 결정된 결승이 있었습니다.", core: "1922년 수잔 랑글렌의 빠른 여자 단식 결승 기록",
    category: "history", categoryLabel: "역사·인물", tone: "너무 짧은 결승",
    visual: "1922년 수잔 랑글렌의 빠른 여자 단식 결승 기록를 빠른 멀티컷 3D 디오라마와 단면·궤적 인포그래픽으로 시각화",
    sourceHint: "Wimbledon 공식 기록", score: 90, verification: "research_required",
    targetSeconds: 75, recommendedProvider: "flow", tags: ["후속 강력 후보", "역사·인물", "너무 짧은 결승"]
  },
  {
    id: "FTN-CURATED-27", number: 27, series: "curated", title: "윔블던의 보라색과 초록색은 왜 생겼을까",
    hook: "지금의 상징색은 예뻐서가 아니라 기존 색이 군대와 너무 닮아서 바뀌었습니다.", core: "1909년 클럽 색상 변경과 Royal Marines 색상 문제",
    category: "venue", categoryLabel: "대회·경기장", tone: "색의 역사",
    visual: "1909년 클럽 색상 변경과 Royal Marines 색상 문제를 빠른 멀티컷 3D 디오라마와 단면·궤적 인포그래픽으로 시각화",
    sourceHint: "Wimbledon 공식 Q&A·클럽 기록", score: 90, verification: "research_required",
    targetSeconds: 90, recommendedProvider: "flow", tags: ["후속 강력 후보", "대회·경기장", "색의 역사"]
  },
  {
    id: "FTN-CURATED-28", number: 28, series: "curated", title: "테니스는 원래 라켓 없이 손으로 쳤다",
    hook: "라켓 스포츠의 시작에는 라켓도, 지금 같은 네트도 없었습니다.", core: "중세 Jeu de Paume에서 장갑·배트·라켓으로 이어진 변화",
    category: "history", categoryLabel: "역사·인물", tone: "스포츠의 기원",
    visual: "중세 Jeu de Paume에서 장갑·배트·라켓으로 이어진 변화를 빠른 멀티컷 3D 디오라마와 단면·궤적 인포그래픽으로 시각화",
    sourceHint: "ITF History of Tennis", score: 89, verification: "research_required",
    targetSeconds: 60, recommendedProvider: "higgsfield", tags: ["후속 강력 후보", "역사·인물", "스포츠의 기원"]
  },
  {
    id: "FTN-CURATED-29", number: 29, series: "curated", title: "최초의 테니스 세트는 상자 하나에 담겨 팔렸다",
    hook: "코트와 장비가 통째로 포장되자 테니스는 다른 대륙으로 퍼졌습니다.", core: "1873년 윙필드의 Sphairistike 박스와 보급",
    category: "history", categoryLabel: "역사·인물", tone: "상품이 된 스포츠",
    visual: "1873년 윙필드의 Sphairistike 박스와 보급를 빠른 멀티컷 3D 디오라마와 단면·궤적 인포그래픽으로 시각화",
    sourceHint: "ITF History of Tennis", score: 89, verification: "research_required",
    targetSeconds: 75, recommendedProvider: "higgsfield", tags: ["후속 강력 후보", "역사·인물", "상품이 된 스포츠"]
  },
  {
    id: "FTN-CURATED-30", number: 30, series: "curated", title: "옛 테니스공 안에는 머리카락과 양털이 들어갔다",
    hook: "지금의 고무 압력구 이전에는 공의 속을 천연 재료로 채웠습니다.", core: "털·양모·코르크와 수제 가죽 공에서 현대 공으로의 변화",
    category: "ball", categoryLabel: "공과 재료", tone: "공의 진화",
    visual: "털·양모·코르크와 수제 가죽 공에서 현대 공으로의 변화를 빠른 멀티컷 3D 디오라마와 단면·궤적 인포그래픽으로 시각화",
    sourceHint: "ITF History of Tennis Balls·History of Tennis", score: 89, verification: "research_required",
    targetSeconds: 90, recommendedProvider: "higgsfield", tags: ["후속 강력 후보", "공과 재료", "공의 진화"]
  }
];




function balancedCategoryQueue(items) {
  const remaining = [...items].sort((a, b) => b.score - a.score);
  const ratios = [0, 0.45, 0.12, 0.72, 0.28, 0.58, 0.36, 0.88];
  const output = [];
  let step = 0;
  while (remaining.length) {
    const index = Math.min(remaining.length - 1, Math.floor((remaining.length - 1) * ratios[step % ratios.length]));
    output.push(remaining.splice(index, 1)[0]);
    step += 1;
  }
  return output;
}

export function buildUnifiedEpisodeCatalog() {
  const original = buildEpisodeCatalog().filter((episode) => episode.id !== "FTN-IDEA-170");
  const categories = catalogCategories.map((category) => category.id);
  const queues = new Map(categories.map((category) => [
    category,
    balancedCategoryQueue(original.filter((episode) => episode.category === category))
  ]));
  const balancedLibrary = [];
  let cursor = 0;
  while ([...queues.values()].some((queue) => queue.length)) {
    const category = categories[cursor % categories.length];
    const queue = queues.get(category);
    if (queue.length) balancedLibrary.push(queue.shift());
    cursor += 1;
  }

  const anchor = pilotEpisodes.find((episode) => episode.id === "FTN-PILOT-01");
  const remainingPilots = pilotEpisodes.filter((episode) => episode.id !== anchor.id);
  const strongPicks = [];
  let pilotIndex = 0;
  let curatedIndex = 0;
  for (let index = 0; index < remainingPilots.length + curatedEpisodes.length; index += 1) {
    if (index % 4 === 0 && pilotIndex < remainingPilots.length) {
      strongPicks.push(remainingPilots[pilotIndex]);
      pilotIndex += 1;
    } else {
      strongPicks.push(curatedEpisodes[curatedIndex]);
      curatedIndex += 1;
    }
  }
  while (curatedIndex < curatedEpisodes.length) {
    strongPicks.push(curatedEpisodes[curatedIndex]);
    curatedIndex += 1;
  }

  const total = 1 + strongPicks.length + balancedLibrary.length;
  const unified = [];
  let strongIndex = 0;
  let libraryIndex = 0;
  for (let position = 1; position <= total; position += 1) {
    let episode;
    if (position === 1) episode = anchor;
    else if ((position - 1) % 7 === 0 && strongIndex < strongPicks.length) {
      episode = strongPicks[strongIndex];
      strongIndex += 1;
    } else {
      episode = balancedLibrary[libraryIndex];
      libraryIndex += 1;
    }
    unified.push({
      ...episode,
      sourceNumber: episode.number,
      number: position,
      curation: episode.series === "pilot" ? "pilot" : episode.series === "curated" ? "strong_pick" : "library"
    });
  }
  return unified;
}


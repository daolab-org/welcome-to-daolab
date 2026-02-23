# welcome-to-daolab

특정 Discord 초대코드로 입장한 사용자의 온보딩을 자동화하는 봇.

초대코드 입장 → `다오콘` 역할 부여 → 버튼 클릭 → 5문항 모달 작성 → 닉네임 변경 + `다오랩-프렌즈` 역할 부여 + 아카이빙.

## 사전 준비

### 1. Discord Bot 생성 및 토큰 발급

1. [Discord Developer Portal](https://discord.com/developers/applications)에 로그인
2. **New Application** 클릭 → 이름 입력 → 생성
3. 좌측 메뉴에서 **Bot** 클릭
4. **Reset Token** 클릭 → 토큰 복사 (이 토큰은 한 번만 표시됨)
5. **Privileged Gateway Intents** 섹션에서 아래 항목 활성화:
   - **Server Members Intent** (필수 - guildMemberAdd 이벤트 수신)
6. 좌측 메뉴에서 **OAuth2** → **URL Generator** 클릭
7. Scopes: `bot` 선택
8. Bot Permissions: `Manage Roles`, `Manage Nicknames`, `Send Messages`, `Read Message History` 선택
9. 생성된 URL로 봇을 서버에 초대

### 2. Discord 서버 설정

1. **역할 생성**: `다오콘`, `다오랩-프렌즈` 역할을 만든다
2. **역할 순서**: 봇 역할이 `다오콘`, `다오랩-프렌즈`보다 **위에** 있어야 한다 (서버 설정 → 역할에서 드래그)
3. **채널 준비**: 환영 채널, 아카이브 채널(`다오랩-프렌즈-소개`)을 만든다
4. **초대코드 생성**: 서버 설정 → 초대에서 추적할 초대 링크를 생성한다

### 3. ID 확인 방법

Discord에서 **사용자 설정 → 고급 → 개발자 모드**를 활성화한 뒤:

- **서버 ID**: 서버 이름 우클릭 → ID 복사
- **역할 ID**: 서버 설정 → 역할 → 해당 역할 우클릭 → ID 복사
- **채널 ID**: 채널 이름 우클릭 → ID 복사
- **초대코드**: 초대 링크의 `discord.gg/` 뒤 부분 (예: `discord.gg/abc123`이면 `abc123`)

## 설치

```bash
git clone https://github.com/daolab-org/welcome-to-daolab.git
cd welcome-to-daolab
npm install
```

## 환경변수 설정

`.env.example`을 복사하여 `.env`를 만들고 값을 채운다:

```bash
cp .env.example .env
```

```env
DISCORD_TOKEN=봇_토큰
GUILD_ID=서버_ID
TARGET_INVITE_CODE=추적할_초대코드
DAOCON_ROLE_ID=다오콘_역할_ID
DAOFRIENDS_ROLE_ID=다오랩프렌즈_역할_ID
ARCHIVE_CHANNEL_ID=아카이브_채널_ID
WELCOME_CHANNEL_ID=환영_채널_ID
```

## 실행

```bash
npm start
```

봇이 시작되면 환영 채널에 온보딩 버튼 메시지가 자동 생성된다 (이미 있으면 재사용).

## 동작 흐름

1. 사용자가 `TARGET_INVITE_CODE`로 서버에 입장
2. 봇이 자동으로 `다오콘` 역할 부여
3. 환영 채널의 **온보딩 시작하기** 버튼 클릭
4. 5문항 모달 표시 (실명, 닉네임, 자기소개, 경험, 기대사항)
5. 제출하면 아카이브 채널에 Embed로 저장
6. 닉네임으로 서버 표시 이름 변경
7. `다오콘` 제거 + `다오랩-프렌즈` 부여

## 개발

```bash
npm run lint          # ESLint 검사
npm run lint:fix      # ESLint 자동 수정
npm run format        # Prettier 포맷팅
npm run format:check  # Prettier 검사
```

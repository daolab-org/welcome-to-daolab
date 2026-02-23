# SPEC: 다오랩 프렌즈 온보딩 자동화 봇

Version: 0.1.0 | Status: Draft

**Executive Summary**: 특정 Discord 초대코드로 입장한 사용자에게 자동으로 `다오콘` 역할을 부여하고, 서버 내 환영 채널의 고정 버튼을 통해 4문항 모달을 표시하여 온보딩을 완료한 사용자에게 `다오랩-프렌즈` 역할을 부여하는 봇을 명세한다.

## 1. Problem Frame

**도메인:**

| Domain              | Type                | Description                                               |
| ------------------- | ------------------- | --------------------------------------------------------- |
| Discord User        | Biddable            | 초대코드로 입장하는 사용자. 모달 응답 여부/시점 예측 불가 |
| Discord API/Gateway | Connection          | 이벤트 전달, 역할 관리, 인터랙션 중계. WebSocket 기반     |
| Discord Guild       | Lexical             | 역할, 채널, 멤버, 초대코드 데이터 저장소                  |
| Onboarding Bot      | Machine (구현 대상) | 이벤트 감지 → 역할 관리 → 모달 표시 → 아카이빙            |

**Shared Phenomena:**

| Interface | Domain A      | Domain B      | Phenomena                                       |
| --------- | ------------- | ------------- | ----------------------------------------------- |
| IF-01     | Discord User  | Discord API   | 초대코드 클릭, 서버 입장, 버튼 클릭, 모달 제출  |
| IF-02     | Discord API   | Bot           | guildMemberAdd 이벤트, interactionCreate 이벤트 |
| IF-03     | Bot           | Discord Guild | roles.add/remove, channels.send, invites.fetch  |
| IF-04     | Discord Guild | Discord User  | 역할 표시, 채널 접근 권한, 메시지 표시          |

**Context Diagram:**

```
┌──────────────┐  IF-01  ┌──────────────┐  IF-02  ┌──────────────┐
│ Discord User │◄───────►│ Discord API  │◄───────►│ Onboarding   │
│ (Biddable)   │         │ (Connection) │         │ Bot (Machine)│
└──────────────┘         └──────┬───────┘         └──────┬───────┘
                                │                        │ IF-03
                         ┌──────▼───────┐                │
                         │ Discord Guild│◄───────────────┘
                         │ (Lexical)    │
                         └──────────────┘
```

## 2. Domain Assumptions (Breadcrumbs)

**A-01: 초대코드 추적 가능성**

- Statement: "Discord API의 invites.fetch()로 사용 횟수 비교를 통해 어떤 초대코드로 입장했는지 식별 가능"
- Justification: Discord.js v14 공식 가이드, 커뮤니티 검증 패턴
- Validation: **Validated**
- Impact if False: 초대코드 기반 역할 부여 불가 → 수동 부여 필요

**A-02: 모달은 인터랙션의 첫 번째 응답으로만 표시 가능**

- Statement: "Discord 모달은 인터랙션의 첫 번째 응답으로만 showModal() 가능. defer() 후 모달 표시 불가"
- Justification: Discord API 공식 문서, Discord.js Guide
- Validation: **Validated**
- Impact if False: 없음 (API 제약)
- 구현 영향: 버튼 클릭 핸들러에서 역할 확인 → showModal()을 defer 없이 바로 수행해야 함

**A-03: Ephemeral 메시지로 개인화 가능**

- Statement: "`flags: MessageFlags.Ephemeral` 옵션으로 해당 사용자에게만 보이는 메시지 전송 가능 (v14.14.1+에서 `ephemeral: true` deprecated)"
- Justification: Discord.js v14 공식 문서, GitHub Issue #10020
- Validation: **Validated**
- Impact if False: 모든 사용자에게 완료 메시지 노출

**A-04: 봇 역할 계층**

- Statement: "봇 역할이 다오콘/다오랩-프렌즈 역할보다 상위에 있어야 역할 부여/제거 가능"
- Justification: Discord 역할 계층 규칙
- Validation: **Validated** (운영자가 설정)
- Impact if False: DiscordAPIError: Missing Permissions

**A-05: 동시 입장 처리**

- Statement: "여러 사용자가 동시에 같은 초대코드로 입장할 때, invites.fetch() 비교 시 마지막 호출 기준으로 uses 차이를 감지"
- Justification: Discord.js 커뮤니티 패턴
- Validation: **Assumed** (대량 동시 입장 시 경합 조건 가능)
- Impact if False: 일부 사용자에게 다오콘 역할 미부여

## 3. Requirements

### 3.1 Business Requirements (Optative)

| ID   | Requirement                                                         | Priority |
| ---- | ------------------------------------------------------------------- | -------- |
| R-01 | 특정 초대코드로 입장한 사용자는 자동으로 온보딩 절차를 밟아야 한다  | Must     |
| R-02 | 사용자는 4문항(이름/닉네임, 자기소개, 경험, 기대사항)에 답해야 한다 | Must     |
| R-03 | 답변은 `다오랩-프렌즈-소개` 채널에 아카이빙되어야 한다              | Must     |
| R-04 | 온보딩 완료 시 `다오랩-프렌즈` 역할이 부여되어야 한다               | Must     |
| R-05 | 온보딩 과정이 다른 사용자에게 도배되지 않아야 한다                  | Should   |

### 3.2 Requirement Progression

**R-01 Progression:**

L0 (Business): "특정 초대코드로 입장한 사용자는 자동으로 온보딩 절차를 밟아야 한다"

Breadcrumb A-01 적용:
L1: "guildMemberAdd 이벤트 발생 시, invites.fetch() 비교로 TARGET_INVITE_CODE 사용 여부를 판별한다"

Breadcrumb A-02 적용:
L2: "대상 사용자에게 다오콘 역할을 부여하고, 환영 채널의 고정 버튼을 클릭하면 모달이 표시된다"

L3 (Machine Spec): "guildMemberAdd 시 초대코드 캐시와 비교하여 일치하면 member.roles.add(DAOCON_ROLE_ID) 호출. 환영 채널에 상시 버튼 메시지 존재. 버튼 interactionCreate 시 다오콘 역할 확인 후 interaction.showModal() 호출"

**R-05 Progression:**

L0 (Business): "온보딩 과정이 다른 사용자에게 도배되지 않아야 한다"

Breadcrumb A-02, A-03 적용:
L1: "입장 시마다 메시지를 보내지 않고, 고정 버튼 1개만 존재. 모달 응답은 ephemeral"

L2 (Machine Spec): "봇 시작 시 환영 채널에 버튼 메시지 1회 생성 (기존 존재 시 재사용). 모달 제출 응답은 interaction.deferReply({ flags: MessageFlags.Ephemeral })"

### 3.3 Technical Requirements (Derived)

| ID   | From | Technical Requirement                                             |
| ---- | ---- | ----------------------------------------------------------------- |
| T-01 | R-01 | 봇 시작 시 guild.invites.fetch()로 초대코드 캐시 생성             |
| T-02 | R-01 | guildMemberAdd에서 캐시 비교로 초대코드 판별                      |
| T-03 | R-01 | 대상 초대코드 사용자에게 DAOCON_ROLE_ID 부여                      |
| T-04 | R-02 | 버튼 클릭 시 4개 TextInput 포함 모달 표시. q2_intro minLength: 50 |
| T-05 | R-03 | 모달 제출 시 ARCHIVE_CHANNEL_ID에 Embed 전송                      |
| T-06 | R-04 | 아카이빙 성공 후 다오콘 제거 + 다오랩-프렌즈 부여                 |
| T-07 | R-05 | 환영 채널에 고정 버튼 메시지 1개 유지. 응답은 ephemeral           |

## 4. Specification

### 4.1 State Machine: 사용자 온보딩 상태

```
┌──────────┐  초대코드 입장   ┌──────────┐  모달 제출 완료  ┌──────────────┐
│  (없음)  │───────────────►│  다오콘   │───────────────►│ 다오랩-프렌즈 │
└──────────┘                └──────────┘                └──────────────┘
```

Transitions:

- (없음) → 다오콘: TARGET_INVITE_CODE로 입장 시 자동 부여
- 다오콘 → 다오랩-프렌즈: 모달 4문항 제출 + 아카이빙 성공 시 (다오콘 제거 + 다오랩-프렌즈 부여)

### 4.2 Invariants

| ID   | Category    | Invariant                                                                                  | Enforcement                                |
| ---- | ----------- | ------------------------------------------------------------------------------------------ | ------------------------------------------ |
| I-01 | State       | 한 사용자는 다오콘과 다오랩-프렌즈를 동시에 가질 수 없다                                   | 역할 교체 시 remove → add 순서 보장        |
| I-02 | Referential | 다오랩-프렌즈 역할 부여 시 반드시 아카이브 채널에 해당 사용자의 소개 Embed가 존재해야 한다 | 아카이빙 성공 후에만 역할 부여             |
| I-03 | Uniqueness  | 환영 채널에 봇의 버튼 메시지는 최대 1개만 존재한다                                         | 봇 시작 시 기존 메시지 검색 후 재사용/생성 |
| I-04 | Validation  | 자기소개 필드는 최소 50자 이상이어야 한다                                                  | TextInputBuilder.setMinLength(50)          |

### 4.3 Event Contracts

**guildMemberAdd Handler:**

- Pre: member.guild.id === GUILD_ID
- Action: invites.fetch() → 캐시 비교 → 대상이면 roles.add(DAOCON_ROLE_ID)
- Post: 대상 사용자에게 다오콘 역할 부여됨
- Error: 역할 부여 실패 시 console.error 로깅

**Button Interaction (start_onboarding):**

- Pre: 클릭한 사용자가 다오콘 역할 보유
- Action: interaction.showModal() with 4 TextInputs
- Post: 모달 표시됨
- Error: 다오콘 역할 없으면 ephemeral 거부 메시지

**Modal Submit (onboarding_modal):**

- Pre: 4개 필드 모두 입력, q2_intro >= 50자
- Action 순서:
  1. interaction.deferReply({ flags: MessageFlags.Ephemeral })
  2. archiveChannel.send(Embed)
  3. member.roles.remove(DAOCON_ROLE_ID)
  4. member.roles.add(DAOFRIENDS_ROLE_ID)
  5. interaction.editReply(성공 메시지)
- Post: 아카이브 완료 + 역할 교체 완료
- Error: 중간 실패 시 ephemeral 에러 메시지

## 5. Verification

| Scenario            | Scope     | Given                 | When                         | Then                                                   |
| ------------------- | --------- | --------------------- | ---------------------------- | ------------------------------------------------------ |
| 정상 온보딩         | 1 user    | 대상 초대코드로 입장  | 버튼 클릭 → 모달 작성 → 제출 | 아카이브 Embed 생성 + 다오콘 제거 + 다오랩-프렌즈 부여 |
| 비대상 초대코드     | 1 user    | 다른 초대코드로 입장  | 서버 입장                    | 다오콘 역할 부여되지 않음                              |
| 역할 없이 버튼 클릭 | 1 user    | 다오콘 역할 없음      | 버튼 클릭                    | ephemeral 거부 메시지                                  |
| I-01 검증           | 1 user    | 다오콘 역할 보유      | 모달 제출 완료               | 다오콘 없음 AND 다오랩-프렌즈 있음                     |
| I-03 검증           | 봇 재시작 | 기존 버튼 메시지 존재 | 봇 재시작                    | 새 버튼 메시지 생성 안 함                              |
| 최소 글자수         | 1 user    | 다오콘 역할 보유      | 자기소개 49자 입력           | 모달 제출 불가 (Discord 클라이언트 자체 검증)          |

## 6. Open Questions

- [ASSUMED] A-05: 대량 동시 입장 시 초대코드 캐시 경합 조건 → 실운영에서 모니터링 필요
- [TBD] 봇 다운타임 중 입장한 사용자 처리 방안 (수동 처리 또는 재시작 시 스캔)

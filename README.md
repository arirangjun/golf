# 스크린골프 예약 시스템 (PWA)

Next.js App Router 기반 스크린골프 타임슬롯 예약 시스템입니다.

## 기술 스택

- **Next.js 15** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Prisma ORM** (SQLite)
- **PWA** (manifest + Service Worker)

## 예약 규칙

| 규칙 | 설명 |
|------|------|
| 기본 예약 | 회원당 주간(월~일) 1회, 1시간(1슬롯) |
| 익일 추가 예약 | 21:00 이후 내일 날짜 슬롯 추가 1회 예약 가능 (주간 제한 무시) |
| 취소 제한 | 예약 3시간 전까지만 취소 가능 |
| 운영 시간 | 00:00 ~ 24:00 (1시간 단위, 24슬롯) |

## 동시성 방지

- **DB 레벨**: `Reservation` 모델에 `@@unique([date, startHour])` 복합 유니크 제약
- **API 레벨**: Serializable 트랜잭션 + 사전 슬롯 점유 확인 + Prisma P2002 에러 처리

## 시작하기

```bash
npm install
cp .env.example .env
npm run db:push
npm run db:seed
npm run dev
```

## 테스트 계정

| 역할 | 로그인 | 비밀번호 |
|------|--------|----------|
| 관리자 | admin@golf.com | admin1234 |
| 회원 | 101동 / 1001호 | 1 |

## GitHub 연동

코드를 GitHub에 푸시하면 **GitHub Actions CI**가 자동으로 실행됩니다 (lint + build).

### 1. GitHub에서 저장소 생성

1. [GitHub](https://github.com/new)에서 새 저장소 생성 (예: `golf`)
2. README 추가 없이 **빈 저장소**로 생성

### 2. 로컬 연결 및 푸시

**PowerShell (Windows):**

```powershell
cd D:\golf
.\scripts\push-to-github.ps1 -RepoUrl "https://github.com/사용자명/golf.git"
git commit -m "Initial commit: screen golf reservation PWA"
git push -u origin main
```

**수동 설정:**

```bash
git init
git branch -M main
git remote add origin https://github.com/사용자명/golf.git
git add .
git commit -m "Initial commit: screen golf reservation PWA"
git push -u origin main
```

### 3. 이후 작업 흐름

```bash
git add .
git commit -m "변경 내용 설명"
git push
```

`main` 브랜치에 푸시할 때마다 `.github/workflows/ci.yml`이 실행되어 빌드 검증이 진행됩니다.

> **참고:** `.env`와 `prisma/dev.db`는 `.gitignore`에 포함되어 GitHub에 올라가지 않습니다. 배포 시 `DATABASE_URL`, `JWT_SECRET` 환경 변수를 별도 설정하세요.

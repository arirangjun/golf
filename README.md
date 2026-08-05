# 스크린골프 예약 시스템 (PWA)

Next.js App Router 기반 스크린골프 타임슬롯 예약 시스템입니다.

## 기술 스택

- **Next.js 15** (App Router, 프론트엔드)
- **FastAPI** (Python 백엔드 API)
- **TypeScript**
- **Tailwind CSS**
- **SQLAlchemy + MySQL**
- **PWA** (manifest + Service Worker)

## 예약 규칙

| 규칙 | 설명 |
|------|------|
| 기본 예약 | 회원당 주간(월~일) 1회, 1시간(1슬롯) |
| 예약 오픈 | 매주 토요일 14:00부터 다음 주(월~일)만 예약 가능 |
| 익일 추가 예약 | 21:00 이후 내일 날짜 슬롯 추가 1회 예약 가능 (주간 제한 무시, 오픈 주간 내) |
| 취소 제한 | 예약 3시간 전까지만 취소 가능 |
| 운영 시간 | 00:00 ~ 24:00 (1시간 단위, 24슬롯) |

## 동시성 방지

- **DB 레벨**: `Reservation` 모델에 `@@unique([date, startHour])` 복합 유니크 제약
- **API 레벨**: Serializable 트랜잭션 + 사전 슬롯 점유 확인 + Prisma P2002 에러 처리

## 시작하기

MySQL이 필요합니다. [Railway](https://railway.app)에서 MySQL을 사용할 수 있습니다.

```bash
# 1. 프론트엔드
npm install
cp .env.example .env
# .env 에 MySQL DATABASE_URL, JWT_SECRET 설정
npm run db:setup   # 최초 1회: Prisma 마이그레이션 + 시드

# 2. 백엔드 (FastAPI)
cd backend
pip install -r requirements.txt
python seed.py     # Prisma 시드 대신 Python 시드 사용 가능

# 3. 실행 (터미널 2개)
npm run dev:api    # FastAPI → http://127.0.0.1:8000
npm run dev        # Next.js → http://localhost:3000 (API는 FastAPI로 프록시)
```

> Next.js는 `/api/*` 요청을 FastAPI(`API_URL`)로 프록시합니다.

## 테스트 계정

| 역할 | 로그인 | 비밀번호 |
|------|--------|----------|
| 관리자 | admin@golf.com | admin1234 |
| 회원 | 101동 / 1001호 | 1 |

## GitHub 연동

코드를 GitHub에 푸시하면 **GitHub Actions CI**가 자동으로 실행됩니다 (lint + build).

### 1. GitHub 저장소

이 프로젝트 저장소: **[github.com/arirangjun/golf](https://github.com/arirangjun/golf)**

새 프로젝트를 연결할 경우 [GitHub](https://github.com/new)에서 빈 저장소를 생성합니다.

### 2. 로컬 연결 및 푸시

**PowerShell (Windows):**

```powershell
cd D:\golf
.\scripts\push-to-github.ps1 -RepoUrl "https://github.com/arirangjun/golf.git"
git commit -m "Initial commit: screen golf reservation PWA"
git push -u origin main
```

**수동 설정:**

```bash
git init
git branch -M main
git remote add origin https://github.com/arirangjun/golf.git
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

> **참고:** `.env`는 GitHub에 올라가지 않습니다. 배포 시 `DATABASE_URL`, `JWT_SECRET` 환경 변수를 설정하세요.

## Vercel 배포

### 1. MySQL 준비 (Railway)

1. [Railway](https://railway.app)에서 MySQL 서비스 생성
2. Connection string 복사 (`mysql://...`)

### 2. Vercel 연결

1. [Vercel](https://vercel.com) → **Add New Project**
2. GitHub `arirangjun/golf` 저장소 Import
3. **Environment Variables** 설정:

| 변수 | 값 |
|------|-----|
| `DATABASE_URL` | Railway MySQL URL |
| `JWT_SECRET` | 랜덤 문자열 (32자 이상) |

4. **Deploy** 클릭

배포 시 `prisma migrate deploy`가 자동 실행되어 DB 스키마가 생성됩니다.

### 3. 최초 시드 (1회)

배포 후 로컬에서 Railway MySQL URL로 시드 실행:

```bash
DATABASE_URL="mysql://..." npm run db:seed
```

### 배포 URL

Vercel 대시보드에서 `https://golf-xxx.vercel.app` 형태의 URL을 확인할 수 있습니다.

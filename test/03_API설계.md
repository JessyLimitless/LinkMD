# API 설계

## 엔드포인트 목록

| Method | Path | 설명 |
|--------|------|------|
| GET | / | 프론트엔드 UI |
| POST | /api/upload | MD/ZIP 업로드 |
| POST | /api/convert | 변환 실행 |
| GET | /api/download/:id | 결과물 다운로드 |
| GET | /api/health | 서버 상태 |

## POST /api/upload 응답

```json
{
  "success": true,
  "sessionId": "a1b2c3d4-e5f6",
  "files": [
    {
      "filename": "01_프로젝트개요.md",
      "size": 2048,
      "headingCount": 5
    }
  ]
}
```

## 에러 코드

| 코드 | 설명 |
|------|------|
| 1001 | 파일 없음 |
| 1002 | 잘못된 파일 형식 |
| 3001 | Pandoc 변환 실패 |

## POST /api/convert 요청

```json
{
  "sessionId": "a1b2c3d4",
  "outputFormat": "docx",
  "template": "business-report"
}
```

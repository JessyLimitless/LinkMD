'use strict';

class LinkMDError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'LinkMDError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        timestamp: this.timestamp
      }
    };
  }
}

const ERROR_CODES = {
  // Upload (1xxx)
  UPLOAD_NO_FILES:      { code: 1001, http: 400, msg: '파일이 선택되지 않았습니다.' },
  UPLOAD_INVALID_TYPE:  { code: 1002, http: 400, msg: '.md 또는 .zip 파일만 업로드 가능합니다.' },
  UPLOAD_TOO_LARGE:     { code: 1003, http: 413, msg: '파일 크기가 제한을 초과했습니다. (최대 50MB)' },
  UPLOAD_TOO_MANY:      { code: 1004, http: 400, msg: '파일 수가 제한을 초과했습니다. (최대 100개)' },
  UPLOAD_ZIP_CORRUPT:   { code: 1005, http: 400, msg: 'ZIP 파일이 손상되었습니다.' },
  UPLOAD_ZIP_NO_MD:     { code: 1006, http: 400, msg: 'ZIP 내에 .md 파일이 없습니다.' },

  // Project (2xxx)
  PROJECT_NOT_FOUND:    { code: 2001, http: 404, msg: '프로젝트를 찾을 수 없습니다.' },
  PROJECT_NAME_EMPTY:   { code: 2002, http: 400, msg: '프로젝트 이름을 입력해주세요.' },
  PROJECT_NAME_DUP:     { code: 2003, http: 409, msg: '같은 이름의 프로젝트가 이미 있습니다.' },

  // Document (3xxx)
  DOC_NOT_FOUND:        { code: 3001, http: 404, msg: '문서를 찾을 수 없습니다.' },
  DOC_EMPTY_FILE:       { code: 3002, http: 400, msg: '빈 MD 파일이 포함되어 있습니다.' },
  DOC_ENCODING:         { code: 3003, http: 400, msg: 'UTF-8 인코딩 파일만 가능합니다.' },

  // Search (4xxx)
  SEARCH_EMPTY_QUERY:   { code: 4001, http: 400, msg: '검색어를 입력해주세요.' },
  SEARCH_QUERY_TOO_LONG:{ code: 4002, http: 400, msg: '검색어가 너무 깁니다. (최대 200자)' },

  // Share (5xxx)
  SHARE_NOT_FOUND:      { code: 5001, http: 404, msg: '공유 링크를 찾을 수 없습니다.' },
  SHARE_EXPIRED:        { code: 5002, http: 410, msg: '만료된 공유 링크입니다.' },

  // Export (6xxx)
  EXPORT_PANDOC_FAIL:   { code: 6001, http: 500, msg: 'Pandoc 변환에 실패했습니다.' },
  EXPORT_TIMEOUT:       { code: 6002, http: 504, msg: '변환 시간이 초과되었습니다. (30초)' },
  EXPORT_TEMPLATE_404:  { code: 6003, http: 404, msg: '선택한 템플릿을 찾을 수 없습니다.' },
  EXPORT_NO_DOCS:       { code: 6004, http: 400, msg: '내보낼 문서를 선택해주세요.' },

  // Folder (7xxx)
  FOLDER_NOT_FOUND:     { code: 7001, http: 404, msg: '폴더를 찾을 수 없습니다.' },
  FOLDER_NAME_EMPTY:    { code: 7002, http: 400, msg: '폴더 이름을 입력해주세요.' },
  FOLDER_NAME_DUP:      { code: 7003, http: 409, msg: '같은 이름의 폴더가 이미 있습니다.' },
  FOLDER_CIRCULAR:      { code: 7004, http: 400, msg: '순환 참조가 발생합니다.' },
  FOLDER_DEPTH_LIMIT:   { code: 7005, http: 400, msg: '폴더 깊이 제한을 초과했습니다. (최대 10단계)' },

  // Document extended (3xxx)
  DOC_FILENAME_INVALID: { code: 3005, http: 400, msg: '올바르지 않은 파일명입니다.' },
  DOC_FILENAME_DUP:     { code: 3006, http: 409, msg: '같은 이름의 파일이 이미 있습니다.' },
  DOC_SPLIT_NO_HEADINGS:{ code: 3010, http: 400, msg: '해당 레벨의 헤딩이 없습니다.' },
  DOC_SPLIT_TOO_FEW:    { code: 3011, http: 400, msg: '분할하려면 최소 2개의 헤딩이 필요합니다.' },

  // Server (9xxx)
  SERVER_PANDOC_404:    { code: 9001, http: 500, msg: 'Pandoc이 설치되어 있지 않습니다.' },
};

function createError(errorKey, extraDetails = {}) {
  const def = ERROR_CODES[errorKey];
  if (!def) {
    return new LinkMDError(9999, '알 수 없는 오류가 발생했습니다.', extraDetails);
  }
  const err = new LinkMDError(def.code, def.msg, extraDetails);
  err.httpStatus = def.http;
  return err;
}

module.exports = { LinkMDError, ERROR_CODES, createError };

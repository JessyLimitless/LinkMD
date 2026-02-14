'use strict';

const { LinkMDError } = require('../core/errors');

function errorHandler(err, req, res, _next) {
  console.error(`[${new Date().toISOString()}] Error:`, err.message);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  if (err instanceof LinkMDError) {
    return res.status(err.httpStatus || 500).json(err.toJSON());
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      error: { code: 1003, message: '파일 크기가 제한을 초과했습니다.', details: {} }
    });
  }

  // Generic errors
  res.status(500).json({
    success: false,
    error: {
      code: 9999,
      message: process.env.NODE_ENV === 'production'
        ? '서버 내부 오류가 발생했습니다.'
        : err.message,
      details: {}
    }
  });
}

module.exports = errorHandler;

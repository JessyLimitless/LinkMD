'use strict';

const path = require('path');
const { createError } = require('../core/errors');

const ALLOWED_MD_EXTENSIONS = ['.md'];
const ALLOWED_UPLOAD_EXTENSIONS = ['.md', '.zip'];
const ALLOWED_REVERSE_EXTENSIONS = ['.docx', '.pdf'];

function validateUpload(req, res, next) {
  if (!req.files || req.files.length === 0) {
    return next(createError('UPLOAD_NO_FILES'));
  }

  const maxCount = parseInt(process.env.MAX_FILE_COUNT) || 100;
  if (req.files.length > maxCount) {
    return next(createError('UPLOAD_TOO_MANY', { count: req.files.length, max: maxCount }));
  }

  let totalSize = 0;
  const maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024;
  const maxTotalSize = parseInt(process.env.MAX_TOTAL_SIZE) || 50 * 1024 * 1024;

  for (const file of req.files) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_UPLOAD_EXTENSIONS.includes(ext)) {
      return next(createError('UPLOAD_INVALID_TYPE', { file: file.originalname, ext }));
    }
    if (file.size > maxFileSize) {
      return next(createError('UPLOAD_TOO_LARGE', { file: file.originalname, size: file.size }));
    }
    totalSize += file.size;
  }

  if (totalSize > maxTotalSize) {
    return next(createError('UPLOAD_TOO_LARGE', { totalSize, max: maxTotalSize }));
  }

  next();
}

function validateReverse(req, res, next) {
  if (!req.files || req.files.length === 0) {
    return next(createError('UPLOAD_NO_FILES'));
  }

  const file = req.files[0];
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_REVERSE_EXTENSIONS.includes(ext)) {
    return next(createError('REVERSE_INVALID_TYPE', { file: file.originalname, ext }));
  }

  next();
}

module.exports = { validateUpload, validateReverse };

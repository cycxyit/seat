export function validateUserCode(req, res, next) {
  const userCode = req.body.user_code || req.query.user_code || req.headers['x-user-code'];

  if (!userCode || typeof userCode !== 'string' || userCode.trim().length === 0) {
    return res.status(400).json({
      error: 'User code is required',
      message: '请提供有效的用户代号'
    });
  }

  if (userCode.length > 50) {
    return res.status(400).json({
      error: 'User code is too long',
      message: '用户代号不能超过50个字符'
    });
  }

  req.userCode = userCode.trim();
  next();
}

export function validateAdminKey(req, res, next) {
  const adminKey = req.headers['x-admin-key'];
  const expectedKey = process.env.ADMIN_SECRET_KEY;

  if (!adminKey || adminKey !== expectedKey) {
    return res.status(403).json({
      error: 'Invalid admin key',
      message: '无效的管理员密钥'
    });
  }

  next();
}

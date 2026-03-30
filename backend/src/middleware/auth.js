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
  const adminKey = (req.headers['x-admin-key'] || '').trim();
  const expectedKey = (process.env.ADMIN_SECRET_KEY || '').trim();

  console.log('--- Admin Auth Debug ---');
  console.log('Received X-Admin-Key header:', adminKey ? 'Present (length: ' + adminKey.length + ')' : 'Missing');
  console.log('Expected Key in process.env:', expectedKey ? 'Set (length: ' + expectedKey.length + ')' : 'NOT SET');

  if (!adminKey || adminKey !== expectedKey) {
    console.warn(`🔒 Access Forbidden: Incorrect or missing admin key (provided: ${adminKey ? (adminKey.slice(0, 3) + '***') : 'none'})`);
    if (expectedKey && adminKey) {
      console.warn(`Mismatch details: provided_len=${adminKey.length}, expected_len=${expectedKey.length}`);
    }
    return res.status(403).json({
      error: 'Invalid admin key',
      message: '无效的管理员密钥',
      _debug: {
        headerPresent: !!adminKey,
        keyMatched: false
      }
    });
  }

  console.log('✅ Admin Auth Successful');
  next();
}

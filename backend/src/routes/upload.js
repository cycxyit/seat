import express from 'express';
import multer from 'multer';
import { Octokit } from '@octokit/rest';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/', upload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded', message: '请提供收据图片' });
    }

    const { GITHUB_TOKEN, GITHUB_REPO } = process.env;

    if (!GITHUB_TOKEN || !GITHUB_REPO) {
      console.warn('⚠️ GitHub API token or repo not configured. Falling back to base64 locally.');
      // 临时备用逻辑：没有配置 Github 图床时直接返回 base64
      const b64 = req.file.buffer.toString('base64');
      const mime = req.file.mimetype;
      const dataUrl = `data:${mime};base64,${b64}`;
      return res.json({ success: true, data: { url: dataUrl } });
    }

    const octokit = new Octokit({ auth: GITHUB_TOKEN });
    const [owner, repo] = GITHUB_REPO.split('/');

    const ext = path.extname(req.file.originalname) || '.png';
    const filename = `receipt_${uuidv4()}${ext}`;
    const base64Content = req.file.buffer.toString('base64');
    
    // 放入 receipts/ 年-月 文件夹
    const date = new Date();
    const folder = `receipts/${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const filePath = `${folder}/${filename}`;

    const response = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filePath,
      message: `Upload receipt: ${filename}`,
      content: base64Content,
      branch: 'main'
    });

    // 尝试构建用于前台展示的原始图片 URL
    // Raw url 通常为: https://raw.githubusercontent.com/owner/repo/main/path
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${filePath}`;

    res.json({
      success: true,
      message: '图片上传成功',
      data: {
        url: rawUrl
      }
    });

  } catch (err) {
    console.error('Upload Error:', err);
    res.status(500).json({
      error: 'Upload failed',
      message: err.message || '上传图片失败'
    });
  }
});

export default router;

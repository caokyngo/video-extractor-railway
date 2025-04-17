const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/get-video', async (req, res) => {
  const pageURL = req.query.url;
  if (!pageURL) {
    return res.status(400).json({ error: 'Thiếu URL video' });
  }

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setJavaScriptEnabled(true);
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/115 Safari/537.36'
    );

    const cookiePath = path.join(__dirname, 'cookies.json');
    if (fs.existsSync(cookiePath)) {
      const rawCookies = JSON.parse(fs.readFileSync(cookiePath, 'utf-8'));
      const cookies = rawCookies.map(cookie => {
        if (cookie.sameSite && typeof cookie.sameSite !== 'string') {
          delete cookie.sameSite;
        }
        return cookie;
      });
      await page.setCookie(...cookies);
    }

    const mp4Urls = [];

    page.on('response', async (response) => {
      try {
        const url = response.url();
        const contentType = response.headers()['content-type'] || '';
        if (url.includes('.mp4') && url.includes('ahcdn') && contentType.includes('video')) {
          if (!mp4Urls.includes(url)) {
            console.log('🎯 Bắt được video:', url);
            mp4Urls.push(url);
          }
        }
      } catch (err) {
        console.warn('⚠️ Lỗi khi phân tích response:', err.message);
      }
    });

    console.log("➡️ Đang truy cập:", pageURL);
    await page.goto(pageURL, { waitUntil: 'networkidle2', timeout: 60000 });

    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video) {
        video.muted = true;
        video.play().catch(() => {});
      }
    });

    await new Promise(resolve => setTimeout(resolve, 12000));
    await browser.close();

    const highQuality = mp4Urls.find(url => url.includes('hq_'));
    const fallback = mp4Urls.find(url => !url.includes('hq_'));

    if (highQuality) {
      res.json({ videoUrl: highQuality });
    } else if (fallback) {
      res.json({ videoUrl: fallback });
    } else {
      res.status(404).json({ error: 'Không tìm thấy video .mp4 từ ahcdn!' });
    }

  } catch (err) {
    console.error('❌ Lỗi server:', err);
    res.status(500).json({ error: 'Lỗi server', detail: err.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
});

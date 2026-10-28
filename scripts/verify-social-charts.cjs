const {
    chromium
  } = require('playwright'),
  assert = require('node:assert/strict');
(async () => {
  const {
      createService
    } = await import('../server/service.mjs'),
    {
      createHttp
    } = await import('../server/http.mjs');
  const s = await createService(':memory:'),
    users = await Promise.all(['alice', 'bobby', 'carol'].map(async login => await s.createUser({
      login,
      password: 'test-only-pass',
      nickname: login
    }))),
    admin = await s.createUser({
      login: 'teacher',
      password: 'test-only-pass',
      nickname: '관리자',
      role: 'admin'
    });
  await s.release(admin, {
    classId: 'unassigned',
    subject: 'git',
    units: [1, 2]
  });
  const origins = [];
  const server = await createHttp(s, {
    origins
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  origins.push(base);
  const cookies = new Map(await Promise.all([...users, admin].map(async u => [u.id, 'spokemon_session=' + (await s.newSession(u)).token])));
  async function api(u, p, body, method = body ? 'POST' : 'GET') {
    const res = await fetch(base + '/api' + p, {
      method,
      headers: {
        Cookie: await cookies.get(u.id),
        'Content-Type': 'application/json',
        'X-Spokemon-Request': '1'
      },
      ...(body ? {
        body: JSON.stringify(body)
      } : {})
    });
    return {
      status: res.status,
      data: await res.json()
    };
  }
  let browser;
  try {
    const [a, b, c] = users;
    assert.equal((await api(a, '/friends/search?login=bobby')).data.student.id, b.id);
    assert.equal((await api(a, '/friends/search?login=bob')).data.student, null);
    assert.equal((await api(a, '/friends/search?login=teacher')).data.student, null);
    assert.equal((await api(admin, '/friends')).status, 403);
    let msg = {
      recipient: b.id,
      title: '공부하자',
      content: '같이 퀴즈 풀자',
      requestKey: 'test-request-001'
    };
    assert.equal((await api(a, '/friend-messages', msg)).status, 403);
    await api(a, '/friends', {
      studentId: b.id
    });
    assert.equal((await api(a, '/friend-messages', msg)).status, 403);
    await api(b, '/friends', {
      studentId: a.id
    });
    const sent = await Promise.all(await Promise.all(Array.from({
      length: 8
    }, async () => await api(a, '/friend-messages', msg))));
    assert.equal(new Set(sent.map(x => x.data.id)).size, 1);
    const id = sent[0].data.id;
    assert.equal((await api(c, '/friend-messages/' + id)).status, 404);
    assert.equal((await api(c, '/friend-messages/' + id + '/read', {})).status, 404);
    assert.equal((await api(c, '/friends')).data.items.length, 0);
    assert.equal((await api(b, '/messages/summary')).data.unread, 1);
    await api(b, '/friend-messages/' + id + '/read', {});
    assert.equal((await api(b, '/messages/summary')).data.unread, 0);
    assert.equal((await api(a, '/friend-messages/' + id)).data.read_at > 0, true);
    await api(b, '/friend-messages', {
      recipient: a.id,
      title: 'Re: 공부하자',
      content: '좋아!',
      requestKey: 'test-request-002'
    });
    assert.equal((await api(a, '/messages/summary')).data.unread, 1);
    assert.equal((await api(a, '/friend-messages', {
      ...msg,
      title: ' '
    })).status, 400);
    browser = await chromium.launch({
      headless: true,
      executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
    });
    const context = await browser.newContext();
    await context.addCookies([{
      name: 'spokemon_session',
      value: (await cookies.get(a.id)).split('=')[1],
      url: base
    }]);
    const page = await context.newPage(),
      errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '/#/quiz');
    await page.locator('.hub-subject').first().waitFor();
    for (const [w, h] of [[1440, 900], [1366, 768], [390, 844], [360, 740]]) {
      await page.setViewportSize({
        width: w,
        height: h
      });
      await page.waitForTimeout(80);
      for (const card of await page.locator('.hub-subject').all()) {
        assert.ok(await card.evaluate(n => {
          const b = n.getBoundingClientRect();
          return [...n.children].filter(c => c.getClientRects().length).every(c => {
            const r = c.getBoundingClientRect();
            return r.top >= b.top && r.bottom <= b.bottom + 1;
          });
        }), 'card content overlap ' + w);
      }
      await page.screenshot({
        path: 'C:/yw/login/overview-stage/fixed-hub-' + w + '.png'
      });
    }
    await page.goto(base + '/#/account');
    await page.locator('.profile-page').waitFor();
    for (const [w, h] of [[1366, 768], [390, 844], [360, 740]]) {
      await page.setViewportSize({
        width: w,
        height: h
      });
      await page.waitForTimeout(80);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'profile horizontal overflow');
      await page.screenshot({
        path: 'C:/yw/login/overview-stage/profile-debug-' + w + '.png',
        fullPage: true
      });
      for (const selector of ['#nickname', '.profile-characters']) {
        const box = await page.locator(selector).boundingBox();
        assert.ok(box.y + box.height <= h + 1, 'profile clipped ' + w + ' ' + selector);
      }
      await page.screenshot({
        path: 'C:/yw/login/overview-stage/profile-' + w + '.png'
      });
    }
    await page.goto(base + '/#/pet/mailbox');
    await page.getByRole('button', {
      name: '친구 · 쪽지함',
      exact: true
    }).click();
    await page.getByRole('button', {
      name: '친구 찾기',
      exact: true
    }).click();
    await page.locator('.friend-sidebar').getByRole('button', {
      name: '쪽지 쓰기',
      exact: true
    }).click();
    await page.locator('.friend-compose input').fill('브라우저 전송');
    await page.locator('.friend-compose textarea').fill('실제 전송 확인');
    await page.getByRole('button', {
      name: '쪽지 보내기',
      exact: true
    }).click();
    await page.getByRole('status').filter({
      hasText: '쪽지를 보냈어요'
    }).waitFor();
    for (const [width, height] of [[1440, 900], [1366, 768], [390, 844], [360, 740]]) {
      await page.setViewportSize({
        width,
        height
      });
      await page.waitForTimeout(80);
      assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1), 'mail page overflow ' + width);
      const box = await page.getByRole('button', {
        name: '쪽지 보내기',
        exact: true
      }).boundingBox();
      assert.ok(box.y + box.height <= height, 'mail send clipped');
      await page.screenshot({
        path: 'C:/yw/login/overview-stage/mail-fit-' + width + '.png'
      });
    }
    assert.equal((await api(b, '/friends')).data.items.some(m => m.title === '브라우저 전송'), true);
    await page.goto(base + '/#/student');
    await page.locator('.learning-chart canvas').first().waitFor();
    await page.getByRole('button', {
      name: '차트 닫기 ✕',
      exact: true
    }).click();
    assert.equal(await page.locator('.learning-chart').count(), 0);
    await page.getByRole('button', {
      name: '차트 다시 열기',
      exact: true
    }).click();
    await page.locator('.learning-chart canvas').first().waitFor();
    await page.screenshot({
      path: 'C:/yw/login/overview-stage/student-charts.png',
      fullPage: true
    });
    await context.clearCookies();
    await context.addCookies([{
      name: 'spokemon_session',
      value: (await cookies.get(admin.id)).split('=')[1],
      url: base
    }]);
    await page.goto(base + '/#/admin');
    await page.reload();
    await page.getByRole('heading', {
      name: '학생 대시보드 차트',
      exact: true
    }).waitFor();
    await page.locator('.learning-chart canvas').first().waitFor();
    assert.equal((await api(a, '/admin/students/' + c.id, {
      confirmLogin: c.login
    }, 'DELETE')).status, 403);
    assert.equal((await api(admin, '/admin/students/' + admin.id, {
      confirmLogin: admin.login
    }, 'DELETE')).status, 403);
    assert.equal((await api(admin, '/admin/students/' + c.id, {
      confirmLogin: 'wrong'
    }, 'DELETE')).status, 400);
    await page.setViewportSize({
      width: 1366,
      height: 768
    });
    const row = page.locator('.admin-table tbody tr').filter({
      hasText: c.login
    });
    await row.getByRole('button', {
      name: '계정 삭제',
      exact: true
    }).click();
    const modal = page.getByRole('dialog', {
      name: '학생 계정 삭제 확인'
    });
    await modal.locator('#delete-login').fill(c.login);
    await modal.getByRole('button', {
      name: '학생 계정 삭제',
      exact: true
    }).click();
    await modal.waitFor({
      state: 'hidden'
    });
    assert.equal((await api(c, '/me')).status, 401);
    assert.equal((await api(a, '/friends/search?login=' + c.login)).data.student, null);
    await assert.rejects(async () => await s.login(c.login, 'test-only-pass'));
    assert.equal((await s.db.prepare('SELECT count(*) n FROM users WHERE id=?').get(c.id)).n, 1);
    assert.deepEqual(errors, []);
    console.log('PASS: exact ID lookup, student-only friend approval, mutual private messages, 8 duplicate sends once, third-party access denied, read/reply badges; 4 viewport course content bounds, 3 viewport full profile fit, friend UI send, ECharts student/admin render-close-reopen without errors.');
  } finally {
    await browser?.close();
    await new Promise(async r => await server.close(r));
    await s.close();
  }
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});

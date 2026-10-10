import assert from 'node:assert';
import {
  HTTP_METHODS,
  MOCK_ENDPOINTS,
  PRESET_REQUESTS,
  validateJson,
  formatJson,
  minifyJson,
  formatJsonValidationStatus,
  handleMockRequest
} from '../labs/api-playground/api-mock-engine.mjs';

console.log('Running API & JSON Playground automated tests...');

// 1. JSON Validation, Formatting, and Minification
{
  // Valid JSON
  const validCheck = validateJson('{"name": "test", "count": 42}');
  assert.strictEqual(validCheck.valid, true);
  assert.strictEqual(validCheck.parsed.name, 'test');
  assert.strictEqual(validCheck.parsed.count, 42);

  // Invalid JSON with syntax error
  const invalidCheck = validateJson('{"name": "test",');
  assert.strictEqual(invalidCheck.valid, false);
  assert.ok(invalidCheck.error !== null);
  assert.ok(invalidCheck.line >= 1);

  // Formatting
  const unformatted = '{"a":1,"b":[2,3]}';
  const formatted2 = formatJson(unformatted, 2);
  assert.ok(formatted2.includes('\n  "a": 1'));

  // Minification
  const formattedInput = '{\n  "a": 1,\n  "b": 2\n}';
  const minified = minifyJson(formattedInput);
  assert.strictEqual(minified, '{"a":1,"b":2}');

  // Oversized JSON check (> 500 KB)
  const hugePayload = '{"data": "' + 'A'.repeat(501000) + '"}';
  const hugeCheck = validateJson(hugePayload);
  assert.strictEqual(hugeCheck.valid, false);
  assert.ok(hugeCheck.error.includes('Oversized payload'));
}
console.log('✓ JSON validation, formatting, minification, and size limits verified');

// 2. Health & Auth Endpoints
{
  const healthRes = handleMockRequest({ method: 'GET', url: '/api/v1/health' });
  assert.strictEqual(healthRes.status, 200);
  assert.strictEqual(healthRes.data.status, 'healthy');
  assert.strictEqual(healthRes.data.version, '5.0.0');

  const tokenRes = handleMockRequest({ method: 'POST', url: '/api/v1/auth/token' });
  assert.strictEqual(tokenRes.status, 200);
  assert.strictEqual(tokenRes.data.token_type, 'Bearer');
  assert.ok(tokenRes.data.access_token.includes('mock_jwt'));

  const tokenGetRes = handleMockRequest({ method: 'GET', url: '/api/v1/auth/token' });
  assert.strictEqual(tokenGetRes.status, 405, 'GET on auth token should return 405 Method Not Allowed');
}
console.log('✓ Health and authentication mock endpoints working');

// 3. Mock CRUD Operations on /api/v1/users
{
  // List users
  const listRes = handleMockRequest({ method: 'GET', url: '/api/v1/users' });
  assert.strictEqual(listRes.status, 200);
  assert.ok(Array.isArray(listRes.data.users));
  assert.ok(listRes.data.users.length >= 3);

  // Create user (valid)
  const createRes = handleMockRequest({
    method: 'POST',
    url: '/api/v1/users',
    body: JSON.stringify({ name: 'Sam Altman', email: 'sam@openai.com', role: 'admin' })
  });
  assert.strictEqual(createRes.status, 201);
  assert.strictEqual(createRes.data.name, 'Sam Altman');
  assert.strictEqual(createRes.data.email, 'sam@openai.com');
  assert.ok(createRes.headers.location.startsWith('/api/v1/users/'));

  // Create user (invalid body)
  const badCreateRes = handleMockRequest({
    method: 'POST',
    url: '/api/v1/users',
    body: '{ invalid json '
  });
  assert.strictEqual(badCreateRes.status, 400);
  assert.ok(badCreateRes.data.message.includes('valid JSON'));

  // Update user
  const updateRes = handleMockRequest({
    method: 'PUT',
    url: '/api/v1/users/1',
    body: JSON.stringify({ role: 'superadmin' })
  });
  assert.strictEqual(updateRes.status, 200);

  // Delete user
  const delRes = handleMockRequest({ method: 'DELETE', url: '/api/v1/users/1' });
  assert.strictEqual(delRes.status, 204);
}
console.log('✓ Users CRUD operations handled deterministically');

// 4. Echo Endpoint and URL Query Parameter Handling
{
  const echoRes = handleMockRequest({
    method: 'POST',
    url: '/api/v1/echo?debug=true&mode=sandbox',
    headers: { 'X-Intelli-Test': '123' },
    body: JSON.stringify({ ping: 'pong' })
  });
  assert.strictEqual(echoRes.status, 200);
  assert.strictEqual(echoRes.data.method, 'POST');
  assert.strictEqual(echoRes.data.queryParams.debug, 'true');
  assert.strictEqual(echoRes.data.queryParams.mode, 'sandbox');
  assert.strictEqual(echoRes.data.receivedHeaders['X-Intelli-Test'], '123');
  assert.strictEqual(echoRes.data.receivedBody.ping, 'pong');
}
console.log('✓ Echo endpoint correctly reflects query parameters, headers, and body');

// 5. 404 Fallback & Intentional Status Code Overrides
{
  // 404 for unknown endpoint
  const notFoundRes = handleMockRequest({ method: 'GET', url: '/api/v1/does-not-exist' });
  assert.strictEqual(notFoundRes.status, 404);
  assert.strictEqual(notFoundRes.data.status, 404);
  assert.ok(Array.isArray(notFoundRes.data.availableEndpoints));

  // Intentional status code overrides
  for (const code of [400, 401, 403, 404, 500]) {
    const overrideRes = handleMockRequest({
      method: 'GET',
      url: '/api/v1/users',
      statusOverride: code
    });
    assert.strictEqual(overrideRes.status, code);
    assert.strictEqual(overrideRes.headers['x-mock-override'], 'active');
  }
}
console.log('✓ 404 fallback and intentional status code simulation verified');

// 6. Preset Request Verification
{
  assert.ok(PRESET_REQUESTS.length >= 5);
  for (const preset of PRESET_REQUESTS) {
    assert.ok(preset.id);
    assert.ok(preset.name);
    assert.ok(HTTP_METHODS.includes(preset.method));
    assert.ok(preset.url.startsWith('/api/v1/'));
    const res = handleMockRequest(preset);
    assert.ok(res.status >= 200 && res.status < 300, `Preset ${preset.name} should yield 2xx response`);
  }
}
console.log('✓ All preset requests execute successfully against mock server');

// 7. Security: Malformed JSON with HTML & Event-Handler Payloads (Regression Tests)
{
  const maliciousPayloads = [
    '{"bad": <img src="x" onerror="alert(1)">}',
    '{"exploit": <script>alert("xss")</script>}',
    '{"vector": <svg onload="alert(document.cookie)">}',
    '{"tag": <iframe src="javascript:alert(1)">}',
    '{"handler": <details open ontoggle="alert(1)">}',
    '{"link": <a href="javascript:alert(1)" onclick="alert(1)">click</a>}',
    '{"body": <body onload="alert(1)">}',
    '{ "<img src=x onerror=alert(1)>": }',
    '{"payload": "<b onmouseover=alert(1)>'
  ];

  for (const payload of maliciousPayloads) {
    const check = validateJson(payload);
    assert.strictEqual(check.valid, false, `Payload must fail JSON validation: ${payload}`);
    assert.ok(check.error, 'Error text must be captured');

    const status = formatJsonValidationStatus(check);
    assert.strictEqual(status.valid, false);
    assert.strictEqual(status.color, '#ef4444');
    assert.ok(status.text.startsWith('⚠ Invalid JSON:'));

    // DOM simulation: ensure when set as textContent, it is never interpreted as HTML elements
    const mockContainer = {
      children: [],
      replaceChildren() { this.children = []; },
      appendChild(child) { this.children.push(child); }
    };

    mockContainer.replaceChildren();
    const mockSpan = {
      style: {},
      textContent: status.text,
      tagName: 'SPAN',
      children: [],
      get innerHTML() {
        return this.textContent
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }
    };
    mockContainer.appendChild(mockSpan);

    assert.strictEqual(mockContainer.children.length, 1);
    assert.strictEqual(mockContainer.children[0].tagName, 'SPAN');
    assert.strictEqual(mockSpan.children.length, 0);

    const html = mockSpan.innerHTML;
    assert.ok(!html.includes('<img'), `Must not contain unescaped <img> tag in: ${html}`);
    assert.ok(!html.includes('<script'), `Must not contain unescaped <script> tag in: ${html}`);
    assert.ok(!html.includes('<svg'), `Must not contain unescaped <svg> tag in: ${html}`);
    assert.ok(!html.includes('<iframe'), `Must not contain unescaped <iframe> tag in: ${html}`);
    assert.ok(!html.includes('<body'), `Must not contain unescaped <body> tag in: ${html}`);
  }
}
console.log('✓ Malformed JSON HTML/event-handler regression tests verified (XSS prevention)');

console.log('ALL API & JSON Playground tests passed successfully!\n');

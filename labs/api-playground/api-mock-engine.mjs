/**
 * IntelliTools V5 — API & JSON Playground Core Mock Engine
 * Headless, client-side deterministic HTTP request handler and JSON processor.
 * Zero external network transmission. Fully testable in Node.
 */

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

export const MOCK_ENDPOINTS = [
  '/api/v1/users',
  '/api/v1/posts',
  '/api/v1/products',
  '/api/v1/auth/token',
  '/api/v1/health',
  '/api/v1/echo'
];

/**
 * Validates and inspects a JSON string with detailed error localization
 */
export function validateJson(jsonStr) {
  if (typeof jsonStr !== 'string') {
    return { valid: false, error: 'Input must be a string', line: 1, column: 1, parsed: null };
  }
  if (!jsonStr.trim()) {
    return { valid: true, error: null, line: 1, column: 1, parsed: null, empty: true };
  }
  if (jsonStr.length > 500000) {
    return { valid: false, error: 'Oversized payload: exceeds 500 KB limit', line: 1, column: 1, parsed: null };
  }

  try {
    const parsed = JSON.parse(jsonStr);
    return { valid: true, error: null, line: 1, column: 1, parsed };
  } catch (err) {
    // Extract line/column information if present in error message
    let line = 1;
    let column = 1;
    const match = err.message.match(/at position (\d+)/i) || err.message.match(/line (\d+) column (\d+)/i);
    if (match) {
      if (match[2]) {
        line = parseInt(match[1], 10);
        column = parseInt(match[2], 10);
      } else {
        const pos = parseInt(match[1], 10);
        const upToPos = jsonStr.slice(0, pos);
        const lines = upToPos.split('\n');
        line = lines.length;
        column = lines[lines.length - 1].length + 1;
      }
    }
    return {
      valid: false,
      error: err.message,
      line,
      column,
      parsed: null
    };
  }
}

/**
 * Formats JSON with customizable indentation
 */
export function formatJson(jsonStr, indent = 2) {
  const check = validateJson(jsonStr);
  if (!check.valid) {
    throw new Error(check.error || 'Invalid JSON');
  }
  if (check.parsed === null) return '';
  return JSON.stringify(check.parsed, null, indent);
}

/**
 * Minifies JSON to a single compact line
 */
export function minifyJson(jsonStr) {
  const check = validateJson(jsonStr);
  if (!check.valid) {
    throw new Error(check.error || 'Invalid JSON');
  }
  if (check.parsed === null) return '';
  return JSON.stringify(check.parsed);
}

/**
 * Formats a validation status record into safe text and display styling.
 * Never returns HTML markup or unsanitized user content.
 */
export function formatJsonValidationStatus(check) {
  if (!check) return { text: '', color: 'var(--muted)', valid: false };
  if (check.empty) {
    return { text: 'Empty payload (valid)', color: 'var(--muted)', valid: true };
  }
  if (check.valid) {
    return { text: '✓ Valid JSON', color: '#10b981', valid: true };
  }
  return {
    text: `⚠ Invalid JSON: ${check.error} (Line ${check.line}, Col ${check.column})`,
    color: '#ef4444',
    valid: false
  };
}

/**
 * In-memory Mock Database
 */
const INITIAL_DATABASE = {
  users: [
    { id: 1, name: 'Alice Walker', email: 'alice@example.com', role: 'admin', active: true },
    { id: 2, name: 'Bob Chen', email: 'bob@example.com', role: 'engineer', active: true },
    { id: 3, name: 'Carla Diaz', email: 'carla@example.com', role: 'designer', active: false }
  ],
  posts: [
    { id: 101, title: 'Understanding Client-Side APIs', author: 'Alice Walker', tags: ['web', 'architecture'], views: 1420 },
    { id: 102, title: 'Safe Automation Workflows', author: 'Bob Chen', tags: ['security', 'tools'], views: 890 }
  ],
  products: [
    { id: 'sku-01', name: 'Developer Keyboard', price: 129.99, inStock: true, stock: 45 },
    { id: 'sku-02', name: 'Ultra-Wide Monitor', price: 499.00, inStock: true, stock: 12 },
    { id: 'sku-03', name: 'Ergonomic Desk Mat', price: 29.50, inStock: false, stock: 0 }
  ]
};

/**
 * Processes a mock HTTP request and returns deterministic response object
 */
export function handleMockRequest(request) {
  const method = String(request.method || 'GET').toUpperCase();
  const rawPath = String(request.url || '/api/v1/health').trim();
  const urlObj = parseMockUrl(rawPath);
  const path = urlObj.pathname;
  const headers = request.headers || {};
  const statusOverride = request.statusOverride ? parseInt(request.statusOverride, 10) : null;

  // Handle intentional status override simulation
  if (statusOverride && statusOverride !== 200) {
    return generateOverrideResponse(statusOverride, method, path);
  }

  // 1. Health check endpoint
  if (path === '/api/v1/health') {
    return {
      status: 200,
      statusText: 'OK',
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'x-mock-server': 'IntelliTools/5.0-local',
        'cache-control': 'no-cache'
      },
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '5.0.0',
        environment: 'browser-mock',
        uptimeSeconds: 84210
      }
    };
  }

  // 2. Auth / Token endpoint
  if (path === '/api/v1/auth/token') {
    if (method !== 'POST') {
      return {
        status: 405,
        statusText: 'Method Not Allowed',
        headers: { 'allow': 'POST', 'content-type': 'application/json' },
        data: { error: 'Method Not Allowed', message: 'Use POST to request an authorization token.' }
      };
    }
    return {
      status: 200,
      statusText: 'OK',
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'x-mock-server': 'IntelliTools/5.0-local'
      },
      data: {
        access_token: 'mock_jwt_header.payload_signed_locally.sig789xyz',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'read:profile write:data',
        issued_at: new Date().toISOString()
      }
    };
  }

  // 3. Echo endpoint
  if (path === '/api/v1/echo') {
    let parsedBody = null;
    if (request.body) {
      try { parsedBody = JSON.parse(request.body); } catch (_) { parsedBody = request.body; }
    }
    return {
      status: 200,
      statusText: 'OK',
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'x-mock-server': 'IntelliTools/5.0-local'
      },
      data: {
        method,
        path,
        queryParams: urlObj.searchParams,
        receivedHeaders: headers,
        receivedBody: parsedBody,
        echoTimestamp: new Date().toISOString()
      }
    };
  }

  // 4. Users CRUD endpoint
  if (path === '/api/v1/users' || path.startsWith('/api/v1/users/')) {
    if (method === 'GET') {
      return {
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'x-total-count': String(INITIAL_DATABASE.users.length)
        },
        data: {
          users: INITIAL_DATABASE.users,
          total: INITIAL_DATABASE.users.length
        }
      };
    } else if (method === 'POST') {
      const check = validateJson(request.body || '{}');
      if (!check.valid || !check.parsed) {
        return {
          status: 400,
          statusText: 'Bad Request',
          headers: { 'content-type': 'application/json' },
          data: { error: 'Bad Request', message: 'Request body must be valid JSON: ' + check.error }
        };
      }
      const newUser = {
        id: Math.floor(Math.random() * 900) + 10,
        name: check.parsed.name || 'Anonymous User',
        email: check.parsed.email || 'user@example.com',
        role: check.parsed.role || 'viewer',
        active: true,
        createdAt: new Date().toISOString()
      };
      return {
        status: 201,
        statusText: 'Created',
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'location': `/api/v1/users/${newUser.id}`
        },
        data: newUser
      };
    } else if (method === 'PUT' || method === 'PATCH') {
      return {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: { message: 'User updated successfully', updatedFields: request.body ? JSON.parse(request.body) : {} }
      };
    } else if (method === 'DELETE') {
      return {
        status: 204,
        statusText: 'No Content',
        headers: { 'x-deleted': 'true' },
        data: null
      };
    }
  }

  // 5. Posts endpoint
  if (path === '/api/v1/posts') {
    if (method === 'GET') {
      return {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        data: { posts: INITIAL_DATABASE.posts, count: INITIAL_DATABASE.posts.length }
      };
    }
    if (method === 'POST') {
      return {
        status: 201,
        statusText: 'Created',
        headers: { 'content-type': 'application/json' },
        data: { id: 103, ...JSON.parse(request.body || '{}'), publishedAt: new Date().toISOString() }
      };
    }
  }

  // 6. Products endpoint
  if (path === '/api/v1/products') {
    return {
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      data: { products: INITIAL_DATABASE.products }
    };
  }

  // 404 Fallback
  return {
    status: 404,
    statusText: 'Not Found',
    headers: { 'content-type': 'application/json' },
    data: {
      type: 'https://intellitools.online/errors/not-found',
      title: 'Resource Not Found',
      status: 404,
      detail: `The endpoint "${path}" does not exist on this mock server.`,
      availableEndpoints: MOCK_ENDPOINTS
    }
  };
}

function parseMockUrl(raw) {
  let clean = raw.trim();
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    try {
      const u = new URL(clean);
      const params = {};
      u.searchParams.forEach((v, k) => { params[k] = v; });
      return { pathname: u.pathname, searchParams: params };
    } catch (_) {}
  }
  const parts = clean.split('?');
  const pathname = parts[0].startsWith('/') ? parts[0] : '/' + parts[0];
  const searchParams = {};
  if (parts[1]) {
    const pairs = parts[1].split('&');
    for (const pair of pairs) {
      const [k, v] = pair.split('=');
      if (k) searchParams[decodeURIComponent(k)] = decodeURIComponent(v || '');
    }
  }
  return { pathname, searchParams };
}

function generateOverrideResponse(status, method, path) {
  const titles = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable'
  };
  const title = titles[status] || 'HTTP Error';
  return {
    status,
    statusText: title,
    headers: {
      'content-type': 'application/problem+json; charset=utf-8',
      'x-mock-override': 'active'
    },
    data: {
      type: `https://intellitools.online/errors/${status}`,
      title,
      status,
      detail: `Simulated ${status} ${title} response for ${method} ${path}`,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Built-in preset requests for the playground
 */
export const PRESET_REQUESTS = [
  {
    id: 'req_get_users',
    name: 'List Users (GET)',
    method: 'GET',
    url: '/api/v1/users',
    headers: { 'Accept': 'application/json' },
    body: ''
  },
  {
    id: 'req_post_user',
    name: 'Create User (POST)',
    method: 'POST',
    url: '/api/v1/users',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      name: 'Diana Prince',
      email: 'diana@themyscira.gov',
      role: 'security_lead'
    }, null, 2)
  },
  {
    id: 'req_auth_token',
    name: 'Issue JWT Token (POST)',
    method: 'POST',
    url: '/api/v1/auth/token',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: 'client_intelli_v5',
      grant_type: 'client_credentials'
    }, null, 2)
  },
  {
    id: 'req_health',
    name: 'Service Health (GET)',
    method: 'GET',
    url: '/api/v1/health',
    headers: {},
    body: ''
  },
  {
    id: 'req_echo',
    name: 'Inspect Echo Payload (POST)',
    method: 'POST',
    url: '/api/v1/echo?trace=true&client=web',
    headers: { 'Content-Type': 'application/json', 'X-Custom-Header': 'IntelliToolsV5' },
    body: JSON.stringify({
      message: 'Hello from client-side mock playground',
      dataPoints: [10, 20, 30]
    }, null, 2)
  }
];

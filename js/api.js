/* ==========================================================================
   Mission Board — API layer
   Wraps the ToDo List API documented at https://todo-list.dcism.org
   ========================================================================== */

const API_BASE = 'https://todo-list.dcism.org';
const SESSION_KEY = 'missionBoardUser';

/**
 * Low-level request helper. Throws an Error with a human-readable
 * message on failure so callers can just try/catch.
 */
async function request(path, { method = 'GET', query = null, body = null, endpoint = null } = {}) {
  let url = API_BASE + path;

  if (query) {
    const params = new URLSearchParams(query);
    url += '?' + params.toString();
  }

  const options = { method };

  if (body) {
    // The server's PHP reads the raw request body directly (json_decode on
    // php://input), not $_POST — so it needs real JSON text. But setting
    // "Content-Type: application/json" makes the browser preflight the
    // request, and this server's CORS config rejects that preflight.
    // Fix: send the JSON as a plain string. Fetch then defaults the
    // Content-Type to "text/plain;charset=UTF-8", which is CORS-safelisted
    // (skips preflight entirely) — while PHP still reads the same raw JSON
    // bytes from php://input regardless of what the header says.
    options.body = JSON.stringify(body);
  }

  // The practice server this points at (todo-list.dcism.org) is shared and
  // occasionally flaky, so a single transient network failure gets one
  // automatic retry before we surface an error to the user.
  let response;
  try {
    response = await fetch(url, options);
  } catch (firstErr) {
    try {
      await new Promise((r) => setTimeout(r, 500));
      response = await fetch(url, options);
    } catch (secondErr) {
      throw new Error('Could not reach the server. Check your connection and try again.');
    }
  }

  let data = null;
  let rawText = '';
  try {
    rawText = await response.text();
    data = JSON.parse(rawText);
  } catch (parseErr) {
    // Surface what the server actually sent (trimmed) so the real cause
    // — an HTML error page, a PHP warning, an empty body, etc. — is visible
    // instead of a generic message.
    const preview = rawText.trim().slice(0, 200) || '(empty response)';
    throw new Error(`Server sent back non-JSON data: ${preview}`);
  }

  if (!response.ok || (data && data.status && data.status >= 400)) {
    const statusCode = (data && data.status) || 400;
    const message = endpoint
      ? docMessage(endpoint, statusCode, (data && data.message) || 'Something went wrong.')
      : (data && data.message) || 'Something went wrong.';
    throw new Error(message);
  }

  if (endpoint && data) {
    const statusCode = (data && data.status) || 200;
    data.message = docMessage(endpoint, statusCode, data.message);
  }

  return data;
}

/**
 * Message text exactly as written in ToDoAPIDocumentation.pdf, keyed by
 * endpoint. We use the server's status code (200 vs 400) to pick which one
 * applies, rather than trusting whatever text the live server actually
 * returns — the live server doesn't always match the documented wording.
 */
const DOC_MESSAGES = {
  signUp: {
    200: 'Account created successfully.',
    400: 'Email already exists.',
  },
  signIn: {
    200: 'Success.',
    400: 'Account does not exists.',
  },
  addItem: {
    200: 'Item added successfully',
  },
  editItem: {
    200: 'Item updated',
  },
  deleteItem: {
    200: 'Item deleted',
  },
  // statusItem's success message depends on which status was set, not just
  // the HTTP/API status code, so it's handled separately below.
};

function docMessage(endpoint, statusCode, fallback) {
  const table = DOC_MESSAGES[endpoint];
  if (table && table[statusCode]) return table[statusCode];
  return fallback;
}

const Api = {
  /** POST /signup_action.php */
  signUp({ firstName, lastName, email, password, confirmPassword }) {
    return request('/signup_action.php', {
      method: 'POST',
      endpoint: 'signUp',
      body: {
        first_name: firstName,
        last_name: lastName,
        email,
        password,
        confirm_password: confirmPassword,
      },
    });
  },

  /** GET /signin_action.php?email=&password= */
  signIn({ email, password }) {
    return request('/signin_action.php', {
      method: 'GET',
      endpoint: 'signIn',
      query: { email, password },
    });
  },

  /** GET /getItems_action.php?status=&user_id= */
  getItems({ status, userId }) {
    return request('/getItems_action.php', {
      method: 'GET',
      query: { status, user_id: userId },
    });
  },

  /** POST /addItem_action.php */
  addItem({ itemName, itemDescription, userId }) {
    return request('/addItem_action.php', {
      method: 'POST',
      endpoint: 'addItem',
      body: {
        item_name: itemName,
        item_description: itemDescription,
        user_id: userId,
      },
    });
  },

  /**
   * The API doc lists this as PUT, but the server's CORS config actually
   * blocks PUT outright (Access-Control-Allow-Methods rejects it before the
   * request is even sent). POST is allowed, and this PHP endpoint reads the
   * raw JSON body regardless of method, so POST is used here as a working
   * substitute for the documented PUT.
   */
  editItem({ itemId, itemName, itemDescription }) {
    return request('/editItem_action.php', {
      method: 'POST',
      endpoint: 'editItem',
      body: {
        item_id: itemId,
        item_name: itemName,
        item_description: itemDescription,
      },
    });
  },

  /** Same PUT → POST substitution as editItem, and for the same reason. */
  async setItemStatus({ itemId, status }) {
    const res = await request('/statusItem_action.php', {
      method: 'POST',
      body: { item_id: itemId, status },
    });
    // Doc's success wording depends on which status was set, not just the
    // response code: "To do item activated." vs "To do item done."
    if (res && res.status === 200) {
      res.message = status === 'active' ? 'To do item activated.' : 'To do item done.';
    }
    return res;
  },

  /** DELETE /deleteItem_action.php?item_id= */
  deleteItem({ itemId }) {
    return request('/deleteItem_action.php', {
      method: 'DELETE',
      endpoint: 'deleteItem',
      query: { item_id: itemId },
    });
  },
};

/* --------------------------------------------------------------------------
   Session helpers (kept separate from the API calls themselves)
   -------------------------------------------------------------------------- */

const Session = {
  save(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  },
  get() {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  },
  clear() {
    localStorage.removeItem(SESSION_KEY);
  },
};
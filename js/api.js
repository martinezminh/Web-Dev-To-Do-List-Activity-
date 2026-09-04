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
async function request(path, { method = 'GET', query = null, body = null } = {}) {
  let url = API_BASE + path;

  if (query) {
    const params = new URLSearchParams(query);
    url += '?' + params.toString();
  }

  const options = { method, headers: {} };

  if (body) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(url, options);
  } catch (networkErr) {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }

  let data = null;
  try {
    data = await response.json();
  } catch (parseErr) {
    throw new Error('The server sent back something unexpected.');
  }

  if (!response.ok || (data && data.status && data.status >= 400)) {
    throw new Error((data && data.message) || 'Something went wrong.');
  }

  return data;
}

const Api = {
  /** POST /signup_action.php */
  signUp({ firstName, lastName, email, password, confirmPassword }) {
    return request('/signup_action.php', {
      method: 'POST',
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
      body: {
        item_name: itemName,
        item_description: itemDescription,
        user_id: userId,
      },
    });
  },

  /** PUT /editItem_action.php */
  editItem({ itemId, itemName, itemDescription }) {
    return request('/editItem_action.php', {
      method: 'PUT',
      body: {
        item_id: itemId,
        item_name: itemName,
        item_description: itemDescription,
      },
    });
  },

  /** PUT /statusItem_action.php */
  setItemStatus({ itemId, status }) {
    return request('/statusItem_action.php', {
      method: 'PUT',
      body: { item_id: itemId, status },
    });
  },

  /** DELETE /deleteItem_action.php?item_id= */
  deleteItem({ itemId }) {
    return request('/deleteItem_action.php', {
      method: 'DELETE',
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
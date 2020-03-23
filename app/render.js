// ============= Helpers ==============
const replaceText = (selector, text) => {
  const element = document.getElementById(selector);
  if (element) element.innerText = text;
};

const displayRawResponse = (responseObject) => {
  replaceText('raw-response', JSON.stringify(responseObject, undefined, 2));
};

// ===== Response handlers from IPC Messages to render context ======
// Login response.
window.api.receive('response_login', (data) => {
  console.log('Received Login response from main process');
  if (data.status) {
    // Add the new connection to the list of options.
    const opt = document.createElement('option');
    opt.value = data.response.organizationId;
    opt.innerHTML = document.getElementById('login-username').value;
    opt.id = `sforg-${opt.value}`;
    document.getElementById('active-org').appendChild(opt);

    // Shuffle what's shown.
    document.getElementById('org-status').style.display = 'block';
    document.getElementById('api-request-form').style.display = 'block';
    replaceText('active-org-id', data.response.organizationId);
    replaceText('login-response-message', data.message);
    displayRawResponse(data.response);
  }
});

// Logout Response.
window.api.receive('response_logout', (data) => {
  console.log('Received Logout response from main process');
  displayRawResponse(data);
});

// Generic Response.
window.api.receive('response_generic', (data) => {
  console.log('Received Generic response from main process');
  displayRawResponse(data);
});

// ========= Messages to the main process ===============
// Login
document.getElementById('login-trigger').addEventListener('click', () => {
  window.api.send('sf_login', {
    username: document.getElementById('login-username').value,
    password: document.getElementById('login-password').value,
    token: document.getElementById('login-token').value,
    url: document.getElementById('login-url').value,
  });
});

// Logout
document.getElementById('logout-trigger').addEventListener('click', () => {
  window.api.send('sf_logout', { org: document.getElementById('active-org').value });
  document.getElementById('org-status').style.display = 'none';
  // @TODO: Remove org from list of active orgs.
  // @TODO: Update/hide status area if no orgs remain.
});


// ================== Inital page setup =====================

// Hide the information for handling responses.
document.getElementById('org-status').style.display = 'none';
document.getElementById('api-request-form').style.display = 'none';

// Setup to show/hide all the various controls needed for the APIs.
// Initially this is deeply insufficient, when enough controls exist this code
// style will be really really unmaintainable.
// @TODO: Do this better!
const apiSelectors = {
  'rest-api-soql': 'query',
  'rest-api-sosl': undefined,
  'rest-api-crud': undefined,
  'rest-api-describe': undefined,
  'rest-api-apex': undefined,
  'analytics-api': undefined,
  'bulk-api': undefined,
  'chatter-api': undefined,
  'metadata-api': undefined,
  'streaming-api': undefined,
  'tooling-api': undefined,
};

let element;
Object.keys(apiSelectors).forEach((selector) => {
  element = document.getElementById(selector);
  if (element) {
    element.style.display = 'none';
    element.getElementsByClassName('sf-api-trigger-button')[0].addEventListener('click', () => {
      const dataElements = element.getElementsByClassName('api-data-element');
      const data = { org: document.getElementById('active-org').value };
      for (let i = 0; i < dataElements.length; i += 1) {
        data[dataElements[i].name] = dataElements[i].value;
      }
      window.api.send(`sf_${apiSelectors[selector]}`, data);
    });
  }
});

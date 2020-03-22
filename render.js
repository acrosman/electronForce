const replaceText = (selector, text) => {
  const element = document.getElementById(selector);
  if (element) element.innerText = text;
};

// Response handlers from IPC Messages to render context.
window.api.receive('sfShowOrgId', (data) => {
  console.log(`Received ${data} from main process`);
  if (data.status) {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('org-status').style.display = 'block';
    replaceText('active-org-id', data.organizationId);
    replaceText('login-response-message', data.message);
  }
});

// Messages to the main process.

// Login
document.getElementById('login-trigger').addEventListener('click', (event) => {
  window.api.send('sfLogin', {
    username: document.getElementById('login-username').value,
    password: document.getElementById('login-password').value,
    token: document.getElementById('login-token').value,
    url: document.getElementById('login-url').value,
  });
});

// Logout
document.getElementById('logout-trigger').addEventListener('click', () => {
  window.api.send('sfLogout', {});
  document.getElementById('login-form').style.display = 'block';
  document.getElementById('org-status').style.display = 'none';
});

// Inital page setup.
document.getElementById('org-status').style.display = 'none';

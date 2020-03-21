// Response handlers from IPC Messages to render context.
window.api.receive('sfShowOrgId', (data) => {
  console.log(`Received ${data} from main process`);
  if (data.status) {
    document.getElementById('login-form').style.display = 'none';
    const orgDetails = document.getElementById('org-status');
    orgDetails.style.display = 'block';
    orgDetails.getElementById('active-org-id').replaceText(data.userInfo.organizationId);
    orgDetails.getElementById('login-response-message').replaceText(data.message);
  }
});

// Messages to the main process.
document.getElementById('login-trigger').addEventListener('click', (event) => {
  window.api.send('sfLogin', {
    username: document.getElementById('login-username').value,
    password: document.getElementById('login-password').value,
    token: document.getElementById('login-token').value,
    url: document.getElementById('login-url').value,
  });
});

// Inital page setup.
document.getElementById('org-status').style.display = 'none';

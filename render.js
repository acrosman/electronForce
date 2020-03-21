// Response handlers from IPC Messages to render context.
window.api.receive('sfOrgId', (data) => {
  console.log(`Received ${data} from main process`);
});

// Messages to the main process.
document.getElementById('login-trigger').addEventListener('click', (event) => {
  window.api.send('sfLogin', {
    username: document.getElementById('login-username').value,
    password: document.getElementById('login-password').value,
    url: document.getElementById('login-url').value,
  });
});

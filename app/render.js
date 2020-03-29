/* global $ */
// Initial interface setup using jQuery (since it's around from bootstrap anyway).
$(document).ready(() => {
  // Hide the places for handling responses until we have some.
  $('#org-status').hide();
  $('#api-request-form').hide();
  $('#results-table-wrapper').hide();

  // Setup to show/hide all the various controls needed for the APIs.
  // Initially this is deeply insufficient, when enough controls exist this code
  // style will be really really unmaintainable.
  // @TODO: Do this better!
  const apiSelectors = {
    'rest-api-soql': 'query',
    'rest-api-sosl': 'search',
    'rest-api-crud': undefined,
    'rest-api-describe': 'describe',
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
    element = $(`#${selector}`);
    if (element) {
      element.hide();
      const trigger = $('.sf-api-trigger-button', element);
      trigger.wrapperElement = element;
      // This click handler provides the trigger to send messages to the main process.
      trigger.click((event) => {
        const dataElements = $('.api-data-element', event.currentTarget.wrapperElement);
        const data = { org: $('#active-org').val() };
        dataElements.each((index, item) => {
          data[$(item).attr('id').replace(/-/g, '_')] = $(item).val();
        });
        // Send prepared data to the main process.
        window.api.send(`sf_${apiSelectors[selector]}`, data);
      });
    }
  });

  $('#select-api').change(() => {
    // Show the controls for the selected API.
    const newValue = $('#select-api').val();
    $(`#${newValue}`).show();

    // Hide all other controls.
    let hideSelector;
    $('#select-api').find('option').each((index, item) => {
      if (item.value !== newValue) {
        hideSelector = item.value;
        $(`#${hideSelector}`).hide();
      }
    });
  });
});

// ============= Helpers ==============
const replaceText = (selector, text) => {
  const element = document.getElementById(selector);
  if (element) element.innerText = text;
};

const displayRawResponse = (responseObject) => {
  replaceText('raw-response', JSON.stringify(responseObject, undefined, 2));
};

const refreshResponseTable = (sObjectData) => {
  document.getElementById('results-table-wrapper').style.display = 'block';
  document.getElementById('results-summary-count').innerText = `Fetched ${sObjectData.records.length} of ${sObjectData.totalSize} records`;

  // Get the table.
  const resultsTable = document.querySelector('#results-table');

  // Clear existing table.
  while (resultsTable.firstChild) {
    resultsTable.removeChild(resultsTable.firstChild);
  }

  // Extract the header.
  const keys = Object.keys(sObjectData.records[0]).filter((value) => value !== 'attributes');

  // Create the header row for the table.
  const tHead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.setAttribute('class', 'table-primary');
  let newHeader;
  let textNode;
  // Add the type column
  newHeader = document.createElement('th');
  newHeader.setAttribute('scope', 'col');
  textNode = document.createTextNode('Type');
  newHeader.appendChild(textNode);
  headRow.appendChild(newHeader);
  // Add the other columns from the result set.
  for (let i = 0; i < keys.length; i += 1) {
    newHeader = document.createElement('th');
    newHeader.setAttribute('scope', 'col');
    textNode = document.createTextNode(keys[i]);
    newHeader.appendChild(textNode);
    headRow.appendChild(newHeader);
  }
  tHead.appendChild(headRow);
  resultsTable.appendChild(tHead);

  // Add the data.
  let dataRow;
  let newData;
  const tBody = document.createElement('tbody');
  for (let i = 0; i < sObjectData.records.length; i += 1) {
    dataRow = document.createElement('tr');
    // Put the object type as a row level header.
    newData = document.createElement('th');
    newData.setAttribute('scope', 'row');
    textNode = document.createTextNode(sObjectData.records[i].attributes.type);
    newData.appendChild(textNode);
    dataRow.appendChild(newData);
    for (let j = 0; j < keys.length; j += 1) {
      newData = document.createElement('td');
      textNode = document.createTextNode(sObjectData.records[i][keys[j]]);
      newData.appendChild(textNode);
      dataRow.appendChild(newData);
    }
    tBody.appendChild(dataRow);
  }
  resultsTable.appendChild(tBody);
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
  // TODO: Remove connection information.
});

// Generic Response.
window.api.receive('response_generic', (data) => {
  console.log('Received Generic response from main process');
  displayRawResponse(data);
});

// Query Response. Print the query results in table.
window.api.receive('response_query', (data) => {
  console.log('Received Query response from main process');
  if (data.status) {
    displayRawResponse(data);
    refreshResponseTable(data.response);
  } else {
    displayRawResponse(data.message);
  }
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

// Describe
window.api.receive('response_describe', (data) => {
  console.log('Received Describe response from main process');
  displayRawResponse(data);
});

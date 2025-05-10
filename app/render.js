/* global $ */
// Initial interface setup using jQuery (since it's around from bootstrap anyway).
$.when($.ready).then(() => {
  // Hide the places for handling responses until we have some.
  $('#org-status').hide();
  $('#api-request-form').hide();
  $('#results-table-wrapper').hide();
  $('#results-message-wrapper').hide();
  $('#results-object-viewer-wrapper').hide();

  // Setup to show/hide all the various controls needed for the APIs.
  // Initially this is deeply insufficient, when enough controls exist this code
  // style will be really really unmaintainable.
  // @TODO: Do this better!
  const apiSelectors = {
    'rest-api-soql': 'query',
    'rest-api-sosl': 'search',
    'rest-api-describe': 'describe',
    'org-explorer': 'orgExplore',
    'org-describe-global': 'describeGlobal',
    'org-limits': 'orgLimits',
    'org-profiles': 'orgProfiles',
    'org-permsets': 'orgPermSets',
    'org-permset-detail': 'orgPermSetDetail',
    'org-object-sharing': 'owds',
  };

  let element;
  Object.keys(apiSelectors).forEach((selector) => {
    element = $(`#${selector}`);
    if (element) {
      element.hide();
      const trigger = $('.sf-api-trigger-button', element);
      trigger.wrapperElement = element;

      // This click handler provides the trigger to send messages to the main process.
      trigger.on('click', (event) => {
        // All form elements that need to be sent to the API must have class api-data-element.
        const dataElements = $(
          '.api-data-element',
          event.currentTarget.wrapperElement,
        );
        // Send the currently selected org.
        const data = { org: $('#active-org').val() };

        // Add all the form items with the needed class, swap - for _ in ids.
        dataElements.each((index, item) => {
          if ($(item).attr('type') === 'checkbox') {
            data[$(item).attr('id').replace(/-/g, '_')] = $(item).is(':checked');
          } else {
            data[$(item).attr('id').replace(/-/g, '_')] = $(item).val();
          }
        });

        // Send prepared data to the main process.
        window.api.send(`sf_${apiSelectors[selector]}`, data);
      });
    }
  });

  $('#select-api').on('change', () => {
    // Show the controls for the selected API.
    const newValue = $('#select-api').val();
    $(`#${newValue}`).show();

    // Hide all other controls.
    let hideSelector;
    $('#select-api')
      .find('option')
      .each((index, item) => {
        if (item.value !== newValue) {
          hideSelector = item.value;
          $(`#${hideSelector}`).hide();
        }
      });
  });

  // Setup event listener for when the console modal opens,
  // pull in the most recent 50 messages.
  $('#consoleModal').on('show.bs.modal', (event) => {
    // Clear existing messages.
    const messageTable = document.querySelector('#consoleMessageTable');
    while (messageTable.rows.length > 1) {
      messageTable.removeChild(messageTable.lastChild);
    }
    document.getElementById('log-console-load-more').dataset.count = 0;

    // Load first 50
    window.api.send('get_log_messages', { offset: 0, count: 50 });
  });

  // Setup load more action handler for log messages. Unlike the listeners above,
  // that all call Salesforce, this is just trying to pull more log messages.
  $('#log-console-load-more').on('click', (event) => {
    event.preventDefault();
    window.api.send('get_log_messages', { offset: event.target.dataset.count, count: 50 });
  });
});

// ============= Helpers ==============
// Simple find and replace of text based on selector.
const replaceText = (selector, text) => {
  const element = document.getElementById(selector);
  if (element) element.innerText = text;
};

// Convert a simple object with name/value pairs, and sub-objects into an Unordered list
const object2ul = (data) => {
  const ul = document.createElement('ul');
  const keys = Object.keys(data);
  let li;
  let i;

  for (i = 0; i < keys.length; i += 1) {
    li = document.createElement('li');
    // if it's sub-object recurse.
    if (typeof data[keys[i]] === 'object' && data[keys[i]] !== null) {
      li.appendChild(object2ul(data[keys[i]]));
    } else {
      // append the text to the li.
      li.appendChild(document.createTextNode(`${keys[i]}: ${data[keys[i]]}`));
    }
    ul.appendChild(li); // append the list item to the ul
  }

  return ul;
};

/**
 * Displays an object as JSON in the raw response section of the interface.
 * @param {Object} responseObject The JSForce response object.
 */
const displayRawResponse = (responseObject) => {
  $('#raw-response').jsonViewer(responseObject, {
    collapsed: true,
    rootCollapsable: false,
    withQuotes: true,
    withLinks: true,
  });
};

// Escapes HTML tags that may be headed to the log messages.
const escapeHTML = (html) => {
  const escape = document.createElement('textarea');
  escape.textContent = html;
  return escape.innerHTML;
};

/**
 * Log a message to the console.
 * @param {Date} timestamp The part of the system that generated the message.
 * @param {String} channel One of 'Error', 'Info', 'Success', 'Warn', and 'Debug'.
 * @param {String} message The message to display.
 */
function showLogMessage(timestamp, channel, message) {
  // Create elements for display.
  const logTable = document.getElementById('consoleMessageTable');
  const row = logTable.insertRow();
  const mesImportance = document.createElement('td');
  const mesContext = document.createElement('td');
  const mesText = document.createElement('td');

  // Add Classes.
  mesText.setAttribute('class', 'console-message');

  // Set the row highlights as needed.
  switch (channel.toLowerCase()) {
    case 'error':
      row.className += 'table-danger';
      break;
    case 'debug':
    case 'warning':
    case 'warn':
      row.className += 'table-warning';
      break;
    case 'success':
      row.className += 'table-success';
      break;
    default: // This will handle info and any junk sent.
      break;
  }

  // Add Text
  mesContext.innerHTML = new Date(timestamp).toLocaleString();
  mesImportance.innerHTML = channel;
  mesText.innerHTML = escapeHTML(message);

  // Attach Elements
  row.appendChild(mesImportance);
  row.appendChild(mesContext);
  row.appendChild(mesText);
}

/**
 * Display a list of messages pulled from the main thread.
 * @param {Array} messageList
 */
function displayMessages(messageList) {
  messageList.forEach((message) => {
    showLogMessage(message.timestamp, message.channel, message.message);
  });

  let currentCount = parseInt(document.getElementById('log-console-load-more').dataset.count, 10);
  currentCount += messageList.length;
  document.getElementById('log-console-load-more').dataset.count = currentCount;
}

/**
 * Attaches the DOM element for a table header element attached an existing table.
 * @param {Object} headerRow The DOM element to attach the new header to.
 * @param {String} labelText The text for the element.
 * @param {String} scope The scope attribute to use for the element, defaults to col.
 * @param {Integer} position The index to insert the element. Default -1 appends it to the end.
 */
const generateTableHeader = (headerRow, labelText, scope = 'col', position = -1) => {
  const newHeader = document.createElement('th');
  newHeader.setAttribute('scope', scope);
  const textNode = document.createTextNode(labelText);
  newHeader.appendChild(textNode);
  if (position === -1) {
    headerRow.appendChild(newHeader);
  } else {
    headerRow.insertBefore(newHeader, headerRow.children[position]);
  }
};

/**
 * Attaches a new table cell to an existing row.
 * @param {Object} tableRow The DOM element to attach the new element to.
 * @param {object} content The content to put in the cell.
 * @param {boolean} isText Defines if the content should be treated as text or a sub-element.
 * @param {Integer} position The index to insert to new cell. Default -1 appends to the end.
 */
const generateTableCell = (tableRow, content, isText = true, position = -1) => {
  let contentNode;
  if (isText) {
    contentNode = document.createTextNode(content);
  } else {
    contentNode = content;
  }
  const cellNode = document.createElement('td');
  cellNode.appendChild(contentNode);
  if (position === -1) {
    tableRow.appendChild(cellNode);
  } else {
    tableRow.insertBefore(cellNode, tableRow.children[position]);
  }
};

/**
 * Updates the query count information when a count query is run.
 * @param {Integer} queryCount The number to display.
 */
const refreshQueryCountOnly = (queryCount) => {
  document.getElementById('results-table-wrapper').style.display = 'none';
  document.getElementById('results-object-viewer-wrapper').style.display = 'none';
  document.getElementById('results-message-wrapper').style.display = 'block';
  let message = 'No Results Found.';
  if (queryCount > 0) {
    message = `Found ${queryCount} records`;
  }
  document.getElementById('results-message-only').innerText = message;
};

/**
 * Generates a data table from a list of sObjects returned from a query, and displays it
 * in the results-table-wrapper area of the interface.
 * @param {Object} sObjectData A JSForce query response with SF SObject data.
 */
const refreshResponseTable = (sObjectData, displayType = true) => {
  document.getElementById('results-table-wrapper').style.display = 'block';
  document.getElementById('results-message-wrapper').style.display = 'none';
  document.getElementById('results-object-viewer-wrapper').style.display = 'none';
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

  // Add the type column.
  if (displayType) {
    generateTableHeader(headRow, 'Type');
  }

  // Add the other columns from the result set.
  for (let i = 0; i < keys.length; i += 1) {
    generateTableHeader(headRow, keys[i]);
  }
  tHead.appendChild(headRow);
  resultsTable.appendChild(tHead);

  // Add the data.
  let dataRow;
  const tBody = document.createElement('tbody');
  for (let i = 0; i < sObjectData.records.length; i += 1) {
    dataRow = document.createElement('tr');
    if (displayType) {
      // Put the object type as a row level header.
      generateTableHeader(dataRow, sObjectData.records[i].attributes.type, 'row');
    }

    // Add the result details.
    for (let j = 0; j < keys.length; j += 1) {
      generateTableCell(dataRow, sObjectData.records[i][keys[j]]);
    }
    tBody.appendChild(dataRow);
  }
  resultsTable.appendChild(tBody);
};

/**
 * Displays an object in the results-object-viewer section of the interface using JSONViewer.
 *
 * @param {Object} data The object to display, object must contain message and response attributes.
 */
const refreshObjectDisplay = (data) => {
  $('#results-object-viewer-wrapper .results-summary h3').text(data.message);

  // When this is displaying a describe add a little helpful sumamry.
  if (Object.prototype.hasOwnProperty.call(data, 'response.fields')) {
    $('#results-object-viewer-wrapper .results-summary p').text(`Found ${data.response.fields.length} fields and ${data.response.recordTypeInfos.length} record types.`);
  } else {
    $('#results-object-viewer-wrapper .results-summary p').text('');
  }

  $('#results-object-viewer').jsonViewer(data.response, {
    collapsed: true,
    rootCollapsable: false,
    withQuotes: true,
    withLinks: true,
  });
};

/**
 * Displays the results of a Global describe query.
 * @param {Object} sObjectData The results from JSForce to display.
 */
const displayGlobalDescribe = (sObjectData) => {
  // Define prioirty columns to display at left.
  const prioirtyColumns = [
    'label',
    'name',
    'labelPlural',
  ];

  // Define list of columns known to have a list of information for the right edge.
  const listColumns = ['urls'];

  // Display area.
  document.getElementById('results-table-wrapper').style.display = 'block';
  document.getElementById('results-object-viewer-wrapper').style.display = 'none';
  document.getElementById('results-message-wrapper').style.display = 'none';
  document.getElementById('results-summary-count').innerText = `Your orgs contains ${sObjectData.length} objects (custom and standard)`;

  // Get the table.
  const resultsTable = document.querySelector('#results-table');

  // Clear existing table.
  while (resultsTable.firstChild) {
    resultsTable.removeChild(resultsTable.firstChild);
  }

  // Extract the header.
  const keys = Object.keys(sObjectData[0]);

  // Create the header row for the table.
  const tHead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.setAttribute('class', 'table-primary');

  // Add Priority Columns to the header
  for (let i = 0; i < prioirtyColumns.length; i += 1) {
    generateTableHeader(headRow, prioirtyColumns[i]);
  }

  // Add the other columns from the result set.
  for (let i = 0; i < keys.length; i += 1) {
    if (!prioirtyColumns.includes(keys[i]) && !listColumns.includes(keys[i])) {
      generateTableHeader(headRow, keys[i]);
    }
  }

  // Add the trailing list columns.
  for (let i = 0; i < listColumns.length; i += 1) {
    generateTableHeader(headRow, listColumns[i]);
  }

  tHead.appendChild(headRow);
  resultsTable.appendChild(tHead);

  // Add the data.
  let dataRow;
  const tBody = document.createElement('tbody');
  for (let i = 0; i < sObjectData.length; i += 1) {
    dataRow = document.createElement('tr');

    // Start with the priority columns.
    for (let j = 0; j < prioirtyColumns.length; j += 1) {
      generateTableCell(dataRow, sObjectData[i][prioirtyColumns[j]]);
    }

    // Add all non-special cased columns.
    for (let j = 0; j < keys.length; j += 1) {
      if (!prioirtyColumns.includes(keys[j]) && !listColumns.includes(keys[j])) {
        generateTableCell(dataRow, sObjectData[i][keys[j]]);
      }
    }

    // Add the list columns at the end
    for (let j = 0; j < listColumns.length; j += 1) {
      generateTableCell(dataRow, object2ul(sObjectData[i][listColumns[j]]), false);
    }

    tBody.appendChild(dataRow);
  }
  resultsTable.appendChild(tBody);
};

/**
 * Displays the fields from the results of a object describe query.
 * @param {String} objectType The name of the object for display.
 * @param {Object} fieldData The results from JSForce to display.
 */
const displayObjectFieldDescribe = (objectType, fieldData) => {
  // Define prioirty columns to display at left.
  const prioirtyColumns = [
    'label',
    'name',
    'type',
    'picklistValues',
    'restrictedPicklist',
    'length',
    'unique',
  ];

  // Define list of columns known to have a list of information to display at a list.
  const listColumns = ['picklistValues'];

  // Display area.
  document.getElementById('results-table-wrapper').style.display = 'block';
  document.getElementById('results-object-viewer-wrapper').style.display = 'none';
  document.getElementById('results-message-wrapper').style.display = 'none';
  document.getElementById('results-summary-count').innerText = `Your ${objectType} contains ${fieldData.length} fields`;

  // Get the table.
  const resultsTable = document.querySelector('#results-table');

  // Clear existing table.
  while (resultsTable.firstChild) {
    resultsTable.removeChild(resultsTable.firstChild);
  }

  // Extract the header.
  const keys = Object.keys(fieldData[0]);

  // Create the header row for the table.
  const tHead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.setAttribute('class', 'table-primary');

  // Add Priority Columns to the header
  for (let i = 0; i < prioirtyColumns.length; i += 1) {
    generateTableHeader(headRow, prioirtyColumns[i]);
  }

  // Add the other columns from the result set.
  for (let i = 0; i < keys.length; i += 1) {
    if (!prioirtyColumns.includes(keys[i])) {
      generateTableHeader(headRow, keys[i]);
    }
  }

  tHead.appendChild(headRow);
  resultsTable.appendChild(tHead);

  // Add the data.
  let dataRow;
  const tBody = document.createElement('tbody');
  for (let i = 0; i < fieldData.length; i += 1) {
    dataRow = document.createElement('tr');

    // Start with the priority columns.
    for (let j = 0; j < prioirtyColumns.length; j += 1) {
      if (!listColumns.includes(prioirtyColumns[j])) {
        generateTableCell(dataRow, fieldData[i][prioirtyColumns[j]]);
      } else {
        generateTableCell(dataRow, object2ul(fieldData[i][prioirtyColumns[j]]), false);
      }
    }

    // Add all non-special cased columns.
    for (let j = 0; j < keys.length; j += 1) {
      if (!prioirtyColumns.includes(keys[j])) {
        generateTableCell(dataRow, fieldData[i][keys[j]]);
      }
    }

    tBody.appendChild(dataRow);
  }
  resultsTable.appendChild(tBody);
};

/**
 * Displays a table with the current Org limits.
 * @param {Object} limitData Response from the API.
 */
const displayOrgLimits = (limitData) => {
  // Extract the Limit names.
  const keys = Object.keys(limitData).sort();

  // Display area.
  document.getElementById('results-table-wrapper').style.display = 'block';
  document.getElementById('results-object-viewer-wrapper').style.display = 'none';
  document.getElementById('results-message-wrapper').style.display = 'none';
  document.getElementById('results-summary-count').innerText = `Displaying information about ${keys.length} system limits`;

  // Get the table.
  const resultsTable = document.querySelector('#results-table');

  // Clear existing table.
  while (resultsTable.firstChild) {
    resultsTable.removeChild(resultsTable.firstChild);
  }

  // Set Header
  const tHead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.setAttribute('class', 'table-primary');
  // Add the type column.
  generateTableHeader(headRow, 'Limit');
  generateTableHeader(headRow, 'Max');
  generateTableHeader(headRow, 'Remaining');
  generateTableHeader(headRow, 'Other');
  tHead.appendChild(headRow);

  // Add the data.
  let dataRow;
  let cellNode;
  let rowKeys;
  let otherKey;
  const tBody = document.createElement('tbody');
  for (let i = 0; i < keys.length; i += 1) {
    dataRow = document.createElement('tr');

    // Add a key as header columnm.
    generateTableHeader(dataRow, keys[i], 'row');

    // Add Max and Remaining.
    generateTableCell(dataRow, limitData[keys[i]].Max);
    generateTableCell(dataRow, limitData[keys[i]].Remaining);

    // Other values as UL.
    rowKeys = Object.keys(limitData[keys[i]]);
    if (rowKeys.length > 2) {
      // Remove the two standard keys and work with what's left
      otherKey = rowKeys.filter((item) => !['Max', 'Remaining'].includes(item)).pop();
      cellNode = document.createElement('td');
      cellNode.innerHTML = `<p>${otherKey}:<br>Max: ${limitData[keys[i]][otherKey].Max}<br>Remaining: ${limitData[keys[i]][otherKey].Remaining}</p>`;
      dataRow.appendChild(cellNode);
    } else {
      // Blank placeholder.
      generateTableCell(dataRow, '');
    }

    // Add the row to the table body.
    tBody.appendChild(dataRow);
  }

  // Add the table body to the table.
  resultsTable.appendChild(tHead);
  resultsTable.appendChild(tBody);
};

const displayPermSetList = (data) => {
  const cleanedData = data;
  // Need to extract the Profile name, when present.
  for (let i = 0; i < data.records.length; i += 1) {
    if (data.records[i].Profile != null) {
      cleanedData.records[i].Profile = data.records[i].Profile.Name;
    }
  }
  refreshResponseTable(cleanedData, false);

  // Correct the displayed information.
  document.getElementById('results-summary-count').innerText = `This Org has ${data.totalSize} permission sets`;

  // Add a column of buttons to get more details about the set.
  const resultsTable = document.querySelector('#results-table');
  let buttonCell;
  let row;
  for (let i = 0; i < resultsTable.rows.length; i += 1) {
    row = resultsTable.rows[i];
    if (i === 0) {
      generateTableHeader(row, '', 'col', 0);
    } else {
      buttonCell = document.createElement('button');
      buttonCell.innerHTML = 'Details';
      buttonCell.classList.add('permset-detail-button');
      buttonCell.dataset.permSetName = data.records[i - 1].Name;
      generateTableCell(row, buttonCell, false, 0);
    }
  }
  // Add click listener for all the new buttons.
  Array.from(document.getElementsByClassName('permset-detail-button')).forEach((element) => {
    element.addEventListener('click', () => {
      const parameters = { org_permset_detail_name: element.dataset.permSetName };
      window.api.send('sf_orgPermSetDetail', parameters);
    });
  });
};

// ===== Response handlers from IPC Messages to render context ======
// Login response.
window.api.receive('response_login', (data) => {
  if (data.status) {
    // Check for an existing connection in the drop down.
    const orgSelect = document.getElementById('active-org');
    const existingOption = document.getElementById(`sforg-${data.response.organizationId}`);

    if (!existingOption) {
      // Add the new connection to the list of options.
      const opt = document.createElement('option');
      opt.value = data.response.organizationId;
      opt.innerHTML = data.request.username;
      opt.id = `sforg-${opt.value}`;
      orgSelect.appendChild(opt);
    } else {
      existingOption.innerHTML = data.request.username;
    }

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
  displayRawResponse(data);
});

// Generic Response.
window.api.receive('response_generic', (data) => {
  displayRawResponse(data);
});

// Query Response. Print the query results in table.
window.api.receive('response_query', (data) => {
  if (data.status) {
    displayRawResponse(data);
    // Detect and handle reponses with just a count.
    if (data.response.records.length < 1) {
      refreshQueryCountOnly(data.response.totalSize);
    } else {
      refreshResponseTable(data.response);
    }
  } else {
    displayRawResponse(data.message);
  }
});

// Describe Response Handler: setup jsTree.
window.api.receive('response_describe', (data) => {
  document.getElementById('results-table-wrapper').style.display = 'none';
  document.getElementById('results-object-viewer-wrapper').style.display = 'block';

  if (data.request.rest_api_describe_limit === true) {
    displayObjectFieldDescribe(data.response.label, data.response.fields);
  } else if (data.status) {
    refreshObjectDisplay(data);
  }
  displayRawResponse(data);
});

// Global Describe Response Handler: use jsTree.
window.api.receive('response_describe_global', (data) => {
  document.getElementById('results-table-wrapper').style.display = 'none';
  document.getElementById('results-object-viewer-wrapper').style.display = 'block';
  displayRawResponse(data);
  if (data.status) {
    displayGlobalDescribe(data.response.sobjects);
  }
});

// Org Details Response Handler.
window.api.receive('response_org_object_display', (data) => {
  document.getElementById('results-table-wrapper').style.display = 'none';
  document.getElementById('results-object-viewer-wrapper').style.display = 'block';
  displayRawResponse(data);
  if (data.status) {
    refreshObjectDisplay(data);
  }
});

// Org Limits Response Handler.
window.api.receive('response_org_limits', (data) => {
  document.getElementById('results-table-wrapper').style.display = 'none';
  document.getElementById('results-object-viewer-wrapper').style.display = 'block';
  displayRawResponse(data);
  if (data.status) {
    displayOrgLimits(data.response);
  }
});

// Permission Set Listing Response. Print the results in a table, offer links to details.
window.api.receive('response_permset_list', (data) => {
  document.getElementById('results-table-wrapper').style.display = 'none';
  document.getElementById('results-object-viewer-wrapper').style.display = 'block';
  displayRawResponse(data);
  if (data.status) {
    displayPermSetList(data.response);
  }
});

// Permission Set Listing Response. Print the results in a table, offer links to details.
window.api.receive('response_permset_detail', (data) => {
  document.getElementById('results-table-wrapper').style.display = 'none';
  document.getElementById('results-object-viewer-wrapper').style.display = 'block';
  displayRawResponse(data);
  if (data.status) {
    refreshObjectDisplay(data);
  }
});

// Process a log message.
window.api.receive('log_messages', (data) => {
  displayMessages(data.messages);
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
});

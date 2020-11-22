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
          data[$(item).attr('id').replace(/-/g, '_')] = $(item).val();
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
      li.appendChild(document.createTextNode(data[keys[i]]));
    }
    ul.appendChild(li); // append the list item to the ul
  }

  return ul;
};

/**
 * Attaches the DOM element for a table header element attached an existing table.
 * @param {Object} headerRow The DOM element to attach the new header to.
 * @param {String} labelText The text for the element.
 * @param {String} scope The scope attribute to use for the element, defaults to col.
 */
const generateTableHeader = (headerRow, labelText, scope = 'col') => {
  const newHeader = document.createElement('th');
  newHeader.setAttribute('scope', scope);
  const textNode = document.createTextNode(labelText);
  newHeader.appendChild(textNode);
  headerRow.appendChild(newHeader);
};

/**
 * Attaches a new table cell to an existing row.
 * @param {Object} tableRow The DOM element to attach the new element to.
 * @param {object} content The content to put in the cell.
 * @param {boolean} isText Defines if the content should be treated as text or a sub-element.
 */
const generateTableCell = (tableRow, content, isText = true) => {
  let contentNode;
  if (isText) {
    contentNode = document.createTextNode(content);
  } else {
    contentNode = content;
  }
  const cellNode = document.createElement('td');
  cellNode.appendChild(contentNode);
  tableRow.appendChild(cellNode);
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
const refreshResponseTable = (sObjectData) => {
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
  generateTableHeader(headRow, 'Type');

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
    // Put the object type as a row level header.
    generateTableHeader(dataRow, sObjectData.records[i].attributes.type, 'row');

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

// ===== Response handlers from IPC Messages to render context ======
// Login response.
window.api.receive('response_login', (data) => {
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
  displayRawResponse(data);
  if (data.status) {
    refreshObjectDisplay(data);
  }
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
window.api.receive('reponnse_org_limits', (data) => {
  document.getElementById('results-table-wrapper').style.display = 'none';
  document.getElementById('results-object-viewer-wrapper').style.display = 'block';
  displayRawResponse(data);
  if (data.status) {
    displayOrgLimits(data.response);
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
});

# ElectronForce

ElectronForce is a simple cross platform graphic interface for the Salesforce APIs using the [JSForce](https://jsforce.github.io/) library.

## Quick Start

Right now, while the project is setup to build native applications on Mac, Windows, and Linux, I'm not maintaining builds. So it's a bit developer focused and you'll need to have [Node.js installed](https://nodejs.org/en/download/). Granted this is a largely an API interface so some technical ability is expected but longer-term not the ability to understand JavaScript. Anyway you don't need to know how to use Node just need to have the tools around.

From your terminal:

    git clone https://github.com/acrosman/electronForce.git
    cd electronForce
    npm start

ElectronForce will allow you to log into your Salesforce Org and interact with some of the APIs. While all of JSForce's supported APIs are listed, only Query, Search, and Describe are currently support.

### Log in

Currently only the standard login is supported, not OAuth2, so you likely will need your [security token](https://help.salesforce.com/articleView?id=user_security_token.htm&type=5).

In the login fields provide your username, password, and security token. If you are logging into a production or trailhead instance you can use the default login URL. If you are logging into a Sandbox use: https://test.salesforce.com.

![ElectronForce Main screen.](https://raw.githubusercontent.com/acrosman/electronForce/master/documentation/images/ElectronForceMain.png "Login fields as described above and query API example as follows.")

The main interface includes the login information, API selector and parameter fields on the left, raw display of the previous API response on the right, and a processed version of the response at the bottom.

### Run Query or Search

The SOQL and SOSL Query APIs allow you to run querys and searches using the appropriate Salesforce syntax. When any of the supported APIs are selected appropriate inputs are provided so you can formulate the details of the query. In the screen shot above, a simple Select of Contacts is shown, with a query requesting the record Id and Contact Name.

`SELECT Id, Name FROM Contact`

At the bottom of the display ElectronForce provides a grid view of the query results:

![ElectronForce Search Result Screen.](https://raw.githubusercontent.com/acrosman/electronForce/master/documentation/images/ElectronForceSearch.png "A table display of the Contacts returned from Salesforce").


_Note: Contacts shown are from a Salesforce Trailhead not from a production database._

### Run Describe

Beyond exploring the data and testing queries, ElectronForce can also allow you to explore the metadata for a specific object provided via the Describe API.  Select the Describe API from the selector and enter the name of the object you would like described.  ElectronForce will format the resulting structures as an interactive tree view.

![ElectronForce Describe Result Screen.](https://raw.githubusercontent.com/acrosman/electronForce/master/documentation/images/ElectronForceDescribe.png "A simple tree display of the describe response.").

## Larger Vision

Create a tool that not only can explore and interact with the Salesforce APIs, but also documents, tracks, and reports on elements of a build that are critical for integrations with 3rd party solutions. And while we're at it, Data Loader needs a replacement.

It will need to:
1. Connect to one or more orgs.
2. Export object field metadata and at the field level:
    * Support markup of field used in integrations.
    * Allow definitions of sample data for each field.
    * Save annotations for later use.
3. Flag relavent differences between orgs.
4. Generate sample data for both Salesforce import and CSV export.
5. Generate human readable specs and documentation for the relavent objects and fields.

## Disclaimer

This project has no direct association with Salesforce except the use of the APIs provided under the terms of use of their services.

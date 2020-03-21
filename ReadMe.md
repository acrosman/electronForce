# ElectronForce

This is a basic proof-of-concept level wrapper of Electron around JSForce. The intention is to do more interesting things in the future, but first having a simple cross-platform application to run Salesforce API calls in an interface seems useful.

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

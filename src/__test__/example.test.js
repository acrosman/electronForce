const Application = require("spectron").Application;
const electronPath = require("electron");
const path = require("path");

let app;


beforeAll(() => {
  app = new Application({
    path: electronPath,
    chromeDriverArgs: ["--disable-extensions"],
    args: [path.join(__dirname, "../../")],
    env: {
        SPECTRON: true,
        ELECTRON_ENABLE_LOGGING: true,
        ELECTRON_ENABLE_STACK_DUMPING: true
    },
  });

  return app.start();
}, 15000);

afterAll(function () {
  if (app && app.isRunning()) {
    return app.stop();
  }
});

test("Displays App window", async function () {
  let windowCount = await app.client.getWindowCount();

  expect(windowCount).toBe(4);
});

test("Header displays appropriate text", async function () {
  const headerElement = await app.client.$("h1");

  let headerText = await headerElement.getText();

  expect(headerText).toBe("💖 Hello World!");
});
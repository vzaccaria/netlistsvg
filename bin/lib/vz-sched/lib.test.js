const { eventLoop, schedule0 } = require("./lib");

it("Schedules 3 tasks with no waits", () => {
  const res = eventLoop({}, schedule0);
  expect(res).toMatchSnapshot();
});

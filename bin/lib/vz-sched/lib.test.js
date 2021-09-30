const { eventLoop, schedule0 } = require("./lib");

it("Schedules 3 tasks with no waits - same weights", () => {
  const res = eventLoop({}, schedule0);
  expect(res).toMatchSnapshot();
});

it("Schedules 3 tasks with no waits - different weights", () => {
  const res = eventLoop({}, schedule0);
  expect(res).toMatchSnapshot();
});

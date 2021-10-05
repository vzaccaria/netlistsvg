const { eventLoop } = require("./lib");
const { schedule0, schedule1, schedule2 } = require("./fixtures");

it("Schedules 3 tasks with no waits - same weights", () => {
  const res = eventLoop({}, schedule0);
  expect(res).toMatchSnapshot();
});

it("Schedules 3 tasks with no waits - different weights", () => {
  const res = eventLoop({}, schedule1);
  expect(res).toMatchSnapshot();
});

it("Schedules 3 tasks with 2 waits - same weights", () => {
  const res = eventLoop({}, schedule2);
  expect(res).toMatchSnapshot();
});

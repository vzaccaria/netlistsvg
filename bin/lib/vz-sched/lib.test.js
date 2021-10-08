const { eventLoop } = require("./lib");
const { schedule } = require("./fixtures");

it("Schedules 3 tasks with no waits - same weights", () => {
  const res = eventLoop({}, schedule[0]);
  expect(res).toMatchSnapshot();
});

it("Schedules 3 tasks with no waits - different weights", () => {
  const res = eventLoop({}, schedule[1]);
  expect(res).toMatchSnapshot();
});

it("Schedules 3 tasks with 2 waits - same weights", () => {
  const res = eventLoop({}, schedule[2]);
  expect(res).toMatchSnapshot();
});

it("Schedules 3 tasks with more than 1 wait - same weights", () => {
  const res = eventLoop({}, schedule[8]);
  expect(res).toMatchSnapshot();
});

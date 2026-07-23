const _ = require("lodash");
const { eventLoop } = require("./lib");
const { schedule } = require("./fixtures");

_.map(schedule, (s, i) => {
  it(`Schedule ${i} works as expected`, () => {
    console.log(s);
    const res = eventLoop({}, s);
    expect(res).toMatchSnapshot();
  });
});

let mk = (initialrq) => ({
  timer: 0.5,
  runfor: 8,
  class: { type: "CFS", latency: 6.0, mingran: 0.75, wgup: 1 },
  initialrq,
  tasks: [
    { index: 0, name: "A", lambda: 1, start: 0, events: [8], vrt: 0.0 },
    { index: 1, name: "B", lambda: 1, start: 0, events: [8], vrt: 0.0 },
    { index: 2, name: "C", lambda: 1, start: 0, events: [8], vrt: 0.0 }
  ],
  graphics: { vspace: 1, hspace: 1, barheight: 0.5 }
});

it("initialrq orders the initial runqueue by task name", () => {
  const res = eventLoop({}, mk(["B", "C", "A"]));
  expect(_.map(res[0].rbt, "name")).toEqual(["B", "C", "A"]);
  // First slot of the runqueue runs first.
  expect(_.find(res[0].rbt, (t) => t.R === "X").name).toBe("B");
});

it("initialrq accepts task indices too", () => {
  const res = eventLoop({}, mk([2, 0, 1]));
  expect(_.map(res[0].rbt, "name")).toEqual(["C", "A", "B"]);
});

it("initialrq appends unlisted tasks in their original order", () => {
  const res = eventLoop({}, mk(["C"]));
  expect(_.map(res[0].rbt, "name")).toEqual(["C", "A", "B"]);
});

it("runqueue matches schedule.tasks order when initialrq is absent", () => {
  const s = mk(undefined);
  delete s.initialrq;
  const res = eventLoop({}, s);
  expect(_.map(res[0].rbt, "name")).toEqual(["A", "B", "C"]);
});

it("runs indefinitely after a final wait with no following CPU burst", () => {
  const s = mk(["A"]);
  s.runfor = 2;
  s.tasks = [
    { index: 0, name: "A", lambda: 1, start: 0, events: [0.5, 0.5], vrt: 0.0 }
  ];

  const res = eventLoop({}, s);
  const finalTask = _.find(res[res.length - 1].rbt, { name: "A" });

  expect(finalTask.R).toBe("X");
  expect(finalTask.events).toEqual([]);
  expect(finalTask.sum).toBe(1.5);
  expect(res[res.length - 1].blocked).toEqual([]);
});

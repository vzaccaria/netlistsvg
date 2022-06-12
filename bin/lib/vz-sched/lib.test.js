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

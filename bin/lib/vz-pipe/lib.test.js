const { run } = require("./lib");
const { fixtures } = require("./fixtures");
const _ = require("lodash");

_.map(fixtures, f => {
  it(f.desc, () => {
    const res = run(f.options, f.program);
    expect(res.table).toMatchSnapshot();
  });
});

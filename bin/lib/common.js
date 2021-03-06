let _ = require("lodash");
let tmp = require("tmp-promise");
let $fs = require("mz/fs");
let { exec } = require("mz/child_process");

let alphabet = "abcdefghilmnopqrstuvwz";
let lab = (pfx, idx) => {
  let quot = (n, d) => {
    Math.floor(n / d);
  };

  let x = [];
  let d = alphabet.length;
  do {
    x.push(alphabet.charAt(idx % d));
    idx = quot(idx, d);
  } while (idx > 0);
  return pfx + _.join(x, "");
};

let execWithStringStdErr = (cmd, string, options) => {
  let keep = !_.get(options, "cleanup", true);
  let postfix = _.get(options, "postfix", ".tmp");
  return tmp.file({ postfix, keep }).then(o => {
    return $fs
      .writeFile(o.path, string, "utf8")
      .then(() => {
        let cc = cmd(o.path);
        if (!_.isUndefined(options.logger)) options.logger.debug(cc);
        return exec(cc);
      })
      .then(a => {
        if (!keep) {
          o.cleanup();
        }
        return a;
      });
  });
};

let execWithString = (cmd, string, options) => {
  return execWithStringStdErr(cmd, string, options).then(a => a[0]);
};

module.exports = { execWithString, execWithStringStdErr, lab };

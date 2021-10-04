"use strict";

let _ = require("lodash");
let Table = require("easy-table");

// let $fs = require("mz/fs");
// let $gstd = require("get-stdin");
const { latexArtifact, saveArtifacts } = require("../artifacts");

let r2 = x => Math.round(x * 100) / 100;

let eventLoop = (options, schedule) => {
  let state = {
    schedule: schedule,
    curr: undefined,
    rbt: [],
    vmin: 0
  };

  let resched = msg => {
    console.log(msg);
    if (state.rbt.length > 0) {
      state.curr = state.rbt[0];
      state.curr.prev = state.curr.sum;
      console.log(
        `scheduled task ${state.curr.name} to run @${timer.walltime}`
      );
    } else {
      state.curr = undefined;
    }
  };

  let sumlambda = () => _.reduce(state.rbt, (a, t) => a + t.lambda, 0);

  let schedslice = t => schedule.class.latency * (t.lambda / sumlambda());

  let _start_task = t => {
    t.sum = 0;
    // on clone, dont use a lower vrt that would interrupt the current process
    state.rbt.push(t);
    if (_.isUndefined(t.vrt)) {
      t.vrt = state.vmin + schedslice(t) / t.lambda;
    }
    if (
      state.curr === undefined ||
      t.vrt + schedule.class.wgup * (t.lambda / sumlambda()) < state.curr.vrt
    ) {
      resched(`starting task ${t.name} @${timer.walltime}`);
    }
  };

  let removeFromRbt = task => {
    state.rbt = _.filter(state.rbt, o => !(o.index == task.index));
  };

  let addToRbt = task => {
    state.rbt.splice(_.sortedLastIndexBy(state.rbt, task, "vrt"), 0, task);
  };

  let _wakeup = tw => {
    console.log(`Waking up at @${timer.walltime}`);
    tw.vrt = Math.max(tw.vrt, state.vmin - schedule.class.latency / 2);
    console.log(Table.print(state.rbt));
    addToRbt(tw);
    console.log(Table.print(state.rbt));
    if (
      state.curr === undefined ||
      tw.vrt + schedule.class.wgup * tw.lambda < state.curr.vrt
    ) {
      if (!_.isUndefined(state.curr)) {
        let v = tw.vrt + schedule.class.wgup * tw.lambda;
        tw.vrtlwk = `${v} < ${state.curr.vrt}`;
      }
      removeFromRbt(state.curr);
      addToRbt(state.curr);
      resched(`Waking up task ${tw.name} @${timer.walltime}`);
    }
  };

  let timer = {
    walltime: -schedule.timer,
    events: []
  };

  let updateTimer = () => {
    timer.walltime = r2(timer.walltime + schedule.timer);
    // console.log(timer);
    if (timer.walltime > schedule.runfor) {
      process.exit();
    }

    /* Prioritize tasktick */

    let firable_tt = _.remove(
      timer.events,
      e => e.type === "_task_tick" && r2(e.deadline) <= timer.walltime
    );
    _.map(firable_tt, e => {
      e.func(e.arg);
    });

    let firable = _.remove(timer.events, e => r2(e.deadline) <= timer.walltime);
    _.map(firable, e => {
      e.func(e.arg);
    });

    state.rbt = _.map(state.rbt, t => {
      t.q = schedslice(t);
      if (!_.isUndefined(state.curr) && state.curr.index == t.index) {
        t.R = "X";
      } else {
        t.R = "";
      }
      return t;
    });
    console.log(`at time @${timer.walltime}`);
    console.log(Table.print(state.rbt));
    let d = {};
    d[`${timer.walltime}`] = _.clone(state.rbt);
    return d;
  };

  let _setTimeout = (func, ms, arg, type) => {
    timer.events.push({ deadline: ms + timer.walltime, func, arg, type });
  };

  let _task_tick = () => {
    _setTimeout(_task_tick, schedule.timer, undefined, "_task_tick");
    if (state.curr !== undefined) {
      let delta = schedule.timer;

      if (state.curr.events[0] >= delta) {
        state.curr.sum = r2(state.curr.sum + delta);
        state.curr.vrt = r2(state.curr.vrt + delta / state.curr.lambda);
        state.vmin = _.minBy(state.rbt, "vrt").vrt;
        if (state.curr.sum - state.curr.prev == schedslice(state.curr)) {
          removeFromRbt(state.curr);
          addToRbt(state.curr);
          resched(
            `task ${state.curr.name} finished quantum @${timer.walltime}`
          );
        }
        state.curr.events[0] = r2(state.curr.events[0] - delta);
      }
      if (state.curr.events[0] === 0) {
        // must sleep
        let ts = state.curr;
        removeFromRbt(state.curr);
        let blocktime = ts.events[1];
        if (!_.isUndefined(blocktime)) {
          _setTimeout(_wakeup, blocktime, ts, "_wakeup");
          ts.events = _.tail(_.tail(ts.events));
        }
        resched(`putting task to sleep ${ts.name} @${timer.walltime}`);
      }
    }
  };

  _.map(schedule.tasks, t => {
    _setTimeout(_start_task, t.start, t, "_start_task");
  });
  _setTimeout(_task_tick, 2 * schedule.timer, undefined, "_task_tick");

  let res = _.map(
    _.range(1, (schedule.runfor + 1) / schedule.timer),
    updateTimer
  );
  return res;
};

let wrapper = c => `
\\begin{tikzpicture}
${c}
\\end{tikzpicture}
`;

let drawHistory = state => {
  let hs = state.schedule.graphics.hspace;
  let vs = state.schedule.graphics.vspace;
  let hh = state.schedule.graphics.barheight;
  let drawRan = (state, r) => {
    return `\\draw[draw=black] (${r.tstart * hs}, ${r.task.index *
      vs}) rectangle ++(${(r.tend - r.tstart) * hs},${hh}) 
       node[pos=.5] {${r2(r.tend - r.tstart)}};`;
  };
  let drawBlocked = (state, r) => {
    return `\\draw[draw=black, fill=gray] (${r.tstart * hs}, ${r.task.index *
      vs}) rectangle ++(${(r.tend - r.tstart) *
      hs},${hh}) node[pos=.5, text=white] {${r2(r.tend - r.tstart)};`;
  };
  let diag = _.map(state.history, x => {
    if (x.event === "RAN") return drawRan(state, x);
    if (x.event === "BLOCKED") return drawBlocked(state, x);
  });
  let tnames = _.map(
    state.schedule.tasks,
    t => `\\node at(${hs * -1}, ${t.index * hs + 0.5 * hh}) {${t.name}};`
  );

  return wrapper(_.join(_.flatten([tnames, diag]), "\n"));
};

let saveIt = (options, state) => {
  state.latex = [
    latexArtifact(
      drawHistory(state),
      "rt diagram",
      "standalone",
      "pdflatex",
      "-r varwidth"
    )
  ];
  if (!options.save) {
    console.log(JSON.stringify(state, 0, 4));
  } else {
    saveArtifacts(state.latex, options.save);
  }
};

module.exports = { eventLoop };

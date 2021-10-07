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
    blocked: [],
    vmin: 0
  };

  let timer = {
    walltime: -schedule.timer,
    events: [],
    show: [0, 1, 4, 6, 8, 9, 10, 11]
  };

  let updateTimer = () => {
    timer.walltime = r2(timer.walltime + schedule.timer);
    // console.log(timer);

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
    if (_.includes(timer.show, timer.walltime)) {
      console.log(`at time @${timer.walltime}`);
      console.log(Table.print(state.rbt));
    }
    return {
      rbt: _.cloneDeep(state.rbt),
      blocked: _.cloneDeep(state.blocked),
      time: timer.walltime
    };
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

  let addBlocked = task => {
    state.blocked.splice(0, 0, task);
  };

  let removeBlocked = task => {
    state.blocked = _.filter(state.blocked, o => !(o.index == task.index));
  };

  let addToRbt = task => {
    state.rbt.splice(_.sortedLastIndexBy(state.rbt, task, "vrt"), 0, task);
  };

  let _wakeup = tw => {
    console.log(`Call to wake up ${tw.name} at @${timer.walltime}`);
    tw.vrt = Math.max(tw.vrt, state.vmin - schedule.class.latency / 2);
    removeBlocked(tw);
    addToRbt(tw);
    let v = r2(tw.vrt + schedule.class.wgup * (tw.lambda / sumlambda()));
    if (!_.isUndefined(state.curr)) {
      tw.vrtlwk = `${v} < ${state.curr.vrt}`;
    }
    if (state.curr === undefined || v < state.curr.vrt) {
      removeFromRbt(state.curr);
      addToRbt(state.curr);
      resched(`Waking up task ${tw.name} @${timer.walltime}`);
    }
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
        state.curr.events[0] = r2(state.curr.events[0] - delta);
        if (state.curr.sum - state.curr.prev == schedslice(state.curr)) {
          removeFromRbt(state.curr);
          addToRbt(state.curr);
          resched(
            `task ${state.curr.name} finished quantum @${timer.walltime}`
          );
        }
      }
      if (state.curr.events[0] === 0) {
        // must sleep
        let ts = state.curr;
        removeFromRbt(state.curr);
        addBlocked(state.curr);
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

let parseHistoryEvents = (history, schedule) => {
  // assume we always start from 0
  return _.flattenDeep(
    _.map(history, ({ rbt, time }) => {
      let v;
      if (rbt.length > 0) {
        v = {
          event: "RAN",
          tstart: time,
          tend: time + schedule.timer,
          index: rbt[0].index,
          vrt: rbt[0].vrt,
          sum: rbt[0].sum
        };
      }
      let blocked_tasks = _.filter(
        schedule.tasks,
        ({ index }) => !_.includes(_.map(rbt, "index"), index)
      );
      return [
        v,
        _.map(blocked_tasks, t => {
          return {
            event: "BLOCKED",
            tstart: time,
            tend: time + schedule.timer,
            index: t.index
          };
        })
      ];
    })
  );
};

let rewriteHistory = (history, schedule) => {
  return _.flattenDeep([
    _.map(schedule.tasks, t => {
      let hst = _.filter(
        history,
        ht => ht.index === t.index && ht.event === "RAN"
      );
      for (let i = 0; i < hst.length - 1; i++) {
        hst[i].vrt = hst[i + 1].vrt;
        hst[i].sum = hst[i + 1].sum;
      }
      return hst;
    }),
    _.map(schedule.tasks, t => {
      let hst = _.filter(
        history,
        ht => ht.index === t.index && ht.event === "BLOCKED"
      );
      for (let i = 0; i < hst.length - 1; i++) {
        hst[i].vrt = hst[i + 1].vrt;
        hst[i].sum = hst[i + 1].sum;
      }
      return hst;
    })
  ]);
};

let drawHistory = (history, schedule) => {
  let hs = schedule.graphics.hspace;
  let vs = schedule.graphics.vspace;
  let hh = schedule.graphics.barheight;

  let printAt = (time, index, m) => {
    return `\\node at(${hs * time}, ${index * hs + 0.5 * hh}) {\\tiny ${m}};`;
  };

  let drawRan = r => {
    return [
      `\\draw[draw=black] (${r.tstart * hs}, ${r.index *
        vs}) rectangle ++(${(r.tend - r.tstart) * hs},${hh}) 
       node[pos=.5] {}; `,
      printAt(r.tend, r.index - 0.4, r.vrt),
      printAt(r.tend, r.index + 0.4, r.sum)
    ];
  };
  let drawBlocked = r => {
    return `\\draw[draw=black, fill=gray] (${r.tstart * hs}, ${r.index *
      vs}) rectangle ++(${(r.tend - r.tstart) *
      hs},${hh}) node[pos=.5, text=white] {};`;
  };
  history = parseHistoryEvents(history, schedule);
  console.log(history);
  history = rewriteHistory(history, schedule);
  let diag = _.map(history, x => {
    if (x.event === "RAN") return drawRan(x);
    if (x.event === "BLOCKED") return drawBlocked(x);
  });
  let tnames = _.flattenDeep([
    _.map(
      schedule.tasks,
      t => `\\node at(${hs * -1}, ${t.index * hs + 0.5 * hh}) {${t.name}};`
    ),
    _.map(
      schedule.tasks,
      t =>
        `\\node at(${hs * -0.6}, ${t.index * hs + 0.3 * hh}) {\\tiny ${t.vrt}};`
    )
  ]);

  return wrapper(_.join(_.flatten([tnames, diag]), "\n"));
};

let saveIt = (options, history, schedule) => {
  history.latex = [
    latexArtifact(
      drawHistory(history, schedule),
      "rt diagram",
      "standalone",
      "pdflatex",
      "-r varwidth"
    )
  ];
  if (!options.save) {
    console.log(JSON.stringify(history, 0, 4));
  } else {
    saveArtifacts(history.latex, options.save);
  }
};

let runAndSave = (options, schedule) => {
  let schcopy = _.cloneDeep(schedule);
  let history = eventLoop(options, schedule);
  saveIt(options, history, schcopy);
};

module.exports = { eventLoop, saveIt, runAndSave };

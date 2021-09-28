#!/usr/bin/env node
"use strict";

let _ = require("lodash");
// let $fs = require("mz/fs");
// let $gstd = require("get-stdin");
const { latexArtifact, saveArtifacts } = require("./lib/artifacts");

const prog = require("caporal");

let schedule = {
  timer: 0.1,
  runfor: 10,
  class: {
    type: "CFS",
    latency: 6.0,
    mingran: 0.75,
    wgup: 1
  },

  tasks: [
    // {
    //   index: 2,
    //   name: "$\\tau_2$",
    //   lambda: 1,
    //   start: 0,
    //   events: [5]
    // },
    // {
    //   index: 1,
    //   name: "$\\tau_1$",
    //   lambda: 1,
    //   start: 0,
    //   events: [5]
    // },
    {
      index: 0,
      name: "$\\tau_0$",
      lambda: 1,
      start: 1,
      events: [2, 2, 2, 2, 2]
    }
  ],
  graphics: {
    vspace: 1,
    hspace: 1,
    barheight: 0.5
  }
};

let eventLoop = (options, schedule) => {
  let state = {
    schedule: schedule,
    curr: undefined,
    rbt: [],
    vmin: 0
  };

  let resched = msg => {
    state.rbt = _.sortBy(state.rbt, "vrt");
    console.log(msg, state.rbt);
    if (state.rbt.length > 0) {
      state.curr = state.rbt[0];
      state.curr.prev = state.curr.sum;
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
    t.vrt = state.vmin + schedslice(t) / t.lambda;
    if (
      state.curr === undefined ||
      t.vrt + schedule.class.wgup * (t.lambda / sumlambda()) < state.curr.vrt
    ) {
      resched(`starting task ${t.name} @${timer.walltime}`);
    }
  };

  let _wakeup = tw => {
    console.log(`Waking up at @${timer.walltime}`);
    tw.vrt = Math.max(tw.vrt, state.vmin - schedule.class.latency / 2);
    state.rbt.push(tw);
    state.rbt = _.sortBy(state.rbt, "vrt");
    if (
      state.curr === undefined ||
      tw.vrt + schedule.class.wgup * tw.lambda < state.curr.vrt
    ) {
      resched(`waking up task ${tw.name} @${timer.walltime}`);
    }
  };

  let timer = {
    walltime: 0,
    events: []
  };

  let updateTimer = () => {
    timer.walltime += schedule.timer;
    console.log(timer);
    if (timer.walltime > schedule.runfor) {
      process.exit();
    }
    let firable = _.remove(timer.events, e => e.deadline <= timer.walltime);
    _.map(firable, e => {
      e.func(e.arg);
    });
  };

  let _setTimeout = (func, ms, arg) => {
    timer.events.push({ deadline: ms + timer.walltime, func, arg });
  };

  let _task_tick = () => {
    _setTimeout(_task_tick, schedule.timer);
    if (state.curr !== undefined) {
      let delta = schedule.timer;
      state.curr.sum += delta;
      state.curr.vrt += delta / state.curr.lambda;
      state.vmin = _.minBy(state.rbt, "vrt").vrt;
      state.curr.events[0] -= delta;
      if (state.curr.events[0] <= 0) {
        // must sleep
        let ts = state.curr;
        state.rbt = _.filter(state.rbt, o => !(o.index == ts.index));
        let blocktime = ts.events[1];
        if (!_.isUndefined(blocktime)) {
          console.log(`Blocking for ${blocktime}`);
          _setTimeout(_wakeup, blocktime, ts);
          ts.events = _.tail(_.tail(ts.events));
        }
        resched(`putting task to sleep ${ts.name} @${timer.walltime}`);
      } else {
        if (state.curr.prev - state.curr.sum == schedslice(state.curr))
          resched(
            `task ${state.curr.name} finished quantum @${timer.walltime}`
          );
      }
    }
  };

  _.map(schedule.tasks, t => {
    _setTimeout(_start_task, t.start, t);
  });
  _setTimeout(_task_tick, schedule.timer);

  setInterval(updateTimer, 100);
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
       node[pos=.5] {${Math.round((r.tend - r.tstart) * 100) / 100}};`;
  };
  let drawBlocked = (state, r) => {
    return `\\draw[draw=black, fill=gray] (${r.tstart * hs}, ${r.task.index *
      vs}) rectangle ++(${(r.tend - r.tstart) *
      hs},${hh}) node[pos=.5, text=white] {${Math.round(
      (r.tend - r.tstart) * 100
    ) / 100}};`;
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

let main = () => {
  prog
    .description("Swiss Knife tool schedule diagrams")
    .argument("[json]", "JSON file or stdin")
    .option(
      "-s, --save <string>",
      "save data with in files with prefix <string>"
    )
    .option(
      "-e, --example <string>",
      "dump example for <string> = (moore|mealy)"
    )
    .option("-w, --draw", "produce only latex code for drawing")
    .action((args, options) => {
      // let result = run(options, schedule);
      eventLoop(options, schedule);
      //saveIt(options, result);
    });
  prog.parse(process.argv);
};

main();

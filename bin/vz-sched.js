#!/usr/bin/env node
"use strict";

let _ = require("lodash");
// let $fs = require("mz/fs");
// let $gstd = require("get-stdin");
const { latexArtifact, saveArtifacts } = require("./lib/artifacts");

const prog = require("caporal");

let schedule = {
  class: {
    type: "CFS",
    latency: 8,
    mingran: 0
  },

  tasks: [
    {
      index: 2,
      name: "$\\tau_2$",
      state: "NEW",
      lambda: 4,
      start: 0,
      events: [1, 2, 1, 1, 1]
    },
    {
      index: 1,
      name: "$\\tau_1$",
      state: "NEW",
      lambda: 4,
      start: 0,
      events: [1, 5, 2, 3, 2]
    },
    {
      index: 0,
      name: "$\\tau_0$",
      state: "NEW",
      lambda: 3,
      start: 0,
      events: [2, 1, 10, 4, 2]
    }
  ],
  timer: 0.01,
  runfor: 20,
  graphics: {
    vspace: 1,
    hspace: 1,
    barheight: 0.5
  }
};

let initialState = (options, schedule) => {
  return {
    timer: schedule.timer,
    time: -schedule.timer,
    schedule: schedule,
    history: []
  };
};

let mapred = (list, pred, fn) => {
  return _.map(list, l => {
    if (pred(l)) {
      return fn(l);
    } else return l;
  });
};

let redred = (list, pred, fn, init) => {
  return _.reduce(
    list,
    (a, l) => {
      if (pred(l)) {
        return fn(a, l);
      } else return a;
    },
    init
  );
};

let next = (i, oldstate) => {
  let newstate = _.clone(oldstate);
  newstate.time += newstate.timer;
  let now = newstate.time;
  let updateNewState = (p, a) => {
    newstate.schedule.tasks = mapred(newstate.schedule.tasks, p, a);
  };

  let minVRuntime = () => {
    return redred(
      newstate.schedule.tasks,
      t => t.state == "RUNNABLE",
      (a, l) => Math.min(a, l.vruntime),
      123456789
    );
  };

  let getCurrentLoad = () =>
    redred(
      newstate.schedule.tasks,
      t => t.state == "RUNNING" || t.state == "RUNNABLE",
      (a, l) => a + l.lambda,
      0
    );

  let countPred = p => redred(newstate.schedule.tasks, p, a => a + 1, 0);
  let countRunnable = () => countPred(t => t.state === "RUNNABLE");

  // let existsRunning = () =>
  //   redred(
  //     newstate.schedule.tasks,
  //     t => t.state == "RUNNING",
  //     (a, l) => a + 1,
  //     0
  //   );

  let idealSlice = t => {
    return (t.lambda * newstate.schedule.class.latency) / getCurrentLoad();
  };

  let updateRunning = () =>
    updateNewState(
      t => t.state == "RUNNING",
      t => {
        // simplified assuming that update_curr is invoked only at each timer_interrupt
        let delta_exec = newstate.timer;
        t.vruntime = delta_exec / getCurrentLoad();
        t.exruntime += delta_exec;
        t.sum_exruntime += delta_exec;

        if (t.exruntime >= t.events[0]) {
          t.events = _.tail(t.events);
          if (t.events[0] !== undefined) {
            t.state = "BLOCKED";
            t.block_start = now;
            t.block_end = now + t.events[0];
            t.events = _.tail(t.events);
            newstate.history.push({
              task: t,
              event: "RAN",
              tstart: t.run_start,
              tend: now
            });
          } else {
            t.state = "EXITED";
            newstate.history.push({
              task: t,
              event: "RAN",
              tstart: t.run_start,
              tend: now
            });
            newstate.history.push({
              task: t,
              event: "EXIT",
              ts: now
            });
          }
        }
        if (
          t.exruntime > idealSlice(t) ||
          (countRunnable() > 0 && t.vruntime > minVRuntime())
        ) {
          t.state = "RUNNABLE";
          newstate.history.push({
            task: t,
            event: "RAN",
            tstart: t.run_start,
            tend: now
          });
        }
        return t;
      }
    );

  let updateRunnable = () =>
    updateNewState(
      t => t.start <= now && t.state == "NEW",
      t => {
        t.state = "RUNNABLE";
        t.vruntime = 0;
        t.sum_exruntime = 0;
        newstate.history.push({
          task: t,
          event: "STARTED",
          ts: now
        });
        return t;
      }
    );

  let updateBlocked = () =>
    updateNewState(
      t => t.block_end <= newstate.time && t.state == "BLOCKED",
      t => {
        t.state = "RUNNABLE";
        newstate.history.push({
          task: t,
          event: "BLOCKED",
          tstart: t.block_start,
          tend: t.block_end
        });
        return t;
      }
    );

  let selectRunning = () => {
    let t = _.find(newstate.schedule.tasks, t => t.vruntime == minVRuntime());
    if (t !== undefined) {
      if (t.state !== "RUNNING") {
        t.state = "RUNNING";
        t.run_start = now;
        t.exruntime = 0;
      }
    }
  };

  // Main algorithm
  updateRunnable();
  updateBlocked();
  updateRunning();
  selectRunning();
  newstate.currentLoad = getCurrentLoad();
  newstate.minVRuntime = minVRuntime();
  return newstate;
};

let run = (options, schedule) => {
  let steps = schedule.runfor / schedule.timer;
  let state = initialState(options, schedule);
  _.forEach(_.range(0, steps), i => {
    state = next(i, state);
    // console.log(JSON.stringify(state, 0, 4));
  });
  return state;
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
      let result = run(options, schedule);
      saveIt(options, result);
    });
  prog.parse(process.argv);
};

main();

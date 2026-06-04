"use strict";

let _ = require("lodash");
let Table = require("easy-table");

// let $fs = require("mz/fs");
// let $gstd = require("get-stdin");
const { latexArtifact, writeArtifacts } = require("../artifacts");

let r2 = (x) => Math.round(x * 1000) / 1000;

let eventLoop = (options, schedule) => {
  let state = {
    schedule: schedule,
    curr: undefined,
    rbt: [],
    blocked: [],
    vmin: 0,
    conditions: [],
  };

  let timer = {
    walltime: -schedule.timer,
    events: [],
    show: [0, 1, 4, 6, 8, 9, 10, 11],
  };

  let updateTimer = () => {
    timer.walltime = r2(timer.walltime + schedule.timer);
    // console.log(timer);

    /* Prioritize tasktick */

    let firable_tt = _.remove(
      timer.events,
      (e) => e.type === "_task_tick" && r2(e.deadline) <= timer.walltime,
    );
    _.map(firable_tt, (e) => {
      e.func(e.arg);
    });

    let firable = _.remove(
      timer.events,
      (e) => r2(e.deadline) <= timer.walltime,
    );
    _.map(firable, (e) => {
      e.func(e.arg);
    });

    state.rbt = _.map(state.rbt, (t) => {
      t.q = schedslice(t);
      if (!_.isUndefined(state.curr) && state.curr.index == t.index) {
        t.R = "X";
      } else {
        t.R = "";
      }
      return t;
    });

    // if (_.includes(timer.show, timer.walltime)) {
    // console.log(`at time @${timer.walltime}`);
    // console.log(Table.print(state.rbt));
    // console.log(Table.print(state.blocked));
    // }
    let res = {
      rbt: _.cloneDeep(state.rbt),
      blocked: _.cloneDeep(state.blocked),
      time: timer.walltime,
    };
    _.map(schedule.tasks, (t) => (t.vrtlwk = ""));
    return res;
  };

  let resched = (msg) => {
    // console.log(msg);
    if (state.rbt.length > 0) {
      state.curr = state.rbt[0];
      state.curr.prev = state.curr.sum;
      // console.log(
      //   `scheduled task ${state.curr.name} to run @${timer.walltime}`
      // );
    } else {
      state.curr = undefined;
    }
  };

  let sumlambda = () => _.reduce(state.rbt, (a, t) => a + t.lambda, 0);

  let schedslice = (t) => schedule.class.latency * (t.lambda / sumlambda());

  // Canonical wakeup/start preemption value (ADR 0001):
  //   v = tw.vrt + omega / tw.lambda
  // Mirrors Linux CFS wakeup_gran(se) = calc_delta_fair(gran, se).
  let wakeupV = (tw) => r2(tw.vrt + schedule.class.wgup / tw.lambda);

  let recordCondition = (kind, tw, vrtBefore, vminUsed) => {
    let v = wakeupV(tw);
    let currVrt = _.isUndefined(state.curr) ? undefined : state.curr.vrt;
    let currTask = _.isUndefined(state.curr) ? undefined : state.curr.name;
    let decision = _.isUndefined(currVrt)
      ? "no-curr"
      : v < currVrt
        ? "preempt"
        : "keep";
    state.conditions.push({
      kind,
      time: timer.walltime,
      task: tw.name,
      lambda: tw.lambda,
      omega: schedule.class.wgup,
      latency: schedule.class.latency,
      vrtBefore: r2(vrtBefore),
      vrtAfter: r2(tw.vrt),
      vminUsed: r2(vminUsed),
      v,
      currVrt: _.isUndefined(currVrt) ? undefined : r2(currVrt),
      currTask,
      decision,
    });
  };

  let _start_task = (t) => {
    t.sum = 0;
    // on clone, dont use a lower vrt that would interrupt the current process
    state.rbt.push(t);
    let vrtBefore = t.vrt;
    if (_.isUndefined(t.vrt)) {
      t.vrt = state.vmin + schedslice(t) / t.lambda;
    }
    recordCondition(
      "start",
      t,
      _.isUndefined(vrtBefore) ? t.vrt : vrtBefore,
      state.vmin,
    );
    if (state.curr === undefined || wakeupV(t) < state.curr.vrt) {
      resched(`starting task ${t.name} @${timer.walltime}`);
    }
  };

  let removeFromRbt = (task) => {
    state.rbt = _.filter(state.rbt, (o) => !(o.index == task.index));
  };

  let addBlocked = (task) => {
    state.blocked.splice(0, 0, task);
  };

  let removeBlocked = (task) => {
    state.blocked = _.filter(state.blocked, (o) => !(o.index == task.index));
  };

  let addToRbt = (task) => {
    state.rbt.splice(_.sortedLastIndexBy(state.rbt, task, "vrt"), 0, task);
  };

  let _wakeup = (tw) => {
    // console.log(`Call to wake up ${tw.name} at @${timer.walltime}`);
    let vrtBefore = tw.vrt;
    // vmin here excludes tw by construction: tw is still in 'blocked',
    // not in state.rbt (ADR 0001, decision #2).
    let vminUsed = state.vmin;
    tw.vrt = Math.max(tw.vrt, state.vmin - schedule.class.latency / 2);
    removeBlocked(tw);
    addToRbt(tw);
    let v = wakeupV(tw);
    recordCondition("wakeup", tw, vrtBefore, vminUsed);
    if (!_.isUndefined(state.curr)) {
      tw.vrtlwk = `${v} < ${state.curr.vrt}`;
    }
    if (state.curr !== undefined && v < state.curr.vrt) {
      tw.vrtlwk = `(${v} < ${state.curr.vrt}) \\checkmark`;
      // console.log(`HEII ${v} ---- ${state.curr.vrt}`);
      removeFromRbt(state.curr);
      addToRbt(state.curr);
      resched(`Waking up task ${tw.name} @${timer.walltime}`);
    } else {
      if (state.curr === undefined)
        resched(`Waking up task ${tw.name} @${timer.walltime}`);
      else {
        tw.vrtlwk = `(${v} < ${state.curr.vrt}) $\\times$`;
      }
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
        if (
          state.curr.sum - state.curr.prev == schedslice(state.curr) &&
          state.curr.events[0] > 0
        ) {
          removeFromRbt(state.curr);
          addToRbt(state.curr);
          resched(
            `task ${state.curr.name} finished quantum @${timer.walltime}`,
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
        } else {
          let v = _.find(schedule.tasks, (t) => t.index === state.curr.index);
          v.exited = timer.walltime;
        }
        resched(`putting task to sleep ${ts.name} @${timer.walltime}`);
      }
    }
  };

  _.map(schedule.tasks, (t) => {
    _setTimeout(_start_task, t.start, t, "_start_task");
  });
  _setTimeout(_task_tick, 2 * schedule.timer, undefined, "_task_tick");

  let res = _.map(
    _.range(1, schedule.runfor / schedule.timer + 2),
    updateTimer,
  );
  res.conditions = state.conditions;
  return res;
};

let wrapper = (c) => `
\\begin{tikzpicture}
${c}
\\end{tikzpicture}
`;

let parseHistoryEvents = (history, schedule) => {
  // assume we always start from 0
  let getTaskState = (task, t) => {
    let { rbt, blocked } = _.find(history, ({ time }) => {
      return time === t;
    });
    let findRunning = () => _.find(rbt, (t) => t.R === "X");
    let tr = findRunning();
    if (rbt.length > 0 && tr.index === task.index) {
      return {
        event: "RAN",
        tstart: t,
        tend: t + schedule.timer,
        index: tr.index,
        vrt: tr.vrt,
        sum: tr.sum,
        q: tr.q,
        p: tr.prev,
        vrtlwk: tr.vrtlwk,
      };
    } else {
      let tt;
      if (!_.isUndefined((tt = _.find(rbt, (t) => t.index === task.index)))) {
        return {
          event: "RUNNABLE",
          tstart: t,
          tend: t + schedule.timer,
          index: tt.index,
          vrt: tt.vrt,
          sum: tt.sum,
          vrtlwk: tt.vrtlwk,
        };
      } else {
        if (
          !_.isUndefined((tt = _.find(blocked, (t) => t.index === task.index)))
        ) {
          if (_.isUndefined(tt.exited) || t < tt.exited) {
            return {
              event: "BLOCKED",
              tstart: t,
              tend: t + schedule.timer,
              index: tt.index,
              vrt: tt.vrt,
              sum: tt.sum,
              vrtlwk: tt.vrtlwk,
            };
          } else {
            return {
              event: "EXITED",
              tstart: t,
              tend: t + schedule.timer,
              index: tt.index,
              vrt: tt.vrt,
              sum: tt.sum,
              vrtlwk: tt.vrtlwk,
            };
          }
        }
      }
    }
  };
  let tasksToShow = _.flattenDeep(
    _.map(history, ({ time }, i) => {
      let ranOrBlockedAtTime = _.map(schedule.tasks, (t) =>
        getTaskState(t, time),
      );
      // _.filter(
      // _.map(schedule.tasks, t => getTaskState(t, time)),
      // ({ event }) => event !== "RUNNABLE"
      // );
      if (i < history.length - 1) {
        ranOrBlockedAtTime = _.map(ranOrBlockedAtTime, (t) => {
          let nextState = getTaskState(t, r2(time + schedule.timer));
          t.vrtend = nextState.vrt;
          t.sumend = nextState.sum;
          return t;
        });
      }
      return ranOrBlockedAtTime;
    }),
  );
  return tasksToShow;
};

// Emit LaTeX itemize listing, for each wakeup / start event captured in
// history.conditions, the vrt clamp + canonical preemption check
// v = vrt + omega / lambda against state.curr.vrt. See ADR 0001.
let printConditions = (history, schedule) => {
  let conds = _.filter(history.conditions || [], (c) => c.kind === "wakeup");
  if (conds.length === 0) {
    return `\\begin{itemize}\n\\item (nessun evento di risveglio registrato)\n\\end{itemize}`;
  }
  let fmtNum = (x) => (_.isUndefined(x) ? "-" : `${x}`);
  // Derive a subscript-safe label from a task name like "$\tau_1$" -> "\tau_1".
  let subOf = (name) => {
    let m = /^\$(.+)\$$/.exec(name);
    return m ? m[1] : name;
  };
  let items = _.map(conds, (c) => {
    let sub = subOf(c.task);
    let rho = `\\rho_{${sub}}`;
    let clamp = `${rho} \\gets \\max(${fmtNum(c.vrtBefore)},\\; \\rho_{min} - \\bar\\tau/2) = \\max(${fmtNum(c.vrtBefore)},\\; ${fmtNum(c.vminUsed)} - ${c.latency}/2) = ${fmtNum(c.vrtAfter)}`;
    let vLine = `v_{${sub}} = ${rho} + \\omega/\\lambda_{${sub}} = ${fmtNum(c.vrtAfter)} + ${c.omega}/${c.lambda} = ${fmtNum(c.v)}`;
    let cmp;
    if (_.isUndefined(c.currVrt)) {
      cmp = `\\text{nessun task corrente} \\Rightarrow \\text{schedula } ${c.task}`;
    } else {
      let mark = c.decision === "preempt" ? "\\checkmark" : "\\times";
      let rel = c.decision === "preempt" ? "<" : "\\not<";
      let currSub = subOf(c.currTask);
      cmp = `v_{${sub}} ${rel} \\rho_{${currSub}}:\\; ${fmtNum(c.v)} ${rel} ${fmtNum(c.currVrt)} \\quad ${mark}`;
    }
    return [
      `\\item \\textbf{Risveglio} di ${c.task} a $t=${c.time}$:`,
      `\\begin{align*}`,
      `& ${clamp} \\\\`,
      `& ${vLine} \\\\`,
      `& ${cmp}`,
      `\\end{align*}`,
    ].join("\n");
  });
  return `\\begin{itemize}\n${items.join("\n")}\n\\end{itemize}`;
};

let printData = (history, schedule, finalschedule, options) => {
  let taskevents = _.join(
    _.map(schedule.tasks, (t) => {
      return [
        `\\item task ${t.name} ($\\lambda=$${t.lambda}) inizia a ${t.start}, ` +
          _.join(
            _.map(t.events, (e, i) =>
              i % 2 === 0 ? `gira per ${e}` : `in attesa per ${e}`,
            ),
            ", ",
          ),
      ];
    }),
    "\n",
  );
  let s = `
  \\begin{itemize}
  \\item Dati scheduling: $\\bar{\\tau}$= ${schedule.class.latency}, $\\mu$=${
    schedule.class.mingran
  }, $\\omega$=${schedule.class.wgup}
  ${taskevents}
  \\end{itemize}`;

  return s;
};

let drawHistory = (history, schedule, finalschedule, options) => {
  let hs = schedule.graphics.hspace;
  let vs = schedule.graphics.vspace;
  let hh = schedule.graphics.barheight;

  let printAt = (time, index, m) => {
    return `\\node at(${hs * time}, ${index * hs + 0.5 * hh}) {\\tiny ${m}};`;
  };

  let printAtConf = (time, index, m, conf) => {
    return `\\node [${conf}] at(${hs * time}, ${
      index * hs + 0.5 * hh
    }) {\\tiny ${m}};`;
  };

  let pwrlk = (r) =>
    !_.isUndefined(r.vrtlwk) && r.vrtlwk !== ""
      ? printAtConf(
          r.tend,
          r.index + 0.4,
          `${r.vrtlwk}`,
          `anchor=east, text=${r.vrtlwk.slice(-1) === "k" ? "blue" : "red"}`,
        )
      : "";

  let drawRan = (r) => {
    return [
      `\\draw[draw=black] (${r.tstart * hs}, ${
        r.index * vs
      }) rectangle ++(${(r.tend - r.tstart) * hs},${hh}) node[pos=.5] {}; `,
      printAt(r.tend, r.index - 0.4, r.vrtend),
      // printAtConf(r.tend, r.index + 0.4, r.sumend, "color=gray!90"),
      printAt(r.tend - 0.25, r.index, `${r.sumend - r.p}/${r2(r.q)}`),
      pwrlk(r),
    ];
  };
  let drawBlocked = (r) => {
    return [
      `\\draw[draw=black, fill=gray] (${r.tstart * hs}, ${
        r.index * vs
      }) rectangle ++(${
        (r.tend - r.tstart) * hs
      },${hh}) node[pos=.5, text=white] {};`,
      pwrlk(r),
    ];
  };
  let drawRunnable = (r) => {
    return [pwrlk(r)];
  };
  history = parseHistoryEvents(history, schedule);
  let diag = _.map(history, (x, i) => {
    if (x.tstart < schedule.runfor) {
      if (x.event === "RAN") return drawRan(x);
      if (x.event === "BLOCKED") return drawBlocked(x);
      if (x.event === "RUNNABLE") return drawRunnable(x);
    }
    return [];
  });
  let tnames = _.flattenDeep([
    _.map(
      schedule.tasks,
      (t) => `\\node at(${hs * -1}, ${t.index * hs + 0.5 * hh}) {${t.name}};`,
    ),
    _.map(
      schedule.tasks,
      (t) => [
        printAt(-0.6, t.index - 0.4, `$\\rho=$${t.vrt}`),
        printAt(-0.6, t.index - 0.2, `$\\lambda=$${t.lambda}`),
      ],
      // `\\node at(${hs * -0.6}, ${t.index * hs + 0.3 * hh}) {\\tiny ${t.vrt}};`
    ),
  ]);
  let grid = [
    `\\draw[xstep=${
      schedule.timer
    },gray!20,thin,shift={(0,-0.25)}] (0,0) grid (${schedule.runfor},${
      schedule.tasks.length
    });`,
    _.map(_.range(0, schedule.runfor / schedule.timer + 1), (i) =>
      printAtConf(
        i * schedule.timer,
        -0.7,
        `\\emph{${i * schedule.timer}}`,
        "text=gray",
      ),
    ),
  ];
  // console.log(schedule.tasks);

  let taskevents = _.map(schedule.tasks, (t) => {
    return [
      printAtConf(
        0,
        (-schedule.tasks.length + t.index) * 0.2 - 0.7,
        `task ${t.name}: starts at ${t.start}, ` +
          _.join(
            _.map(t.events, (e, i) =>
              i % 2 === 0 ? `runs for ${e}` : `blocks for ${e}`,
            ),
            ", ",
          ),
        "anchor=west",
      ),
      `\\draw [->] (${t.start}, ${t.index} + 0.75) -- (${t.start}, ${t.index});`,
    ];
  });

  let taskexits = _.map(finalschedule.tasks, (t) => {
    return !_.isUndefined(t.exited)
      ? [
          `\\draw [<-] (${t.exited}, ${t.index} + 0.75) -- (${t.exited}, ${
            t.index
          });`,
        ]
      : [];
  });

  let data = [
    printAtConf(
      -0.6,
      schedule.tasks.length,
      `Schedule data: $\\bar{\\tau}$= ${schedule.class.latency}, $\\mu$=${
        schedule.class.mingran
      }, $\\omega$=${schedule.class.wgup}`,
      "anchor=west",
    ),
  ];

  if (_.isUndefined(options.blank) || !options.blank) {
    return wrapper(
      _.join(
        _.flattenDeep([grid, tnames, diag, taskevents, taskexits, data]),
        "\n",
      ),
    );
  } else {
    return wrapper(
      _.join(_.flattenDeep([grid, tnames, taskevents, data]), "\n"),
    );
  }
};

let saveIt = (options, history, origschedule, finalschedule) => {
  let schedPkgs = ["tikz", "amsmath", "amssymb"];
  let schedLibs = ["arrows", "positioning"];
  history.latex = [
    latexArtifact(
      drawHistory(history, origschedule, finalschedule, { blank: false }),
      "rt diagram",
      "standalone",
      "pdflatex",
      "-r varwidth",
      schedPkgs,
      schedLibs,
    ),
    latexArtifact(
      drawHistory(history, origschedule, finalschedule, { blank: true }),
      "rt diagram blank",
      "standalone",
      "pdflatex",
      "-r varwidth",
      schedPkgs,
      schedLibs,
    ),
    latexArtifact(
      printData(history, origschedule, finalschedule, {}),
      "data table",
      "standalone",
      "pdflatex",
      "-r varwidth",
      schedPkgs,
    ),
    latexArtifact(
      printConditions(history, origschedule),
      "wakeup conditions",
      "standalone",
      "pdflatex",
      "-r varwidth",
      schedPkgs,
      schedLibs,
    ),
  ];
  if (!options.save) {
    console.log(JSON.stringify(history, 0, 4));
  } else {
    writeArtifacts(history.latex, options);
  }
};

let runAndSave = (options, schedule) => {
  let origschedule = _.cloneDeep(schedule);
  let history = eventLoop(options, schedule);
  saveIt(options, history, origschedule, schedule);
};

module.exports = { eventLoop, saveIt, runAndSave, printConditions };
